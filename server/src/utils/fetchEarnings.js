// server/src/utils/fetchEarnings.js
// 统一从 AlphaVantage + Finnhub 拉数据，并对齐/合并
// 说明：全部 CommonJS 写法，兼容你原项目（require/module.exports）

const fetch = require("node-fetch");


/** ====== 从全局 CONFIG 读取 ====== */
const AV_KEY = global.CONFIG?.ALPHA_VANTAGE_KEY;
const FINN_KEY = global.CONFIG?.FINNHUB_KEY;
const FMP_KEY = global.CONFIG?.FMP_KEY;
const EODHD_KEY = global.CONFIG?.EODHD_KEY;


/** ====== 小工具 ====== */
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toISO(raw) {
  if (!raw) return null;
  // 支持 2025-06-30 / 2025/06/30 / 时间戳
  const d = new Date(
    typeof raw === "number" ? raw * 1000 : String(raw).replace(/\//g, "-")
  );
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
function deriveSurprisePct(avPct, actual, estimate) {
  if (Number.isFinite(Number(avPct))) return +Number(avPct).toFixed(4);
  if (
    Number.isFinite(Number(actual)) &&
    Number.isFinite(Number(estimate)) &&
    Number(estimate) !== 0
  ) {
    return +(((Number(actual) - Number(estimate)) / Math.abs(Number(estimate))) * 100).toFixed(4);
  }
  return null;
}
function aiCode(s) {
  const v = Number(s);
  if (!Number.isFinite(v)) return "neutral";
  if (v >= 5) return "beat";
  if (v > 0) return "stable";
  if (v <= -5) return "miss";
  return "neutral";
}
async function safeJson(url, headers = {}) {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        Connection: "keep-alive",
        ...headers,
      },
      timeout: 15000,
    });
    if (!r.ok) {
      return { ok: false, status: r.status, data: null };
    }
    const data = await r.json();
    return { ok: true, status: r.status, data };
  } catch (e) {
    return { ok: false, status: null, data: null, error: e.message };
  }
}

/** ====== AlphaVantage: EPS 列表 ======
 * https://www.alphavantage.co/documentation/#earnings
 * 返回季度 EPS、estimate、surprisePercentage、fiscalDateEnding、reportedDate
 */
async function getAlphaEarnings(symbol) {
  if (!AV_KEY) return { ok: false, data: [] };

  const url = `https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol}&apikey=${AV_KEY}`;
  const { ok, data } = await safeJson(url);
  if (!ok || !data) return { ok: false, data: [] };

  // ✅ 新版接口字段兼容处理
  const list =
    data.quarterlyEarnings ||
    data.quarterlyReports ||
    data.quarterly_reports ||
    [];

  if (!Array.isArray(list) || !list.length) return { ok: false, data: [] };

  const rows = list.map((q) => ({
    fiscalDateEnding: toISO(q.fiscalDateEnding || q.fiscal_date_ending || null),
    reportedDate: q.reportedDate || q.reported_date || null,
    reportedEPS: safeNum(q.reportedEPS || q.reported_eps),
    estimatedEPS: safeNum(q.estimatedEPS || q.estimated_eps),
    surprise: deriveSurprisePct(
      q.surprisePercentage || q.surprise_percent,
      q.reportedEPS || q.reported_eps,
      q.estimatedEPS || q.estimated_eps
    ),
  }));

  return { ok: true, data: rows };
}



/** ====== Finnhub: 最近/下次财报日（calendar/earnings） ======
 * https://finnhub.io/docs/api/calendar-earnings
 * 该接口返回未来预告（以及窗口内历史），我们拿 symbol 的最近一条未来或最近一条记录
 */
