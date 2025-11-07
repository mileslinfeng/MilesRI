import React, { useState, useRef } from "react";
import Layout from "./components/Layout";
import Watchlist from "./components/Watchlist";
import EarningsCalendar from "./components/EarningsCalendar";
import EarningsChart from "./components/EarningsChart";
import { useI18n } from "./i18n";

export default function App() {
  const [view, setView] = useState("watchlist");
  const { t } = useI18n(); // ✅ 全局翻译函数

  // ✅ 缓存每个组件，防止被卸载（状态丢失）
  const cacheRef = useRef({});

  const getViewComponent = (key, Component) => {
    if (!cacheRef.current[key]) {
      cacheRef.current[key] = <Component />;
    }
    return cacheRef.current[key];
  };

  return (
    <Layout view={view} setView={setView}>
      <div style={{ display: view === "watchlist" ? "block" : "none" }}>
        {getViewComponent("watchlist", Watchlist)}
      </div>

      <div style={{ display: view === "calendar" ? "block" : "none" }}>
        {getViewComponent("calendar", EarningsCalendar)}
      </div>

      <div style={{ display: view === "charts" ? "block" : "none" }}>
        {getViewComponent("charts", EarningsChart)}
      </div>

      <div style={{ display: view === "alerts" ? "block" : "none" }}>
        <div className="sa-card p-6 text-gray-700">
          {t("Alert center coming soon…", "提醒功能即将上线…")}
        </div>
      </div>

      <div style={{ display: view === "settings" ? "block" : "none" }}>
        <div className="sa-card p-6 text-gray-700">
          {t("Settings panel coming soon…", "设置面板即将上线…")}
        </div>
      </div>
    </Layout>
  );
}
