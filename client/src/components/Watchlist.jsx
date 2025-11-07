// client/src/components/Watchlist.jsx
import React, { useEffect, useState } from "react";
import { showEarningsNotification } from "../utils/notifications";
import { useI18n } from "../i18n";

const CACHE_PREFIX = "earnings_";

export default function Watchlist() {
  const { lang, t } = useI18n();
  const [stocks, setStocks] = useState([]);
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    async function loadWatchlist() {
      const res = await fetch("http://localhost:5050/api/watchlist");
      const data = await res.json();
      setStocks(data || []);
    }

    // ✅ 初次加载
    loadWatchlist();

    // ✅ 监听 watchlist 更新事件
    const onUpdate = () => {
      console.log("🔄 检测到 watchlist-updated 事件，重新加载自选");
      loadWatchlist();
    };
    window.addEventListener("watchlist-updated", onUpdate);

    // ✅ 组件卸载时清理监听器
    return () => window.removeEventListener("watchlist-updated", onUpdate);
  }, []);


  const addSymbol = async () => {
    if (!input.trim()) return;
    const symbol = input.trim().toUpperCase();
    await fetch("http://localhost:5050/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol })
    });
    setInput("");
    const res = await fetch("http://localhost:5050/api/watchlist");
    setStocks(await res.json());
  };

  const removeSymbol = async (symbol) => {
    localStorage.removeItem(CACHE_PREFIX + symbol);
    await fetch(`http://localhost:5050/api/watchlist/${symbol}`, { method: "DELETE" });
    await fetch(`http://localhost:5050/api/earningsSummary/${symbol}`, { method: "DELETE" });
  
    window.dispatchEvent(new Event("watchlist-updated")); // ✅ 通知财报页刷新状态
  
    const res = await fetch("http://localhost:5050/api/watchlist");
    setStocks(await res.json());
  };
  


  return (
    <div className="sa-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSymbol()}
          placeholder={t("Enter stock symbol, e.g. AAPL", "输入股票代码，例如 AAPL")}
          className="sa-search w-[300px]"
        />
        <button onClick={addSymbol} className="lang-switch">
          {t("Add", "添加")}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="sa-table">
          <thead>
            <tr>
              <th>{t("Symbol", "股票")}</th>
              <th>{t("Report Date", "公布日")}</th>
              <th>{t("EPS A / Est", "EPS 实际/预期")}</th>
              <th>{t("EPS Surprise%", "EPS 惊喜%")}</th>
              <th>{t("Revenue", "营收")}</th>
              <th>{t("AI Analysis", "AI 分析")}</th>
              <th>{t("Next Earnings", "下次财报")}</th>
              <th className="text-right">{t("Actions", "操作")}</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => (
              <StockRow
                key={s.symbol}
                symbol={s.symbol}
                lang={lang}
                t={t}
                expanded={expanded === s.symbol}
                setExpanded={setExpanded}
                onRemove={removeSymbol}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockRow({ symbol, lang, t, expanded, setExpanded, onRemove }) {
  const [sum, setSum] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const k = CACHE_PREFIX + symbol;
    const cached = localStorage.getItem(k);
    if (cached) setSum(JSON.parse(cached).summary);
    refresh();
    // eslint-disable-next-line
  }, [symbol]);
  useEffect(() => {
    const handleUpdate = () => {
      loadWatchlist(); // ✅ 调用已有加载函数
    };
    window.addEventListener("watchlist-updated", handleUpdate);
    return () => window.removeEventListener("watchlist-updated", handleUpdate);
  }, []);

  
  async function refresh() {
    try {
      const r = await fetch(`http://localhost:5050/api/earningsSummary/${symbol}`);
      const j = await r.json();
      if (j?.ok && j.data) {
        const safeData = {
          ...j.data,
          reportedRevenue: j.data.reportedRevenue ?? 0,
          revenueEstimate: j.data.revenueEstimate ?? 0,
          nextEarningsDate: j.data.nextEarningsDate || "—"
        };
        setSum(safeData);
        localStorage.setItem(CACHE_PREFIX + symbol, JSON.stringify({ summary: safeData }));
        await showEarningsNotification(symbol, safeData.nextEarningsDate);
      } else {
        setSum(null);
      }

    } catch { }
  }

  async function toggle() {
    if (expanded) return setExpanded(null);
    setExpanded(symbol);
    if (!history) {
      setLoading(true);
      try {
        const r = await fetch(`http://localhost:5050/api/earningsHistory/${symbol}`);
        const j = await r.json();
        setHistory(j?.data || []);
      } finally {
        setLoading(false);
      }
    }
  }

  const epsSurp = Number(sum?.surprise);
  const revSurp = Number(sum?.revenueSurprise);
  const aiText = (code) => {
    const map = {
      beat: { en: "EPS significantly beat expectations", zh: "EPS 显著超出预期" },
      stable: { en: "Earnings broadly in line", zh: "盈利稳定" },
      miss: { en: "EPS missed estimates", zh: "EPS 低于市场预期" },
      neutral: { en: "Neutral performance", zh: "中性表现" }
    };
    return (map[code] || map.neutral)[lang];
  };

  return (
    <>
      <tr>
        <td className="font-semibold text-blue-700">{symbol}</td>
        <td>{sum?.lastReportDate || "—"}</td>
        <td>
          {sum?.reportedEPS ?? "—"} / {sum?.estimatedEPS ?? "—"}
        </td>
        <td className={epsSurp > 0 ? "positive" : epsSurp < 0 ? "negative" : ""}>
          {Number.isFinite(epsSurp) ? `${epsSurp}%` : "—"}
        </td>
        <td>{money(sum?.reportedRevenue)}</td>

        <td className="flex items-center gap-1">
          {sum?.aiCode === "beat" && (
            <img
              src="/pic/up_green.png"
              alt="up"
              style={{
                width: "14px",
                height: "14px",
                objectFit: "contain",
                display: "inline-block",
              }}
            />
          )}
          {sum?.aiCode === "miss" && (
            <img
              src="/pic/down_red.png"
              alt="down"
              style={{
                width: "14px",
                height: "14px",
                objectFit: "contain",
                display: "inline-block",
              }}
            />
          )}
          {(!sum?.aiCode || sum?.aiCode === "stable" || sum?.aiCode === "neutral") && (
            <span className="text-gray-400 text-xs">—</span>
          )}
          <span className="text-[12px] leading-none">{aiText(sum?.aiCode)}</span>
        </td>
        <td>{sum?.nextEarningsDate || t("Unknown", "未知")}</td>
        <td className="text-right">
          <button className="text-blue-600 hover:underline mr-3" onClick={toggle}>
            {expanded ? t("Collapse", "收起") : t("View", "详情")}
          </button>
          <button className="text-red-600 hover:underline" onClick={() => onRemove(symbol)}>
            {t("Delete", "删除")}
          </button>
        </td>
      </tr >

      {expanded && (
        <tr>
          <td colSpan={9} className="bg-gray-50">
            {loading ? (
              <div className="p-4 text-gray-500">{t("Loading…", "加载中…")}</div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 text-[13px] mb-3">
                  <p>
                    <b>{t("Fiscal End", "季度结束")}:</b> {sum?.fiscalDateEnding || "—"}
                  </p>
                  <p>
                    <b>EPS:</b> {sum?.reportedEPS ?? "—"} / {sum?.estimatedEPS ?? "—"}
                  </p>
                  <p>
                    <b>{t("Revenue", "营收")}:</b> {money(sum?.reportedRevenue)}
                  </p>

                  <p className="md:col-span-3">
                    <b>AI:</b> {aiText(sum?.aiCode)}
                  </p>
                </div>

                {/* 季度列表（Q1–Q4…） */}
                <div className="overflow-x-auto">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>{t("Quarter", "季度")}</th>
                        <th>{t("Report Date", "公布日")}</th>
                        <th>{t("EPS A / Est", "EPS 实际/预期")}</th>
                        <th>{t("Surprise%", "惊喜%")}</th>
                        <th>{t("Revenue", "营收")}</th>
                        <th>{t("AI", "AI")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history || []).map((r) => (
                        <tr key={r.fiscalDateEnding + r.reportedDate}>
                          <td>{fiscalToQ(r.fiscalDateEnding)}</td>
                          <td>{r.reportedDate || "—"}</td>
                          <td>
                            {r.reportedEPS ?? "—"} / {r.estimatedEPS ?? "—"}
                          </td>
                          <td className={num(r.surprise) > 0 ? "positive" : num(r.surprise) < 0 ? "negative" : ""}>
                            {Number.isFinite(num(r.surprise)) ? `${num(r.surprise)}%` : "—"}
                          </td>
                          <td>{money(r.revenue)}</td>
                          <td>{aiShort(lang, r.aiCode)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </td>
        </tr>
      )
      }
    </>
  );
}

/* ------- helpers ------- */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? +n.toFixed(2) : NaN;
}

// 智能单位：K / M / B / T
// 智能单位：K / M / B / T
function money(v) {
  const n = Number(v);
  // 👇 新增条件：如果不是数字或为 0，则显示短横线
  if (!Number.isFinite(n) || n === 0) return "—";

  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}


function fiscalToQ(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  const m = d.getUTCMonth() + 1;
  const y = d.getUTCFullYear();
  const q = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4;
  return `${y}/Q${q}`;
}

function aiShort(lang, code) {
  const map = {
    beat: { en: "Beat", zh: "超预期" },
    stable: { en: "In-line", zh: "基本符合" },
    miss: { en: "Miss", zh: "低于预期" },
    neutral: { en: "Neutral", zh: "中性" }
  };
  return (map[code] || map.neutral)[lang];
}