async function getFinnhubUpcoming(symbol) {
  if (!FINN_KEY) return { ok: false, nextEarningsDate: null };
  // 给一个较宽窗口，拿最近一条（未来优先）
  const today = new Date();
  const start = new Date(today.getTime() - 3600 * 24 * 120 * 1000).toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 3600 * 24 * 240 * 1000).toISOString().slice(0, 10);

  const url = `https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${start}&to=${end}&token=${FINN_KEY}`;
  const { ok, data } = await safeJson(url);
  if (!ok || !Array.isArray(data?.earningsCalendar)) {
    return { ok: false, nextEarningsDate: null };
  }
  const list = (data.earningsCalendar || []).filter((x) => {
    const sym = (x.symbol || "").toUpperCase();
    return sym === symbol || sym.includes(symbol);
  });
  if (!list.length && FMP_KEY) {
    // --- 兜底 FMP earning calendar ---
    const urlFMP = `https://financialmodelingprep.com/api/v3/earning_calendar/${symbol}?limit=2&apikey=${FMP_KEY}`;
    const fmp = await safeJson(urlFMP);
    if (fmp.ok && Array.isArray(fmp.data) && fmp.data[0]?.date) {
      return { ok: true, nextEarningsDate: toISO(fmp.data[0].date) };
    }
  }
  if (!list.length) return { ok: true, nextEarningsDate: null };
  
  // 优先选择 >= today 的最近一条；否则选最近历史一条
  const todayISO = toISO(today.toISOString().slice(0, 10));
  const future = list
    .filter((x) => toISO(x.date) >= todayISO)
    .sort((a, b) => (toISO(a.date) > toISO(b.date) ? 1 : -1));
  const past = list
    .filter((x) => toISO(x.date) < todayISO)
    .sort((a, b) => (toISO(a.date) > toISO(b.date) ? 1 : -1));

  const chosen = future[0] || past[past.length - 1] || null;
  return { ok: true, nextEarningsDate: chosen ? toISO(chosen.date) : null };
}

/** ====== Finnhub: EPS 历史（/stock/earnings） ======
 * https://finnhub.io/docs/api/company-earnings
 * 返回 period(YYYY-MM-DD)、actual、estimate、surprisePercent
 */
async function getFinnhubEpsHistory(symbol) {
  if (!FINN_KEY) return { ok: false, data: [] };
  const url = `https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${FINN_KEY}`;
  const { ok, data } = await safeJson(url);
  if (!ok || !Array.isArray(data)) return { ok: false, data: [] };
  // 统一为 fiscalDateEnding = period
  const rows = data.map((r) => ({
    fiscalDateEnding: toISO(r?.period),
    reportedDate: toISO(r?.period),
    reportedEPS: safeNum(r?.actual),
    estimatedEPS: safeNum(r?.estimate),
    surprise: safeNum(r?.surprisePercent),
  }));
  return { ok: true, data: rows };
}

/** ====== Finnhub: 季度收入（/stock/financials?statement=ic&freq=quarterly） ======
 * https://finnhub.io/docs/api/financials
 * 返回 data: [{ period: '2025-06-30', revenue: 123, ...}, ...]
 */
/* ========= 新：EDGAR (SEC) 合规抓取 + 多源兜底实现 ========= */

/**
 * ticker -> CIK 映射：从 SEC 提供的 company_tickers.json 获取（缓存到内存）
 * 返回格式 CIK string, zero-padded to 10 digits as used by SEC API, e.g. '0000320193'
 */

const fs = require("fs");
const path = require("path");

let _secTickerMap = null;
const SEC_CACHE_FILE = path.join(__dirname, "../../cache/sec_tickers.json");

/**
 * 从本地缓存读取 / SEC 官网获取 ticker -> CIK 映射
 */
