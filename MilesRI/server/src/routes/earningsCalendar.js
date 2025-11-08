
// server/src/routes/earningsCalendar.js
const express = require("express");
const path = require("path");

const router = express.Router();

router.get("/", async (req, res) => {
  console.log("🟣 [/api/earningsCalendar] 请求触发");

  const fs = require("fs");
  const today = new Date().toISOString().split("T")[0];
  console.log("📅 今日日期:", today);

  const dataDir = path.join(__dirname, "../../data");
  const cachePath = path.join(dataDir, `earnings_calendar_${today}.json`);
  console.log("📁 缓存路径:", cachePath);

  try {
    // 先尝试读有效缓存
    if (fs.existsSync(cachePath)) {
      const stat = fs.statSync(cachePath);
      console.log("✅ 检测到缓存文件, size =", stat.size, "bytes");
      if (stat.size >= 5) {
        try {
          const raw = fs.readFileSync(cachePath, "utf-8");
          const json = JSON.parse(raw);
          if (Array.isArray(json) && json.length > 0) {
            console.log("✅ 直接返回有效缓存，条数:", json.length);
            return res.json({ ok: true, data: json, cached: true });
          } else {
            console.warn("⚠️ 缓存为空数组，视为无效，转抓取");
          }
        } catch (e) {
          console.warn("⚠️ 缓存解析失败，转抓取:", e.message);
        }
      } else {
        console.warn("⚠️ 缓存文件过小，视为无效，转抓取");
      }
    } else {
      console.log("⚙️ 缓存缺失，准备调用 Python 脚本");
    }

    // 同步调用 Python 抓取
    console.log("⚙️ 缓存缺失，调用 Python 抓取...");
    const { spawnSync, spawn } = require("child_process");
    const pyPath = path.join(__dirname, "../../tools/earnings_calendar_fetch.py");
    const pyExe  = path.join(process.cwd(), ".venv/Scripts/python.exe");
    const runCwd = path.join(__dirname, "../..");

    console.log("🔎 调试路径：", { pyExe, pyPath, runCwd, cachePath });

    console.time("⏱️ Python抓取耗时");
    const pyRun = spawnSync(pyExe, [pyPath], {
      cwd: runCwd,
      env: process.env,
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf-8",
    });
    console.timeEnd("⏱️ Python抓取耗时");

    if (pyRun.error) {
      console.error("❌ spawnSync error:", pyRun.error);
      if (pyRun.error.code === "ETIMEDOUT") {
        console.warn("⏳ 首次抓取超时，后台改用异步预热并返回占位响应");
        const child = spawn(pyExe, [pyPath], { cwd: runCwd, env: process.env });
        child.stdout.on("data", (d) => console.log("🐍(bg) stdout:", d.toString().slice(0, 200)));
        child.stderr.on("data", (d) => console.log("🐍(bg) stderr:", d.toString().slice(0, 200)));
        return res.status(202).json({ ok: false, warmingUp: true, msg: "首次抓取较慢，已在后台预热，请稍后再试" });
      }
    }

    console.log("🐍 Python 结束:", { status: pyRun.status, signal: pyRun.signal });
    console.log("🐍 Python stdout 前 500 字符:\n", (pyRun.stdout || "").slice(0, 500));
    if (pyRun.stderr) console.log("🐍 Python stderr 前 500 字符:\n", pyRun.stderr.slice(0, 500));

    const parsed = JSON.parse(pyRun.stdout || "[]");
    if (Array.isArray(parsed) && parsed.length === 0) {
      console.warn("⚠️ Python 返回空数组，可能是数据源无数据或网络受限");
    }

    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(parsed, null, 2), "utf-8");
    console.log("✅ 写入缓存成功:", cachePath, "条数:", Array.isArray(parsed) ? parsed.length : "N/A");
    return res.json({ ok: true, data: parsed, fetched: true });

  } catch (err) {
    console.error("earningsCalendar route error:", err);
    try {
      if (!fs.existsSync(cachePath)) {
        console.warn("⚠️ 当日财报数据缺失，请管理员手动刷新或补充！");
      }
    } catch (_) {}
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 手动刷新（含冷却时间）
router.get("/refresh", async (req, res) => {
  try {
    const fs = require("fs");
    const today = new Date().toISOString().split("T")[0];
    const dataDir = path.join(__dirname, "../../data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const cachePath = path.join(dataDir, `earnings_calendar_${today}.json`);
    const cooldownPath = path.join(dataDir, "refresh_cooldown.json");

    const now = Date.now();
    let lastRefresh = 0;
    if (fs.existsSync(cooldownPath)) {
      try {
        const obj = JSON.parse(fs.readFileSync(cooldownPath, "utf-8"));
        lastRefresh = obj.lastRefresh || 0;
      } catch { }
    }

    const cooldown = 30 * 60 * 1000; // 30 分钟
    if (now - lastRefresh < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastRefresh)) / 60000);
      return res.json({ ok: false, msg: `请稍后再试，冷却中（剩余 ${remaining} 分钟）`, remainingMinutes: remaining });
    }

    fs.writeFileSync(cooldownPath, JSON.stringify({ lastRefresh: now }, null, 2));

    const { spawn } = require("child_process");
    const pyPath = path.join(__dirname, "../../tools/earnings_calendar_fetch.py");
    const pyExe = path.join(process.cwd(), "../.venv/Scripts/python.exe");
    const runCwd = path.join(__dirname, "../..");
    console.log("🚀 手动刷新：执行 Python 抓取任务...", { pyExe, pyPath, runCwd });
    
    const child = spawn(pyExe, [pyPath], { cwd: runCwd, env: process.env });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    

    child.on("close", () => {
      if (stderr) console.log("🐍 Python stderr:", stderr);
      try {
        const parsed = JSON.parse(stdout);
        fs.writeFileSync(cachePath, JSON.stringify(parsed, null, 2), "utf-8");
        console.log("✅ 已手动刷新缓存:", cachePath);
        res.json({ ok: true, msg: "财报数据已手动刷新成功 ✅" });
      } catch (e) {
        console.error("❌ JSON parse error:", e.message);
        res.status(500).json({ ok: false, msg: "Python 输出解析失败" });
      }
    });
  } catch (err) {
    console.error("手动刷新出错:", err);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

module.exports = router;
