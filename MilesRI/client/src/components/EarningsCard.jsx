import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

export default function EarningsCard({ symbol }) {
  const { t } = useI18n();
  const [q, setQ] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCal, setNextCal] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const e = await api.getEarnings(symbol);
        const list = e?.data?.quarterlyEarnings || [];
        if (alive) setQ(list.slice(0, 4)); // 最近 4 季
        const cal = await api.getCalendarBySymbol(symbol);
        const arr = Array.isArray(cal) ? cal : (cal?.data?.earningsCalendar || cal?.data || []);
        if (alive) setNextCal(arr);
      } catch (_) { }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [symbol]);

  return (
    <div className="rounded-2xl shadow p-4 border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{symbol}</h3>
        {nextCal?.length > 0 ? (
          <span className="text-sm px-2 py-1 rounded bg-gray-100">
            Next: {nextCal[0]?.reportDate} {nextCal[0]?.reportTime ? `(${nextCal[0].reportTime})` : ""}
          </span>
        ) : (
          <span className="text-sm text-gray-500">
            {t("No upcoming in 3 months", "未来三个月暂无预告")}
          </span>
        )}
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">{t("Loading…", "加载中…")}</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-1">{t("Quarter", "季度")}</th>
                <th className="py-1">{t("Report Date", "公布日")}</th>
                <th className="py-1">{t("EPS (Actual / Est)", "EPS（实际/预期）")}</th>
                <th className="py-1">{t("Surprise %", "惊喜%")}</th>
              </tr>
            </thead>
            <tbody>
              {q.map((row, idx) => (
                <tr key={idx} className="border-t">
                  <td className="py-1">{row.fiscalDateEnding} Q{row.reportedQuarter}</td>
                  <td className="py-1">{row.reportedDate}</td>
                  <td className="py-1">
                    {row.reportedEPS} / {row.estimatedEPS ?? "—"}
                  </td>
                  <td className={`py-1 ${Number(row.surprisePercentage) > 0 ? "text-green-600" : "text-red-600"}`}>
                    {row.surprisePercentage ?? "—"}
                  </td>
                </tr>
              ))}
              {q.length === 0 && (
                <tr><td className="py-2 text-gray-500" colSpan={4}>
                  {t("No quarterly data", "暂无季度数据")}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
