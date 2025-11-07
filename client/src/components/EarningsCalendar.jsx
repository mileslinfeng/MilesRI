import React, { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import DatePicker, { registerLocale } from "react-datepicker";
import zhCN from "date-fns/locale/zh-CN";
import enUS from "date-fns/locale/en-US";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("zh-CN", zhCN);
registerLocale("en-US", enUS);
// 放在文件顶部 import 之后

// 统一：把各种写法映射成一个“标准key”
// 注意：只在这里维护，其他地方一律用标准key
const SECTOR_ALIASES = {
  // 工业
  "Industrial": "Industrial",
  "Industrials": "Industrial",

  // 金融
  "Financial": "Financial",
  "Financials": "Financial",
  "Financial Services": "Financial Services",

  // 消费（可选把大消费拆成两类；按你数据情况选择）
  "Consumer": "Consumer",
  "Consumer Discretionary": "Consumer",   // 可选：归到Consumer
  "Consumer Cyclical": "Consumer",        // 可选
  "Consumer Defensive": "Consumer Defensive",
  "Consumer Staples": "Consumer Defensive", // 可选：归到防御消费

  // 科技
  "Technology": "Technology",
  "Tech": "Technology",

  // 医疗
  "Healthcare": "Healthcare",
  "Health Care": "Healthcare",
  // 原材料
  "Materials": "Basic Materials",
  "Basic Materials": "Basic Materials",

  // 通信
  "Communication Services": "Communication Services",
  "Telecommunication Services": "Communication Services",

  // 能源
  "Energy": "Energy",

  // 公用
  "Utilities": "Utilities",

  // 房地产
  "Real Estate": "RealEstate",
  "RealEstate": "RealEstate",

  // 兜底
  "N/A": "Unknown",
  "NA": "Unknown",
  "": "Unknown",
  "Unknown": "Unknown",
};

// 中文显示表（key 一律用“标准key”）
const SECTOR_LABEL_ZH = {
  "Industrial": "工业",
  "Financial": "金融",
  "Financial Services": "金融服务",
  "Consumer": "消费",
  "Consumer Defensive": "必需消费",
  "Technology": "科技",
  "Healthcare": "医疗",
  "Communication Services": "通信服务",
  "Energy": "能源",
  "Utilities": "公用事业",
  "RealEstate": "房地产",
  "Basic Materials": "基础材料",

  "Unknown": "未知",
};

// —— 把原始 sector 规范化成标准key —— //
function normalizeSector(raw) {
  if (raw == null) return "Unknown";
  const s = String(raw).trim();
  if (!s || s.toUpperCase() === "N/A") return "Unknown";
  return SECTOR_ALIASES[s] || s; // 未列出别名的，直接当作标准key使用
}
function makeLocalDate(date) {
  if (!date) return "";
  // 提取本地年月日
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  // 重新构造为本地 00:00，不经过 UTC
  const local = new Date(y, m, d, 12, 0, 0, 0); // 中午确保跨时区安全
  return local.toLocaleDateString("en-CA");
}
// —— 根据语言把标准key渲染成最终文案 —— //
function renderSectorLabel(key, lang) {
  if (!key || key === "Unknown") return lang === "zh" ? "未知" : "Unknown";
  if (lang === "zh") return SECTOR_LABEL_ZH[key] || key; // 未覆盖的回退原词
  return key; // 英文直接显示key
}

// === 浏览器通知授权 ===
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// === 通知触发 ===
function showNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
  // 可选：语音播报
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(`${title}。${body}`);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  }
}

