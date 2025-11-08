import React, { useEffect, useState } from "react";
import { useI18n } from "../i18n";

export default function HoldingsTable() {
  const { t } = useI18n();
  const { formatCurrency, formatPrice, formatDate } = useFormatters();

  const [stocks, setStocks] = useState([]);

  async function load() {
    const res = await fetch("http://localhost:5050/api/watchlist");
    const data = await res.json();
    setStocks(data || []);
  }

  useEffect(() => { load(); }, []);



  return (
    <div className="overflow-x-auto bg-white shadow-md rounded-xl border border-gray-200 mt-4">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
          <tr>
            <th className="p-3">{t("Symbol", "股票")}</th>
            <th className="p-3">{t("EPS", "每股收益")}</th>
            <th className="p-3">{t("EPS Surprise%", "EPS惊喜%")}</th>
            <th className="p-3">{t("Revenue", "营收")}</th>
            <th className="p-3">{t("Next Report", "下次财报")}</th>
            <th className="p-3">{t("AI Summary", "AI分析")}</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s, i) => (
            <tr key={i} className="hover:bg-gray-50 border-b text-gray-700">
              <td className="p-3 font-semibold text-blue-600">{s.symbol}</td>
              <td className="p-3">{s.reportedEPS || "—"}</td>
              <td className={`p-3 ${Number(s.surprise) > 0 ? "text-green-600" : "text-red-600"}`}>
                {s.surprise ? `${s.surprise}%` : "—"}
              </td>
              <td className="p-3">{s.reportedRevenue ? `$${(s.reportedRevenue / 1e9).toFixed(2)}B` : "—"}</td>
              <td className="p-3">{s.nextEarningsDate || "—"}</td>
              <td className="p-3">{s.aiSummary || t("Loading...", "加载中...")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
