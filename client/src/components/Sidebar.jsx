// D:\usstocks\client\src\components\Sidebar.jsx
import React from "react";
import { useI18n } from "../i18n";

export default function Sidebar({ view, setView }) {
  const { t } = useI18n();
  const Item = ({ id, label }) => (
    <button
      onClick={() => setView(id)}
      className={`sa-nav-btn ${view === id ? "active" : ""}`}
    >
      <span className="w-4 h-4 rounded bg-white/10"></span>
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="sa-sidebar">
      <div className="section-title">{t("PORTFOLIOS", "投资组合")}</div>
      <Item id="watchlist" label={t("Watchlist", "自选股")} />
      <Item id="calendar" label={t("Earnings Calendar", "财报预告")} />
      <Item id="charts" label={t("Trends", "趋势图")} />

      <div className="section-title">{t("TOOLS", "工具")}</div>
      <Item id="alerts" label={t("Alerts", "提醒")} />
      <Item id="settings" label={t("Settings", "设置")} />
    </aside>
  );
}