export default function EarningsCalendar() {
  const { lang, t } = useI18n();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [marketCapFilter, setMarketCapFilter] = useState("");
  const [reminders, setReminders] = useState([]);
  const [priceFilter, setPriceFilter] = useState("");
  const [sectorList, setSectorList] = useState([]);
  const [sectorOptions, setSectorOptions] = useState([]); // 用标准key存
  const [symbolFilter, setSymbolFilter] = useState(""); // 股票代码输入
  const [watchlistSymbols, setWatchlistSymbols] = useState([]);
  const [lastFilterSummary, setLastFilterSummary] = useState({});

  // 从 localStorage 恢复筛选状态
  useEffect(() => {
    const savedFilters = JSON.parse(localStorage.getItem("earnings_filters") || "{}");
    if (savedFilters) {
      setFromDate(savedFilters.fromDate || "");
      setToDate(savedFilters.toDate || "");
      setSectorFilter(savedFilters.sectorFilter || "");
      setMarketCapFilter(savedFilters.marketCapFilter || "");
      setPriceFilter(savedFilters.priceFilter || {});
      setSymbolFilter(savedFilters.symbolFilter || "");
    }
  }, []);
  // ✅ 页面加载时读取自选列表
  useEffect(() => {
    async function loadWatchlistSymbols() {
      try {
        const res = await fetch("http://localhost:5050/api/watchlist");
        const list = await res.json();
        const symbols = list.map((x) => x.symbol);
        setWatchlistSymbols(symbols);
      } catch (e) {
        console.warn("⚠️ 无法加载自选列表", e);
      }
    }
    loadWatchlistSymbols();

    // ✅ 监听 watchlist 更新事件自动刷新
    const onUpdate = () => loadWatchlistSymbols();
    window.addEventListener("watchlist-updated", onUpdate);
    return () => window.removeEventListener("watchlist-updated", onUpdate);
  }, []);

  // 监听筛选条件变化并自动保存
  useEffect(() => {
    localStorage.setItem(
      "earnings_filters",
      JSON.stringify({ fromDate, toDate, sectorFilter, marketCapFilter, priceFilter, symbolFilter })
    );
  }, [fromDate, toDate, sectorFilter, marketCapFilter, priceFilter, symbolFilter]);

  // ✅ 页面初始化时加载板块列表（不触发筛选）
  useEffect(() => {
    async function loadSectors() {
      try {
        const res = await fetch("http://localhost:5050/api/earningsCalendar");
        const json = await res.json();
        if (!json || !json.data) return;
        const normalized = json.data.map(it => normalizeSector(it.sector));
        const unique = Array.from(new Set(normalized.filter(s => s && s !== "Unknown"))).sort();
        setSectorOptions(unique);
        console.log("✅ 初始化板块加载:", unique);
      } catch (err) {
        console.error("❌ 板块加载失败:", err);
      }
    }
    loadSectors();
  }, []);

  async function fetchCalendar(customFrom, customTo, customSector, customCap, customPrice, customSymbol) {
    console.log("🔵 [fetchCalendar] 开始请求 /api/earningsCalendar");
    const res = await fetch("http://localhost:5050/api/earningsCalendar");
    const json = await res.json();
    setLoading(true);
    try {
      let merged = Array.isArray(json.data) ? json.data : [];
      const normalized = merged.map(it => ({ ...it, _sector: normalizeSector(it.sector) }));
      let filtered = normalized;

      // 股票代码筛选
      if (customSymbol) {
        filtered = filtered.filter((item) =>
          item.symbol && item.symbol.toUpperCase().includes(customSymbol.toUpperCase())
        );
        console.log("🔠 股票代码筛选后:", filtered.length);
      }





      // === 日期筛选（纯字符串比较，防止时区误差） ===
      if (customFrom && customTo) {
        const from = new Date(customFrom + "T00:00");
        const to = new Date(customTo + "T23:59");
        filtered = filtered.filter((item) => {
          const d = new Date(item.date + "T00:00");
          return d >= from && d <= to;
        });
      }





      // 板块筛选
      if (customSector) {
        filtered = filtered.filter((item) => item._sector === customSector);
      }

      // 市值筛选
      if (customCap) {
        filtered = filtered.filter((item) => {
          const cap = Number(item.marketCap);
          if (!cap) return false;
          if (customCap === "micro1") return cap < 5e7; // < $50M
          if (customCap === "micro2") return cap >= 5e7 && cap < 2e8; // $50M–$200M
          if (customCap === "micro3") return cap >= 2e8 && cap < 2e9; // $200M–$2B
          if (customCap === "mid") return cap >= 2e9 && cap <= 1e10; // $2B–$10B
          if (customCap === "large") return cap > 1e10; // > $10B
          return true;
        });
      }



      // 股价筛选（支持自定义区间）
      if (customPrice && (customPrice.min || customPrice.max)) {
        filtered = filtered.filter((item) => {
          const price = Number(item.price);
          if (!price || isNaN(price)) return false;

          const min = Number(customPrice.min) || 0;
          const max = Number(customPrice.max) || Infinity;
          return price >= min && price <= max;
        });
      }


      setData(filtered.sort((a, b) => new Date(a.date) - new Date(b.date)));


      // ✅ 板块选项基于后台完整数据，而不是筛选结果
      const allSectors = normalized
        .map(it => normalizeSector(it.sector))
        .filter(s => s && s !== "Unknown");
      const uniqueSectors = Array.from(new Set(allSectors)).sort();
      setSectorOptions(uniqueSectors);
      console.log("✅ 板块选项（来自后台JSON）:", uniqueSectors);


    } catch (err) {
      console.error("❌ Fetch calendar error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }




  // === 筛选操作 ===
  const handleFilter = () => {
    console.log("🟡 [handleFilter] 被点击");
    console.log("📅 fromDate:", fromDate, "→ toDate:", toDate);
    console.log("🏭 sectorFilter:", sectorFilter);
    console.log("💰 marketCapFilter:", marketCapFilter);
    console.log("💵 priceFilter:", priceFilter);
    console.log("🔠 symbolFilter:", symbolFilter);

    if (
      !fromDate &&
      !toDate &&
      !sectorFilter &&
      !marketCapFilter &&
      !priceFilter?.min &&
      !priceFilter?.max &&
      !symbolFilter
    ) {
      alert("请设置至少一个筛选条件，例如日期、板块或价格区间");
      return;
    }
    // 🔒 锁定当前筛选条件，防止后续切换下拉框影响文本总结
    setLastFilterSummary({ fromDate, toDate, sectorFilter, marketCapFilter, priceFilter, symbolFilter });

    fetchCalendar(fromDate, toDate, sectorFilter, marketCapFilter, priceFilter, symbolFilter);
  };


  const handleReset = async () => {
    setFromDate("");
    setToDate("");
    setSectorFilter("");
    setMarketCapFilter("");
    setPriceFilter({});
    setSymbolFilter(""); // ✅ 同时清空股票输入框
    setData([]); // ✅ 清空表格数据
  };

  // ✅ 实时筛选（自动执行，不需点击按钮）
  const handleAutoFilter = (symbol, from, to, sector, cap, price) => {
    fetchCalendar(from, to, sector, cap, price, symbol);
  };

  // === 添加自选 ===
  const addToWatchlist = async (symbol) => {
    // ✅ 立即本地更新（防止用户连续点击）
    setWatchlistSymbols((prev) => Array.from(new Set([...prev, symbol])));

    try {
      await fetch("http://localhost:5050/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });

      // ✅ 通知自选列表刷新
      window.dispatchEvent(new Event("watchlist-updated"));
    } catch (e) {
      console.error(e);
      // 失败时恢复按钮
      setWatchlistSymbols((prev) => prev.filter((x) => x !== symbol));
      alert("❌ 添加失败，请稍后重试");
    }
  };



  // === 设置提醒 ===
  const addReminder = (symbol, date) => {
    const d = new Date(date);
    const diffMs = d - new Date();
    if (diffMs < 0) {
      alert(`${symbol} 已经公布，无法设置提醒`);
      return;
    }
    const reminder = { symbol, date: d.toISOString() };
    const newReminders = [...reminders, reminder];
    setReminders(newReminders);
    localStorage.setItem("earnings_reminders", JSON.stringify(newReminders));
    alert(`🔔 ${t("Reminder set", "已为")} ${symbol} ${t("set", "设置提醒")}`);
  };

  // === 检查提醒时间 ===
  function checkReminders() {
    const now = new Date();
    const saved = JSON.parse(localStorage.getItem("earnings_reminders") || "[]");
    saved.forEach((r) => {
      const d = new Date(r.date);
      const diff = d - now;
      if (diff <= 5 * 60 * 1000 && diff > 0) {
        showNotification(
          t("Earnings Reminder", "财报提醒"),
          lang === "zh"
            ? `${r.symbol} 将在 5 分钟内公布财报！`
            : `${r.symbol} will report in 5 minutes!`
        );
      }
    });
  }


  // === 倒计时逻辑 ===
  const getCountdown = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";

    // 避免因为时区误差少一天
    d.setHours(23, 59, 59, 999);

    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return lang === "zh" ? "已公布" : "Reported";
    if (diff === 0) return lang === "zh" ? "今日公布" : "Today";
    return lang === "zh" ? `${diff} 天` : `${diff} days`;
  };


  return (
    <div className="sa-card p-6">
      <h2 className="text-[22px] font-bold mb-4 flex items-center border-b pb-2">
        <span className="mr-2">📅</span> {t("US Earnings Calendar", "美股财报预告")}
      </h2>

      {/* === 筛选栏 === */}
      <div
        className="border border-gray-200 bg-gray-50 rounded-lg p-3"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          alignItems: "center",
          marginBottom: "30px", // ✅ ← 手动设置表格与筛选栏的间距
        }}
      >
        {/* 股票代码输入 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">{t("Symbol:", "股票代码:")}</label>
          <input
            type="text"
            value={symbolFilter}
            onChange={(e) => {
              const v = e.target.value.trim().toUpperCase();
              setSymbolFilter(v);
              if (v === "") {
                setData([]);
              } else {
                handleAutoFilter(v, fromDate, toDate, sectorFilter, marketCapFilter, priceFilter);
              }
            }}
            placeholder={t("Enter stock symbol, e.g. AAPL", "输入股票代码，例如 AAPL")}
            className="sa-filter-input"
            autoComplete="off"
          />
        </div>

        {/* 起始日期 */}
        <div className="flex items-center gap-1">
          <label className="text-sm text-gray-600">{t("From:", "起始日期:")}</label>
          <DatePicker
            selected={fromDate ? new Date(fromDate + "T12:00") : null}
            onChange={(date) => setFromDate(makeLocalDate(date))}
            locale={lang === "zh" ? "zh-CN" : "en-US"}
            dateFormat="yyyy/MM/dd"
            placeholderText={t("Select start date", "选择起始日期")}
            className="sa-filter-input w-[140px]"
          />
        </div>

        {/* 结束日期 */}
        <div className="flex items-center gap-1">
          <label className="text-sm text-gray-600">{t("To:", "结束日期:")}</label>
          <DatePicker
            selected={toDate ? new Date(toDate + "T12:00") : null}
            onChange={(date) => setToDate(makeLocalDate(date))}
            locale={lang === "zh" ? "zh-CN" : "en-US"}
            dateFormat="yyyy/MM/dd"
            placeholderText={t("Select end date", "选择结束日期")}
            className="sa-filter-input w-[140px]"
          />
        </div>

        {/* 板块筛选 */}
        <div className="flex items-center gap-1">
          <label className="text-sm text-gray-600">{t("Sector:", "所属板块:")}</label>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="sa-filter-input"
          >
            <option value="">{t("All Sectors", "全部板块")}</option>
            {sectorOptions.concat(["Unknown"]).map((key) => (
              <option key={key} value={key}>
                {renderSectorLabel(key, lang)}
              </option>
            ))}

          </select>
        </div>

        {/* 市值筛选 */}
        <div className="flex items-center gap-1">
          <label className="text-sm text-gray-600">{t("Market Cap:", "市值区间:")}</label>
          <select
            value={marketCapFilter}
            onChange={(e) => setMarketCapFilter(e.target.value)}
            className="sa-filter-input"
          >
            <option value="">{t("All Market Caps", "全部市值")}</option>
            <option value="micro1">{t("Micro (< $50M)", "超小盘（< $50M）")}</option>
            <option value="micro2">{t("Micro ($50M–$200M)", "微盘（$50M–$200M）")}</option>
            <option value="micro3">{t("Small ($200M–$2B)", "小盘（$200M–$2B）")}</option>
            <option value="mid">{t("Mid ($2B–$10B)", "中盘（$2B–$10B）")}</option>
            <option value="large">{t("Large (> $10B)", "大盘（> $10B）")}</option>
          </select>

        </div>

        {/* 股价筛选 */}
        {/* 股价筛选 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">{t("Price Range:", "股价区间:")}</label>

          <input
            type="number"
            placeholder={t("Min Price", "最低价")}
            value={priceFilter?.min || ""}
            onChange={(e) =>
              setPriceFilter((prev) => ({
                ...prev,
                min: e.target.value,
              }))
            }
            className="sa-filter-input w-[90px]"
          />

          <span className="text-gray-500">—</span>

          <input
            type="number"
            placeholder={t("Max Price", "最高价")}
            value={priceFilter?.max || ""}
            onChange={(e) =>
              setPriceFilter((prev) => ({
                ...prev,
                max: e.target.value,
              }))
            }
            className="sa-filter-input w-[90px]"
          />
        </div>


        {/* 按钮区域 */}
        <div className="flex gap-2 ml-auto">
          <button onClick={handleFilter} className="sa-filter-btn primary">
            {t("Filter", "🔍 筛选")}
          </button>
          <button onClick={handleReset} className="sa-filter-btn secondary">
            {t("Reset", "♻️ 重置")}
          </button>
        </div>
      </div>


      {/* === 数据表格 === */}
      {loading ? (
        <div className="text-gray-500">数据加载中，请稍候...</div>
      ) : (
        <>
          {/* === 筛选结果总结 === */}
          {data.length > 0 && (
            <div className="text-sm text-gray-600 mb-3 bg-gray-50 border border-gray-200 rounded-md p-2">
              <b>筛选结果：</b>
              {lastFilterSummary.fromDate && lastFilterSummary.toDate && (
                <>时间区间：<span className="text-blue-700">{lastFilterSummary.fromDate}</span> 至 <span className="text-blue-700">{lastFilterSummary.toDate}</span>｜</>
              )}
              {lastFilterSummary.sectorFilter && (
                <>板块：<span className="text-blue-700">{renderSectorLabel(lastFilterSummary.sectorFilter, lang)}</span>｜</>
              )}
              {lastFilterSummary.marketCapFilter && (
                <>市值区间：<span className="text-blue-700">
                  {lastFilterSummary.marketCapFilter === "micro1" && "< $50M"}
                  {lastFilterSummary.marketCapFilter === "micro2" && "$50M–$200M"}
                  {lastFilterSummary.marketCapFilter === "micro3" && "$200M–$2B"}
                  {lastFilterSummary.marketCapFilter === "mid" && "$2B–$10B"}
                  {lastFilterSummary.marketCapFilter === "large" && "> $10B"}
                </span>｜
                </>
              )}
              共 <span className="font-semibold text-blue-700">{data.length}</span> 只股票
            </div>
          )}


          {/* === 表格区域 === */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
              {data.length === 0 ? (
                <p className="p-4 text-gray-500 text-sm">
                  {t(
                    "No data loaded yet. Please set filters and click",
                    "尚未加载数据，请设置筛选条件后点击"
                  )}{" "}
                  <span className="font-semibold text-blue-600">
                    {t("🔍 Filter", "🔍 筛选")}
                  </span>。
                </p>
              ) : (

                <table className="sa-table w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th>{t("Symbol", "股票")}</th>
                      <th>{t("Sector", "所属板块")}</th>
                      <th>{t("Price", "当前股价")}</th>
                      <th>{t("Market Cap", "当前市值")}</th>
                      <th>{t("Report Date", "公布日期")}</th>
                      <th>{t("Countdown", "倒计时")}</th>
                      <th>{t("EPS Est", "EPS预期")}</th>
                      <th>{t("Revenue Est", "营收预期")}</th>
                      <th>{t("Actions", "操作")}</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {data.map((item, i) => (
                      <tr key={`${item.symbol}-${i}`} className="hover:bg-blue-50 transition">
                        <td className="px-4 py-2 font-semibold text-blue-700">{item.symbol}</td>
                        <td className="px-4 py-2 text-gray-700">
                          {renderSectorLabel(item._sector, lang)}
                        </td>


                        <td className="px-4 py-2 text-gray-700">{item.price ? `$${item.price}` : "—"}</td>
                        <td className="px-4 py-2 text-gray-700">{formatMoney(item.marketCap)}</td>
                        <td className="px-4 py-2 text-gray-700">{item.date || "—"}</td>
                        <td className="px-4 py-2 text-gray-700">{getCountdown(item.date)}</td>
                        <td className="px-4 py-2 text-gray-700">{item.eps ?? "—"}</td>
                        <td className="px-4 py-2 text-gray-700">{formatMoney(item.revenue)}</td>
                        <td className="px-4 py-2 flex gap-2">
                          {watchlistSymbols.includes(item.symbol) ? (
                            <button disabled className="text-gray-400 cursor-not-allowed">
                              ✅ {t("  A d d e d  ", "已加")}
                            </button>
                          ) : (
                            <button
                              className="text-blue-600 hover:underline"
                              onClick={() => addToWatchlist(item.symbol)}
                            >
                              ➕ {t("Watchlist", "自选")}
                            </button>
                          )}

                          <button
                            className="text-orange-600 hover:underline"
                            onClick={() => addReminder(item.symbol, item.date)}
                          >
                            🔔 {t("Reminder", "提醒")}
                          </button>

                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// 💰 格式化金额
function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}
// === 动态翻译行业名称 ===
function translateSectorName(sector) {
  if (!sector) return "—";
  const dict = {
    Technology: "科技",
    Healthcare: "医疗",
    Energy: "能源",
    Financial: "金融",
    "Financial Services": "金融服务",
    "Consumer Defensive": "必需消费",
    "Consumer Cyclical": "周期性消费",
    "Communication Services": "通信服务",
    Industrial: "工业",
    Utilities: "公用事业",
    Materials: "基础材料",
    "Real Estate": "房地产",
    "Basic Materials": "基础材料",
    "Consumer Discretionary": "可选消费",
    "Consumer Staples": "必需消费",
    "Information Technology": "信息科技",
    "Telecommunication Services": "电信服务",
    "Financial Sector": "金融板块",
  };
  return dict[sector] || sector;
}
