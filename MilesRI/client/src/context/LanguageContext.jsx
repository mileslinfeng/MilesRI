import React, { createContext, useContext, useState } from "react";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("zh");
  const toggleLang = () => setLang((prev) => (prev === "en" ? "zh" : "en"));
  const t = (key) => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);

const translations = {
  en: {
    title: "US Stock Earnings Tracker",
    add: "Add",
    delete: "Delete",
    view: "View Details",
    collapse: "Collapse",
    reportDate: "Report Date",
    nextEarnings: "Next Earnings",
    eps: "EPS Actual / Estimate",
    epsSurprise: "EPS Surprise%",
    revenue: "Revenue Actual / Estimate",
    revenueSurprise: "Revenue Surprise%",
    aiSummary: "AI Summary",
    symbol: "Symbol",
    inputPlaceholder: "Enter stock symbol, e.g. AAPL / NVDA / MSFT",
    loading: "Loading...",
    noData: "No data available",
    emptyList: "No watchlist items. Add stocks to begin.",
  },
  zh: {
    title: "美股财报追踪系统",
    add: "添加",
    delete: "删除",
    view: "查看详情",
    collapse: "收起详情",
    reportDate: "最新财报日期",
    nextEarnings: "预计下次财报",
    eps: "EPS 实际 / 预期",
    epsSurprise: "EPS 惊喜%",
    revenue: "收入 实际 / 预期",
    revenueSurprise: "收入惊喜%",
    aiSummary: "AI 分析",
    symbol: "股票代码",
    inputPlaceholder: "输入股票代码，例如 AAPL / NVDA / MSFT",
    loading: "加载中...",
    noData: "暂无数据",
    emptyList: "当前自选列表为空，请添加股票。",
  },
};
