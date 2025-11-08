import React, { useEffect, useState } from "react";
import "../styles/financeTable.css";

export default function CalendarView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://localhost:5050/api/earningsCalendar");
        const json = await res.json();
        if (!json.ok) throw new Error(json.message || "加载失败");
        setData(json.data);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading)
    return (
      <div className="flex justify-center items-center h-64 text-gray-600">
        正在加载财报预告数据...
      </div>
    );

  if (error)
    return (
      <div className="text-center text-red-500 mt-10">
        加载失败：{error}
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3">
        📅 财报预告视图
      </h1>

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <table className="w-full text-sm text-gray-700">
          <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">股票</th>
              <th className="px-4 py-3 text-left">财报公布日期</th>
              <th className="px-4 py-3 text-left">季度结束</th>
              <th className="px-4 py-3 text-left">EPS 实际 / 预期</th>
              <th className="px-4 py-3 text-left">营收</th>
              <th className="px-4 py-3 text-left">发布时间</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr
                key={i}
                className="hover:bg-gray-50 border-b transition duration-150"
              >
                <td className="px-4 py-3 font-semibold text-blue-700">
                  {item.symbol}
                </td>
                <td className="px-4 py-3">{item.reportDate || "未知"}</td>
                <td className="px-4 py-3">{item.fiscalQuarter || "—"}</td>
                <td className="px-4 py-3">
                  {item.eps || "—"} / {item.epsEstimated || "—"}
                </td>
                <td className="px-4 py-3">{item.revenue}</td>
                <td className="px-4 py-3">{item.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