async function tickerToCIK(ticker) {
  try {
    // 第一次调用时初始化
    if (!_secTickerMap) {
      // ✅ 优先尝试从本地缓存读取
      if (fs.existsSync(SEC_CACHE_FILE)) {
        try {
          const raw = fs.readFileSync(SEC_CACHE_FILE, "utf8");
          const cached = JSON.parse(raw);
          _secTickerMap = cached;
          console.log(`📁 [EDGAR] 从本地缓存加载 ${Object.keys(_secTickerMap).length} 条 Ticker`);
        } catch (e) {
          console.log("⚠️ [EDGAR] 本地 sec_tickers.json 解析失败，重新下载");
        }
      }

      // ⚙️ 如果没有缓存或解析失败，则从 SEC 拉取
      if (!_secTickerMap) {
        const url = "https://www.sec.gov/files/company_tickers.json";
        const { ok, data } = await safeJson(url);
        if (!ok || !data) {
          console.log("⚠️ [EDGAR] 无法拉取 company_tickers.json");
          _secTickerMap = {};
        } else {
          const map = {};
          if (Array.isArray(data)) {
            data.forEach((it) => {
              if (it.ticker)
                map[it.ticker.toUpperCase()] = String(it.cik_str).padStart(10, "0");
            });
          } else {
            Object.values(data).forEach((it) => {
              if (it && it.ticker)
                map[it.ticker.toUpperCase()] = String(it.cik_str).padStart(10, "0");
            });
          }
          _secTickerMap = map;

          // ✅ 写入本地缓存文件
          const cacheDir = path.dirname(SEC_CACHE_FILE);
          if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
          fs.writeFileSync(SEC_CACHE_FILE, JSON.stringify(_secTickerMap, null, 2));
          console.log(`💾 [EDGAR] 已缓存 ${Object.keys(_secTickerMap).length} 条 Ticker 至 ${SEC_CACHE_FILE}`);
        }
      }
    }

    // 查找对应 CIK
    return _secTickerMap[(ticker || "").toUpperCase()] || null;
  } catch (e) {
    console.log("⚠️ [EDGAR] tickerToCIK 错误:", e.message);
    return null;
  }
}


/**
 * 从 EDGAR company_facts 中提取季度营收（单位 USD）
 * 返回 Map { '2025-06-30' => 1234567890, ... }
 */
async function getEdgarRevenueQuarterly(symbol) {
  const idx = new Map();
  try {
    const cik = await tickerToCIK(symbol);
    if (!cik) {
      console.log(`⏭️ [EDGAR] 无法找到 ${symbol} 的 CIK`);
      return { ok: false, index: idx };
    }

    // SEC 要求 User-Agent header，safeJson 已包含 UA，但我们明确说明
    const url = `https://data.sec.gov/api/xbrl/company_facts/CIK${cik}.json`;
    const { ok, data, status } = await safeJson(url, { "User-Agent": "EarningsPro/1.0 (contact@example.com)" });
    console.log(`→ EDGAR 响应: ok=${ok}, status=${status}`);

    if (!ok || !data) {
      return { ok: false, index: idx };
    }

    // 查找 us-gaap 下可能为营收的标签

    const facts = data?.facts?.["us-gaap"] || {};
    const revenueCandidates = [
      "Revenues",
      "Revenue",
      "TotalRevenue",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "SalesRevenueNet",
      "SalesRevenueServicesNet",
      "RevenuesNetOfInterestExpense",
      "OperatingRevenue",
      "RevenueFromGoodsSold",
      "RevenueFromServices",
      "RevenuesUSD",
      "RevenuesNetUSD"
    ];

    // 找到第一个存在的候选标签
    let chosenKey = null;
    for (const k of revenueCandidates) {
      if (facts[k] && facts[k].units && facts[k].units.USD) {
        chosenKey = k;
        break;
      }
    }

    // 打印哪些候选项存在（调试用途）
    console.log(
      "📊 [EDGAR] 可用营收字段:",
      Object.keys(facts).filter((k) => /revenue|sales|revenue/i.test(k))
    );


    if (!chosenKey) {
      // 若没有 us-gaap 命中，再尝试其它命名空间（少见）
      console.log("⚠️ [EDGAR] 未在 us-gaap 找到常见营收字段");
      return { ok: false, index: idx };
    }

    const entries = facts[chosenKey].units.USD; // array of { "end": "2025-06-30", "val": 123... }
    if (!Array.isArray(entries) || !entries.length) {
      console.log("⚠️ [EDGAR] 选定字段无数据:", chosenKey);
      return { ok: false, index: idx };
    }

    // 只取 quarterly items: EDGAR entries include 'end' and 'fp' (fiscal period) - filter by period length
    entries.forEach((it) => {
      const end = it.end;
      const val = it.val;
      if (!end || val == null) return;
      // toISO on existing date string will normalize
      const k = toISO(end);
      if (!k) return;
      // EDGAR sometimes includes instant or annual; we accept any with end date (quarterly mapping is fine)
      idx.set(k, safeNum(val));
    });

    console.log(`✅ [EDGAR] ${symbol} 从 ${chosenKey} 提取到 ${idx.size} 条营收记录`);
    return { ok: idx.size > 0, index: idx };
  } catch (e) {
    console.log("⚠️ [EDGAR] 异常:", e.message);
    return { ok: false, index: idx };
  }
}


