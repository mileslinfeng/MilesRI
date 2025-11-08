// =============================
// D:\usstocks\server\src\index.js
// ✅ 美股财报追踪系统 - 后端主入口（无需 .env）
// =============================

const path = require("path");
const express = require("express");
const cors = require("cors");

// ✅ 全局配置（直接写死在这里，供所有模块读取）
global.CONFIG = {
  PORT: 5050,
  ALPHA_VANTAGE_KEY: "LP7X0GBZ6I486XCO",
  FINNHUB_KEY: "d46d1epr01qgc9es8a40d46d1epr01qgc9es8a4g",
  FMP_KEY: "z1m4vMNiLtZ1oXbdGJIulSpbMxGfLqvx",
  EODHD_KEY: "690cd18c78e591.25613652"
};

// 调试输出
console.log("🔑 Global CONFIG Loaded:", global.CONFIG);

// -----------------------------
// 🌐 Express 应用初始化
// -----------------------------
const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "DELETE", "PUT"],
  })
);
app.use(express.json());

// -----------------------------
// 📦 导入路由模块
// -----------------------------
const routes = require("./routes");
const earningsDetails = require("./routes/earningsDetails");
const earningsSummary = require("./routes/earningsSummary");
const earningsCalendar = require("./routes/earningsCalendar");
const earningsHistory = require("./routes/earningsHistory");
const watchlist = require("./routes/watchlist");

// -----------------------------
// 📡 注册 API 路由
// -----------------------------
app.use("/api/earningsSummary", earningsSummary);
app.use("/api/earningsDetails", earningsDetails);
app.use("/api/earningsCalendar", earningsCalendar);
app.use("/api/earningsHistory", earningsHistory);
app.use("/api/watchlist", watchlist);
app.use("/api", routes);

// -----------------------------
// 🚀 启动服务器
// -----------------------------
const port = global.CONFIG.PORT;
app.listen(port, () =>
  console.log(`✅ Server running successfully at: http://localhost:${port}`)
);

// -----------------------------
// 🧩 健康检查
// -----------------------------
app.get("/", (req, res) => {
  res.send({
    status: "ok",
    service: "US Stocks Earnings Tracker API",
    version: "1.0.0",
    uptime: process.uptime().toFixed(2) + "s",
  });
});
