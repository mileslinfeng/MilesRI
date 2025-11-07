import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, ResponsiveContainer
} from "recharts";
import { useI18n } from "../i18n";

export default function EarningsChart() {
  const { t } = useI18n();
  const [symbol, setSymbol] = useState("AAPL");
  const [data, setData] = useState([]);

  useEffect(() => {
    async function loadChart() {
      try {
        const res = await fetch(`http://localhost:5050/api/earningsHistory/${symbol}`);
        const json = await res.json();

        // ✅ 确保按时间升序排列（旧→新）
        const sorted = (json.data || []).sort(
          (a, b) => new Date(a.fiscalDateEnding) - new Date(b.fiscalDateEnding)
        );
        
        setData(sorted);
        
      } catch (e) {
        console.error("❌ Failed to load chart data:", e);
      }
    }
    loadChart();
  }, [symbol]);

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">
        {t("EPS & Revenue History", "📊 EPS & 收入历史趋势")}
      </h2>
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="border px-3 py-2 rounded-lg"
          placeholder={t("Enter symbol, e.g. AAPL", "输入股票代码，如 AAPL")}
        />
      </div>

      {data.length === 0 ? (
        <p className="text-gray-500">{t("No data", "暂无历史数据")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fiscalDateEnding" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="reportedEPS"
              stroke="#2563eb"
              name={t("EPS", "每股收益")}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="totalRevenue"
              stroke="#16a34a"
              name={t("Revenue", "营收")}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