// ===== Yahoo Finance 爬取季度营收 =====
// 完全仿照 multi_revenue_fetch.py 逻辑移植，支持 AAPL/NVDA/MSFT/BBAI 等
// 不依赖任何 API KEY

const cheerio = require("cheerio");
async function getYahooRevenue(symbol) {
  const idx = new Map();
  try {
    console.log(`🌐 [YahooFinance] 抓取 ${symbol} 季度营收中...`);

    const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${symbol}?type=quarterlyTotalRevenue,quarterlyRevenue&padTimeSeries=true&lang=en-US&region=US`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Referer": `https://finance.yahoo.com/quote/${symbol}/financials`,
      },
    });

    if (!res.ok) {
      console.log(`⚠️ [YahooFinance] 响应失败 ${res.status}`);
      return { ok: false, index: idx };
    }

    const data = await res.json();
    const result = data?.timeseries?.result?.[0];
    if (!result) {
      console.log("⚠️ [YahooFinance] 没找到 result 节点");
      return { ok: false, index: idx };
    }

    // ✅ 最新接口结构
    const ts = result.timeSeries || {};
    const series =
      ts.quarterlyTotalRevenue ||
      ts.quarterlyRevenue ||
      result.quarterlyTotalRevenue ||
      result.quarterlyrevenue ||
      [];

    if (!Array.isArray(series) || series.length === 0) {
      // 打印调试信息帮助确认结构
      console.log(
        "⚠️ [YahooFinance] 无季度营收字段。可用键:",
        Object.keys(ts)
      );
      return { ok: false, index: idx };
    }

    series.forEach((item) => {
      const date = toISO(item.asOfDate || item.endDate);
      const val = safeNum(item?.reportedValue?.raw || item?.reportedValue?.fmt);
      if (date && val != null) {
        idx.set(date, val);
      }
    });

    console.log(`✅ [YahooFinance] ${symbol} 抓取到 ${idx.size} 条季度营收`);
    return { ok: idx.size > 0, index: idx };
  } catch (e) {
    console.log("⚠️ [YahooFinance] 异常:", e.message);
    return { ok: false, index: idx };
  }
}

