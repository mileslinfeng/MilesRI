// server/test_yf2.js
import yahooFinance from "yahoo-finance2";

yahooFinance._opts = {
  ...yahooFinance._opts,
  validateResult: false,
  cookieJar: false,        // ⛔️ 禁用 cookie
  YF_QUERY_HOST: "query2.finance.yahoo.com", // 🔁 直接走 API 域
  YF_FANTASY_HOST: "query2.finance.yahoo.com"
};

const symbols = ["AAPL", "NVDA", "BBAI", "ENPH"];

async function test() {
  for (const sym of symbols) {
    console.log(`\n🧪 Testing ${sym} ...`);
    try {
      const data = await yahooFinance.quoteSummary(sym, {
        modules: ["earnings", "financialData", "calendarEvents"],
      });

      const nextEarnings =
        data?.calendarEvents?.earnings?.earningsDate?.[0]?.fmt || "N/A";
      const eps = data?.earnings?.financialsChart?.quarterly || [];
      const last = eps.length ? eps[eps.length - 1] : null;

      console.log({
        epsCount: eps.length,
        nextEarnings,
        lastEps: last,
      });
    } catch (e) {
      console.error(`❌ ${sym} failed: ${e.message}`);
    }
  }
}

test();
