const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30;
const API_KEY = process.env.ALPHA_VANTAGE_KEY;

router.get("/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.time < CACHE_TTL)
    return res.json({ ok: true, data: cached.data, cached: true });

  try {
    const [earningsRes, incomeRes] = await Promise.all([
      fetch(`https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol}&apikey=${API_KEY}`),
      fetch(`https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${API_KEY}`)
    ]);

    const earnings = await earningsRes.json();
    const income = await incomeRes.json();

    const latestEps = earnings.quarterlyEarnings?.[0];
    const prevEps = earnings.quarterlyEarnings?.[1];
    const latestIncome = income.quarterlyReports?.[0];
    const prevIncome = income.quarterlyReports?.[1];

    if (!latestEps)
      return res.json({ ok: false, message: "No earnings data found" });

    const result = {
      symbol,
      fiscalDateEnding: latestEps.fiscalDateEnding,
      lastReportDate: latestEps.reportedDate,
      reportedEPS: latestEps.reportedEPS,
      estimatedEPS: latestEps.estimatedEPS,
      epsSurprise: latestEps.surprisePercentage,
      reportedRevenue: latestIncome?.totalRevenue || null,
      prevRevenue: prevIncome?.totalRevenue || null,
      revenueGrowth:
        latestIncome && prevIncome
          ? (((latestIncome.totalRevenue - prevIncome.totalRevenue) /
              prevIncome.totalRevenue) *
              100).toFixed(2)
          : null,
      aiSummary: getAISummary(latestEps, latestIncome, prevIncome),
    };

    cache.set(symbol, { time: Date.now(), data: result });
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function getAISummary(eps, income, prevIncome) {
  const epsDiff = eps.surprisePercentage ? Number(eps.surprisePercentage) : 0;
  const revDiff =
    income && prevIncome
      ? ((income.totalRevenue - prevIncome.totalRevenue) / prevIncome.totalRevenue) * 100
      : 0;

  if (epsDiff > 5 && revDiff > 5) return "Strong beat on both EPS and revenue 📈";
  if (epsDiff > 0 && revDiff >= 0) return "Slight beat on expectations ✅";
  if (epsDiff < -5 || revDiff < -5) return "Missed expectations ⚠️";
  return "Neutral performance ⚪";
}

module.exports = router;