async function getRevenueFromYfinance(symbol) {
  console.log(`🐍 [yfinance] 调用 Python 获取 ${symbol} 营收...`);

  // 1) Python 代码：把 NaN 规范为 null，并禁止 allow_nan
  const pyCode = `
import json, sys
try:
    import yfinance as yf
    import math
except Exception as e:
    print("[]")
    sys.exit(0)

sym = sys.argv[1]
t = yf.Ticker(sym)
q = getattr(t, "quarterly_financials", None)

out = []
try:
    if q is not None and hasattr(q, "empty") and (not q.empty):
        # 行名可能是 "Total Revenue" 或 "TotalRevenue"
        key = None
        for k in ["Total Revenue", "TotalRevenue", "Total revenue", "TotalRevenueNet"]:
            if k in q.index:
                key = k
                break
        if key is None and len(q.index) > 0:
            # 兜底：挑一个包含 revenue/sales 的行
            for nm in q.index:
                if "revenue" in str(nm).lower() or "sales" in str(nm).lower():
                    key = nm
                    break
        if key is not None:
            for col in q.columns:
                val = q.at[key, col]
                try:
                    f = float(val)
                    if math.isnan(f) or math.isinf(f):
                        f = None
                except Exception:
                    f = None
                out.append({"date": str(col)[:10], "revenue": f})
except Exception:
    pass

print(json.dumps(out, allow_nan=False))
  `;

  const { spawnSync, spawn } = require("child_process");
  const os = require("os");
  const fs = require("fs");
  const path = require("path");

  // 2) 临时脚本放系统临时目录，避免权限/路径问题；文件名唯一
  const pyPath = path.join(os.tmpdir(), `yf_rev_${symbol}_${Date.now()}.py`);
  fs.writeFileSync(pyPath, pyCode);

  let pyExe = fs.existsSync(path.join(process.cwd(), ".venv/Scripts/python.exe"))
    ? path.join(process.cwd(), ".venv/Scripts/python.exe")
    : "python";

  // 3) 检查依赖
  const check = spawnSync(pyExe, ["-c", "import yfinance"], { encoding: "utf-8" });
  if (check.stderr && check.stderr.includes("ModuleNotFoundError")) {
    console.log("⚙️ 自动安装 yfinance 依赖...");
    spawnSync(pyExe, ["-m", "pip", "install", "yfinance", "pandas"], { stdio: "inherit" });
  }

  // 4) 执行 + 容错清理
  return new Promise((resolve) => {
    const child = spawn(pyExe, [pyPath, symbol], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => console.log("🐍 [stderr]", d.toString()));

    child.on("error", (err) => {
      console.log("⚠️ [yfinance] 调用失败:", err.message);
      if (fs.existsSync(pyPath)) try { fs.unlinkSync(pyPath); } catch {}
      resolve({ ok: false, index: new Map() });
    });

    child.on("close", () => {
      try {
        const arr = JSON.parse(stdout.trim() || "[]");  // 这里不会再出现 NaN
        const idx = new Map(arr
          .filter(r => r && r.date && r.revenue != null)
          .map((r) => [r.date, Number(r.revenue)])
        );
        console.log(`✅ [yfinance] ${symbol} 获取 ${idx.size} 条季度营收`);
        resolve({ ok: idx.size > 0, index: idx });
      } catch (e) {
        console.log("⚠️ [yfinance] 解析失败:", e.message);
        resolve({ ok: false, index: new Map() });
      } finally {
        if (fs.existsSync(pyPath)) try { fs.unlinkSync(pyPath); } catch {}
      }
    });
  });
}


/**
 * 替代实现：先尝试 Python 缓存 → EDGAR (SEC company_facts) → FMP → Finnhub → EODHD
 * 并输出每个来源的状态（便于在控制台确认哪个 source 生效）
 */
async function getFinnhubRevenueQuarterly(symbol) {
  console.log(`\n🔍 [RevenueFetch] 开始抓取 ${symbol} 营收数据...`);

  // 1️⃣ 优先使用 yfinance
  const y = await getRevenueFromYfinance(symbol);
  if (y.ok && y.index.size > 0) {
    console.log("→ 使用来源：yfinance");
    return y;
  }

  // 2️⃣ 再试 EDGAR
  const e = await getEdgarRevenueQuarterly(symbol);
  if (e.ok && e.index.size > 0) {
    console.log("→ 使用来源：EDGAR (SEC)");
    return e;
  }

  console.log("❌ [RevenueFetch] 所有来源均无结果");
  return { ok: false, index: new Map() };
}


/** ====== 汇总：summary（最后一个季度） ======
 * 规则：
 * 1) 优先 AlphaVantage 的最新季度 EPS/Estimate/Surprise
 * 2) 收入来自 Finnhub quarterly financials 按 fiscalDateEnding 对齐
 * 3) 下次财报来自 Finnhub calendar
 */
