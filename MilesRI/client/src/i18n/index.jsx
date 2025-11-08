// client/src/i18n/index.jsx
import React from "react";
import { createContext, useContext, useMemo, useEffect, useState, useCallback } from "react";

const DICT = {
  en: {
    app_title: "US Stocks Earnings Suite",
    loading: "Loading data, please wait...",
    actions: "Actions",
    reset: "Reset",
    filter: "Filter",
    add_watch: "Add to Watchlist",
    remind: "Reminder",
    from: "From",
    to: "To",
    all: "All",
    sector: "Sector",
    market_cap: "Market Cap",
    price_range: "Price Range",
    low_price: "Low (< $5)",
    mid_price: "Mid ($5–$50)",
    high_price: "High (> $50)",
    small_cap: "Small (< $2B)",
    mid_cap: "Mid ($2B–$10B)",
    large_cap: "Large (> $10B)",
    no_data_hint: "No data yet. Choose filters then click Filter.",
    invalid_symbol: "Invalid symbol",
    added_and_synced: "Added to watchlist and synced earnings summary",
    add_failed: "Add failed, please try again later",
    already_reported: "has been reported, cannot set reminder",
    reminder_set: "Reminder set",
    earnings_reminder: "Earnings Reminder",
    in_5_mins: "will report in 5 minutes!",
    today_report: "Report Today",
    reported: "Reported",
    days_left: "days left",
    nav_calendar: "Earnings Calendar",
    nav_watchlist: "Watchlist",
    nav_holdings: "Holdings",
    nav_chart: "Earnings Chart",
    settings: "Settings",
    language: "Language",
    chinese: "Chinese",
    english: "English",
    th_symbol: "Ticker",
    th_sector: "Sector",
    th_price: "Price",
    th_mktcap: "Market Cap",
    th_date: "Report Date",
    th_countdown: "Countdown",
    th_eps: "EPS Est",
    th_rev: "Revenue Est",
    pick_filters_first: "Please select filters first",
  },
  zh: {
    app_title: "美股财报 Pro",
    loading: "数据加载中，请稍候...",
    actions: "操作",
    reset: "重置",
    filter: "筛选",
    add_watch: "➕ 自选",
    remind: "🔔 提醒",
    from: "起始日期",
    to: "结束日期",
    all: "全部",
    sector: "所属板块",
    market_cap: "市值区间",
    price_range: "股价区间",
    low_price: "低价（< $5）",
    mid_price: "中价（$5–$50）",
    high_price: "高价（> $50）",
    small_cap: "小盘（< $2B）",
    mid_cap: "中盘（$2B–$10B）",
    large_cap: "大盘（> $10B）",
    no_data_hint: "尚未加载数据，请设置筛选条件后点击 筛选。",
    invalid_symbol: "股票代码不合法",
    added_and_synced: "已添加至自选并同步财报概要",
    add_failed: "添加失败，请稍后重试",
    already_reported: "已经公布，无法设置提醒",
    reminder_set: "已设置提醒",
    earnings_reminder: "财报提醒",
    in_5_mins: "将在 5 分钟内公布财报！",
    today_report: "今日公布",
    reported: "已公布",
    days_left: "天后",
    nav_calendar: "财报日历",
    nav_watchlist: "自选",
    nav_holdings: "持仓",
    nav_chart: "财报图表",
    settings: "设置",
    language: "语言",
    chinese: "中文",
    english: "英文",
    th_symbol: "股票",
    th_sector: "所属板块",
    th_price: "当前股价",
    th_mktcap: "当前市值",
    th_date: "公布日期",
    th_countdown: "倒计时",
    th_eps: "EPS 预期",
    th_rev: "营收预期",
    pick_filters_first: "请先选择筛选条件",
  },
};

const I18nContext = createContext(null);

export function LanguageProvider({ children }) {
  const saved = localStorage.getItem("lang");
  const browserIsZh = (navigator.language || "en").toLowerCase().startsWith("zh");
  const defaultLang = saved || (browserIsZh ? "zh" : "en");

  const [lang, setLang] = useState(defaultLang);

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  // 兼容：t("英文","中文") 和 t("dict.key")
  const t = useCallback(
    (enOrKey, zhMaybe) => {
      if (typeof zhMaybe !== "undefined") {
        // 旧写法：t("English","中文")
        return lang === "zh" ? zhMaybe : enOrKey;
      }
      // 新写法：t("dict.key")
      const table = DICT[lang] || DICT.en;
      return table[enOrKey] ?? enOrKey; // 未命中字典则回退原文
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
