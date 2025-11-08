// client/src/components/Settings.jsx
if (json.remainingMinutes !== undefined) {
    setRefreshMsg(`⏳ 请 ${json.remainingMinutes} 分钟后再试`);
  }
import React, { useState } from "react";

export default function Settings({ t }) {
  const [refreshMsg, setRefreshMsg] = useState("");

  const handleManualRefresh = async () => {
    setRefreshMsg("正在刷新，请稍候…");
    try {
      const res = await fetch("http://localhost:5050/api/earningsCalendar/refresh");
      const json = await res.json();
      if (json.ok) {
        setRefreshMsg("✅ 财报数据刷新成功");
      } else {
        // ⏳ 如果后端返回剩余分钟数
        if (json.remainingMinutes !== undefined) {
          setRefreshMsg(`⏳ 请 ${json.remainingMinutes} 分钟后再试`);
        } else {
          setRefreshMsg(`⚠️ ${json.msg || "刷新失败"}`);
        }
      }
    } catch (err) {
      setRefreshMsg("❌ 网络错误，请检查服务器连接");
    }
  };
  

  return (
    <div className="sa-card p-6">
      <h2 className="text-[22px] font-bold mb-4 border-b pb-2">⚙️ {t("Settings", "设置")}</h2>
      <div className="flex flex-col gap-4 text-gray-700 text-sm">
        <p>{t("Manual backend refresh", "手动刷新后台缓存（仅管理员）")}</p>
        <button
          onClick={handleManualRefresh}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
        >
          🔄 {t("Refresh Now", "立即刷新")}
        </button>
        {refreshMsg && <div className="text-gray-600 mt-2">{refreshMsg}</div>}
      </div>
    </div>
  );
}