async function assembleSummary(symbol) {
  // 1) Alpha EPS
  const av = await getAlphaEarnings(symbol);
  let last = av.ok && av.data.length ? av.data[0] : null;

  // 2) 如果 AV 不可用，用 Finnhub EPS 历史兜底
  if (!last) {
    const fhEps = await getFinnhubEpsHistory(symbol);
    if (fhEps.ok && fhEps.data.length) {
      // 取最新（period 越大越新）
      const sorted = fhEps.data
        .filter((r) => r.fiscalDateEnding)
        .sort((a, b) => (a.fiscalDateEnding > b.fiscalDateEnding ? -1 : 1));
      last = sorted[0] || null;
    }
  }

  if (!last) {
    const nextE = await getFinnhubUpcoming(symbol);
    return {
      ok: true,
      data: {
        symbol,
        lastReportDate: null,
        fiscalDateEnding: null,
        reportedEPS: null,
        estimatedEPS: null,
        surprise: null,
        reportedRevenue: null,
        estimatedRevenue: null,
        revenueSurprise: null,
        nextEarningsDate: nextE.ok ? nextE.nextEarningsDate : null,
        aiCode: "neutral"
      }
    };
  }
  


  // --- 收入对齐 ---
  const fhRev = await getFinnhubRevenueQuarterly(symbol);
  const rev = fhRev.ok ? fhRev.index.get(last.fiscalDateEnding) : null;

  // --- EPS 预期兜底 ---
  let estimatedEPS = last.estimatedEPS ?? null;
  if (estimatedEPS == null && FMP_KEY) {
    const url = `https://financialmodelingprep.com/api/v3/earnings-surprises/${symbol}?limit=4&apikey=${FMP_KEY}`;
    const { ok, data } = await safeJson(url);
    if (ok && Array.isArray(data)) {
      const match = data.find((r) => toISO(r.date) === last.fiscalDateEnding);
      if (match?.estimate) estimatedEPS = safeNum(match.estimate);
    }
  }

  // --- 收入预期兜底 ---
  let estimatedRevenue = null;
  if (FMP_KEY) {
    const url = `https://financialmodelingprep.com/api/v3/earning_calendar/${symbol}?limit=4&apikey=${FMP_KEY}`;
    const { ok, data } = await safeJson(url);
    if (ok && Array.isArray(data)) {
      const match = data.find((r) => toISO(r.date) === last.fiscalDateEnding);
      if (match?.revenueEstimate) estimatedRevenue = safeNum(match.revenueEstimate);
    }
  }

  // 4) 下次财报
  const nextE = await getFinnhubUpcoming(symbol);

  return {
    ok: true,
    data: {
      symbol,
      lastReportDate: last.reportedDate || null,
      fiscalDateEnding: last.fiscalDateEnding || null,
      reportedEPS: last.reportedEPS ?? null,
      estimatedEPS: last.estimatedEPS ?? null,
      surprise: last.surprise ?? null,
      reportedRevenue: rev ?? null,
      nextEarningsDate: nextE.ok ? nextE.nextEarningsDate : null,
      aiCode: aiCode(last.surprise),
    },
  };
}

/** ====== 历史：history（最近 N 季度） ======
 * 规则：
 * 1) 用 AlphaVantage 的季度 EPS 列表（最多 16）
 * 2) 用 Finnhub 的季度收入 index 对齐
 * 3) 如果 AV 没有，则用 Finnhub EPS 历史兜底
 */
