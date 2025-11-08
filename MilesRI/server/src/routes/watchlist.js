// server/src/routes/watchlist.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { assembleSummary } = require("../utils/fetchEarnings");

const WATCHLIST_PATH = path.join(__dirname, "../../cache/watchlist.json");
const DATA_DIR = path.join(__dirname, "../../data");

// 初始化文件
if (!fs.existsSync(WATCHLIST_PATH)) {
  fs.mkdirSync(path.dirname(WATCHLIST_PATH), { recursive: true });
  fs.writeFileSync(WATCHLIST_PATH, "[]", "utf8");
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 读取自选列表
router.get("/", (req, res) => {
  try {
    const list = JSON.parse(fs.readFileSync(WATCHLIST_PATH, "utf8"));
    res.json(list);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ✅ 添加股票到自选（带历史财报数据）
router.post("/", async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ ok: false, error: "Missing symbol" });

    const upperSymbol = symbol.toUpperCase();
    const list = JSON.parse(fs.readFileSync(WATCHLIST_PATH, "utf8"));

    if (!list.find((x) => x.symbol === upperSymbol)) {
      list.push({ symbol: upperSymbol });
      fs.writeFileSync(WATCHLIST_PATH, JSON.stringify(list, null, 2), "utf8");
      console.log("✅ 新增自选:", upperSymbol);
    }

    // ✅ 自动调用 yfinance 补充历史财报数据
    try {
      const { ok, data } = await assembleSummary(upperSymbol, { includeHistory: true });
      if (ok && data) {
        const summaryFile = path.join(DATA_DIR, `${upperSymbol}.summary.json`);
        fs.writeFileSync(
          summaryFile,
          JSON.stringify({ timestamp: Date.now(), data }, null, 2),
          "utf8"
        );
        console.log(`🧩 已写入 ${upperSymbol}.summary.json（含历史财报数据）`);
      } else {
        console.warn(`⚠️ 未获取到 ${upperSymbol} 的财报数据`);
      }
    } catch (err) {
      console.error("❌ 获取财报数据失败:", err);
    }

    res.json({ ok: true, list });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 删除股票
router.delete("/:symbol", (req, res) => {
  try {
    const symbol = String(req.params.symbol || "").toUpperCase();
    let list = JSON.parse(fs.readFileSync(WATCHLIST_PATH, "utf8"));
    list = list.filter((x) => x.symbol !== symbol);
    fs.writeFileSync(WATCHLIST_PATH, JSON.stringify(list, null, 2), "utf8");
    console.log("🗑️ 已删除自选:", symbol);

    // 同时删除缓存文件
    const summaryFile = path.join(DATA_DIR, `${symbol}.summary.json`);
    if (fs.existsSync(summaryFile)) {
      fs.unlinkSync(summaryFile);
      console.log(`🗑️ 已删除 ${symbol}.summary.json`);
    }

    res.json({ ok: true, list });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
