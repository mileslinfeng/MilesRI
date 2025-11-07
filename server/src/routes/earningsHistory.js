// server/src/routes/earningsHistory.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const { assembleHistory } = require("../utils/fetchEarnings");

const CACHE_DIR = path.join(__dirname, "../../data");

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const MEMO = new Map();
// 内存 6 小时；磁盘 12 小时
const TTL_MEM = 1000 * 60 * 60 * 6;
const TTL_DISK = 1000 * 60 * 60 * 12;

router.get("/:symbol", async (req, res) => {
  const symbol = (req.params.symbol || "").toUpperCase();
  const limit = Math.max(4, Math.min(20, Number(req.query.limit) || 16));

  try {
    const cached = readCache(symbol, "history", TTL_MEM, TTL_DISK);
    if (cached) return res.json({ ok: true, data: cached.data, cached: true });

    const r = await assembleHistory(symbol, limit);
    if (!r.ok) return res.json({ ok: false, message: "Upstream error" });

    writeCache(symbol, "history", r.data);
    MEMO.set(key(symbol, "history"), { t: Date.now(), data: r.data });

    res.json({ ok: true, data: r.data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ====== utils: 缓存 ====== */
function key(symbol, kind) {
  return `${symbol}:${kind}`;
}
function readCache(symbol, kind, ttlMem, ttlDisk) {
  const k = key(symbol, kind);
  const inMem = MEMO.get(k);
  if (inMem && Date.now() - inMem.t < ttlMem) return inMem;

  const p = path.join(CACHE_DIR, `${symbol}.${kind}.json`);
  if (fs.existsSync(p)) {
    try {
      const json = JSON.parse(fs.readFileSync(p, "utf8"));
      if (Date.now() - (json.timestamp || 0) < ttlDisk) {
        MEMO.set(k, { t: Date.now(), data: json.data });
        return { data: json.data };
      }
    } catch {}
  }
  return null;
}
function writeCache(symbol, kind, data) {
  const p = path.join(CACHE_DIR, `${symbol}.${kind}.json`);
  try {
    fs.writeFileSync(p, JSON.stringify({ timestamp: Date.now(), data }, null, 2));
  } catch {}
}

module.exports = router;