async function assembleHistory(symbol, limit = 16) {
  let base = [];
  const av = await getAlphaEarnings(symbol);
  if (av.ok && av.data.length) {
    base = av.data;
  } else {
    const fhEps = await getFinnhubEpsHistory(symbol);
    if (fhEps.ok && fhEps.data.length) base = fhEps.data;
  }

  if (!base.length) {
    return { ok: true, data: [] };
  }

  // 对齐收入
  const fhRev = await getFinnhubRevenueQuarterly(symbol);
  const rows = base
    .filter((r) => r.fiscalDateEnding)
    .sort((a, b) => (a.fiscalDateEnding > b.fiscalDateEnding ? -1 : 1))
    .slice(0, limit)
    .map((row) => {
      const revenue = fhRev.ok ? fhRev.index.get(row.fiscalDateEnding) : null;
      const s = row.surprise;
      return {
        fiscalDateEnding: row.fiscalDateEnding,
        reportedDate: row.reportedDate || null,
        reportedEPS: row.reportedEPS ?? null,
        estimatedEPS: row.estimatedEPS ?? null,
        surprise: Number.isFinite(Number(s)) ? +Number(s).toFixed(4) : null,
        revenue: revenue ?? null, // USD
        aiCode: aiCode(s),
      };
    });

  return { ok: true, data: rows };
}

