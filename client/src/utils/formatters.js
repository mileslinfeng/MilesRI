// 前端 · 新建：client/src/utils/formatters.js
import { useMemo } from "react";
import { useI18n } from "../i18n";

export function useFormatters() {
  const { lang, t } = useI18n();

  const fmt = useMemo(() => {
    const locale = lang === "zh" ? "zh-CN" : "en-US";
    const currencyFmt = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
    const numberFmt = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    });
    const dateFmt = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const formatCurrency = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n === 0) return "—";
      if (Math.abs(n) >= 1e12) return currencyFmt.format(n / 1e12) + (lang === "zh" ? "万亿" : "T");
      if (Math.abs(n) >= 1e9) return currencyFmt.format(n / 1e9) + "B";
      if (Math.abs(n) >= 1e6) return currencyFmt.format(n / 1e6) + "M";
      if (Math.abs(n) >= 1e3) return currencyFmt.format(n / 1e3) + "K";
      return currencyFmt.format(n);
    };

    const formatPrice = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n === 0) return "—";
      return currencyFmt.format(n);
    };

    const formatDate = (iso) => {
      if (!iso) return "—";
      const d = new Date(iso);
      if (isNaN(d)) return "—";
      return dateFmt.format(d);
    };

    const countdownText = (iso) => {
      if (!iso) return "—";
      const d = new Date(iso);
      const now = new Date();
      const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return t("reported");
      if (diffDays === 0) return t("today_report");
      return lang === "zh" ? `还有 ${diffDays} ${t("days_left")}` : `${diffDays} ${t("days_left")}`;
    };

    return { formatCurrency, formatPrice, formatDate, countdownText, numberFmt };
  }, [lang, t]);

  return { ...fmt, lang, t };
}
