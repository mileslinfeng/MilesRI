import React from "react";
import { useI18n } from "../i18n";

export default function Header() {
  const { lang, setLang } = useI18n();  // ✅ 从全局状态获取语言

  return (
    <header className="sa-header flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm">
      {/* 左侧标题 */}
      <h1 className="text-sm font-semibold text-gray-900">
        {lang === "zh" ? "美股财报 Pro" : "Earnings Pro"}
      </h1>


      {/* 右侧语言切换按钮 */}
      <button
        onClick={() => setLang(lang === "zh" ? "en" : "zh")}
        title={lang === "zh" ? "Switch to English" : "切换到中文"}
        className="w-[80px] h-[36px] flex items-center justify-center gap-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-100 transition-all shadow-sm"
      >
        <img
          src={lang === "zh" ? "/pic/us.svg" : "/pic/cn.svg"}
          alt={lang === "zh" ? "US Flag" : "China Flag"}
          className="w-5 h-5 object-contain"
          style={{ maxWidth: "20px", maxHeight: "20px" }}
        />
        <span className="font-medium select-none">
        </span>
      </button>
    </header>
  );
}