module.exports = {
  assembleSummary,
  assembleHistory,
};
async function getEarningsCalendar(range = "week") {
  const today = new Date();
  const toISO = (d) => d.toISOString().slice(0, 10);

  const end = new Date(today);
  const start = new Date(today);

  switch (range) {
    case "day":
      break;
    case "week":
      start.setDate(today.getDate() - 3);
      end.setDate(today.getDate() + 4);
      break;
    case "month":
      start.setDate(today.getDate() - 7);
      end.setDate(today.getDate() + 30);
      break;
    default:
      start.setDate(today.getDate() - 7);
      end.setDate(today.getDate() + 7);
  }

  const from = toISO(start);
  const to = toISO(end);
  console.log(`📅 [EarningsCalendar] 抓取 ${from} ~ ${to} 财报预告`);

  let list = [];

  // === 1️⃣ Finnhub 主源 ===
  if (FINN_KEY) {
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINN_KEY}`;
    const { ok, data } = await safeJson(url);
    if (ok && Array.isArray(data?.earningsCalendar)) {
      list = data.earningsCalendar.map((r) => ({
        symbol: (r.symbol || "").toUpperCase(),
        date: toISO(r.date),
        time: r.time || null,
        eps: safeNum(r.epsEstimate),
        revenue: safeNum(r.revenueEstimate),
      }));
    }
  }

  // === 2️⃣ FMP 兜底 ===
  if ((!list || !list.length) && FMP_KEY) {
    const url = `https://financialmodelingprep.com/api/v3/earning_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`;
    const { ok, data } = await safeJson(url);
    if (ok && Array.isArray(data)) {
      list = data.map((r) => ({
        symbol: (r.symbol || "").toUpperCase(),
        date: toISO(r.date),
        time: r.time || null,
        eps: safeNum(r.eps) || safeNum(r.epsEstimate),
        revenue: safeNum(r.revenue) || safeNum(r.revenueEstimate),
      }));
    }
  }

  if (!list.length) return { ok: false, data: {} };

  // === 3️⃣ 补充板块/股价/市值 ===
  const uniqueSymbols = [...new Set(list.map((x) => x.symbol))].slice(0, 200); // 限制最大数量防止超速

  const { spawnSync } = require("child_process");
  const fs = require("fs");
  const path = require("path");
  
  /**
   * 使用 yfinance 获取公司板块、股价、市值
   * 失败时回退到 FMP API
   */
  async function fetchExtra(symbol) {
    let sector = null, price = null, marketCap = null;
  
    try {
      const pyCode = `
  import json, sys, math
  try:
      import yfinance as yf
  except Exception:
      print(json.dumps({"sector": null, "price": null, "marketCap": null}, allow_nan=False))
      sys.exit(0)
  
  sym = sys.argv[1]
  t = yf.Ticker(sym)
  info = getattr(t, "info", {}) or {}
  
  def clean_num(x):
      try:
          f = float(x)
          if math.isnan(f) or math.isinf(f):
              return None
          return f
      except Exception:
          return None
  
  out = {
    "sector": info.get("sector") or info.get("industry"),
    "price": clean_num(info.get("currentPrice") or info.get("regularMarketPrice")),
    "marketCap": clean_num(info.get("marketCap"))
  }
  print(json.dumps(out, allow_nan=False))
      `;
  
      const os = require("os");
      const fs = require("fs");
      const path = require("path");
      const { spawnSync } = require("child_process");
  
      const pyPath = path.join(os.tmpdir(), `yf_extra_${symbol}_${Date.now()}.py`);
      fs.writeFileSync(pyPath, pyCode);
  
      let pyExe = fs.existsSync(path.join(process.cwd(), ".venv/Scripts/python.exe"))
        ? path.join(process.cwd(), ".venv/Scripts/python.exe")
        : "python";
  
      const check = spawnSync(pyExe, ["-c", "import yfinance"], { encoding: "utf-8" });
      if (check.stderr && check.stderr.includes("ModuleNotFoundError")) {
        console.log("⚙️ 自动安装 yfinance...");
        spawnSync(pyExe, ["-m", "pip", "install", "yfinance", "pandas"], { stdio: "inherit" });
      }
  
      const result = spawnSync(pyExe, [pyPath, symbol], { encoding: "utf-8" });
      if (fs.existsSync(pyPath)) try { fs.unlinkSync(pyPath); } catch {}
  
      if (result.stdout) {
        const data = JSON.parse(result.stdout);
        sector = data?.sector || null;
        price = data?.price != null ? Number(data.price) : null;
        marketCap = data?.marketCap != null ? Number(data.marketCap) : null;
      }
    } catch (e) {
      console.log(`⚠️ [yfinance] ${symbol} 获取失败:`, e.message);
    }
    // === 若 yfinance 失败，用 FMP 兜底 ===
    if ((!sector || !price || !marketCap) && FMP_KEY) {
      try {
        const [profile, quote] = await Promise.all([
          safeJson(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`),
          safeJson(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_KEY}`)
        ]);
  
        if (profile.ok && Array.isArray(profile.data) && profile.data[0]) {
          sector = sector || profile.data[0].sector || profile.data[0].industry || null;
        }
        if (quote.ok && Array.isArray(quote.data) && quote.data[0]) {
          price = price || safeNum(quote.data[0].price);
          marketCap = marketCap || safeNum(quote.data[0].marketCap);
        }
      } catch (e) {
        console.log(`⚠️ [FMP兜底] ${symbol} 失败:`, e.message);
      }
    }
  
    return { sector, price, marketCap };
  }
  

  console.log(`🔎 [EarningsCalendar] 获取 ${uniqueSymbols.length} 个 symbol 详细资料中...`);

  const extraMap = new Map();
  const batchSize = 10;
  for (let i = 0; i < uniqueSymbols.length; i += batchSize) {
    const batch = uniqueSymbols.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((s) => fetchExtra(s)));
    batch.forEach((sym, idx) => extraMap.set(sym, results[idx]));
    await new Promise((r) => setTimeout(r, 500)); // 避免触发限速
  }

  // 合并信息回原列表
  list = list.map((item) => ({
    ...item,
    ...extraMap.get(item.symbol),
  }));

  // === 4️⃣ 分类 ===
  const todayStr = toISO(today);
  const yesterdayStr = toISO(new Date(today.getTime() - 86400 * 1000));
  const weekAhead = new Date(today.getTime() + 7 * 86400 * 1000);
  const monthAhead = new Date(today.getTime() + 30 * 86400 * 1000);

  const yesterday = list.filter((r) => r.date === yesterdayStr);
  const todayList = list.filter((r) => r.date === todayStr);
  const thisWeek = list.filter((r) => {
    const d = new Date(r.date);
    return d > today && d <= weekAhead;
  });
  const thisMonth = list.filter((r) => {
    const d = new Date(r.date);
    return d > weekAhead && d <= monthAhead;
  });

  return {
    ok: true,
    data: {
      yesterday,
      today: todayList,
      thisWeek,
      thisMonth,
    },
  };
}
