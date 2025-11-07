// server/src/routes/earningsSummary.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const { assembleSummary } = require("../utils/fetchEarnings");

const CACHE_DIR = path.join(__dirname, "../../data");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const MEMO = new Map();           // 内存缓存
const INFLIGHT = new Map();       // 并发去抖
const TTL_MEM = 1000 * 60 * 60 * 3;  // 3h
const TTL_DISK = 1000 * 60 * 60 * 6; // 6h

router.get("/:symbol", async (req, res) => {
  let symbol = String(req.params.symbol || "").trim().toUpperCase();

  // 1) 基本校验
  if (!symbol || !/^[A-Z0-9.\-]+$/.test(symbol)) {
    return res.status(400).json({ ok: false, error: "Invalid symbol" });
  }

  try {
    // 2) 命中缓存
    const cached = readCache(symbol, "summary", TTL_MEM, TTL_DISK);
    if (cached) {
      res.set("Cache-Control", `public, max-age=60`); // 给前端一个短缓存
      return res.json({ ok: true, data: cached.data, cached: true, fromCache: cached.level });
    }

    // 3) 并发去抖：同一 symbol 只跑一次
    if (INFLIGHT.has(symbol)) {
      const data = await INFLIGHT.get(symbol);
      res.set("Cache-Control", `public, max-age=60`);
      return res.json({ ok: true, data, cached: true, fromCache: "inflight" });
    }

    const p = (async () => {
      const r = await assembleSummary(symbol);
      if (!r.ok) throw new Error("Upstream error");

      writeCache(symbol, "summary", r.data);
      MEMO.set(key(symbol, "summary"), { t: Date.now(), data: r.data });

      return r.data;
    })();

    INFLIGHT.set(symbol, p);

    const data = await p;
    res.set("Cache-Control", `public, max-age=300`); // 新鲜数据 5 分钟
    return res.json({ ok: true, data, cached: false, fromCache: "fresh" });

  } catch (e) {
    // 4) 上游失败：尝试兜底读“过期磁盘缓存”
    const stale = readCache(symbol, "summary", -1, Number.MAX_SAFE_INTEGER); // 不看 TTL，当作兜底
    if (stale) {
      res.set("Cache-Control", `public, max-age=30`);
      return res.status(206).json({
        ok: true,
        data: stale.data,
        cached: true,
        fromCache: "stale-disk",
        warning: "Upstream failed; served stale"
      });
    }
    return res.status(502).json({ ok: false, error: e.message || "Upstream error" });
  } finally {
    INFLIGHT.delete(symbol);
  }
});

/* ====== utils: 缓存 ====== */
function key(symbol, kind) {
  return `${symbol}:${kind}`;
}

function readCache(symbol, kind, ttlMem, ttlDisk) {
  const k = key(symbol, kind);

  // 内存缓存
  const inMem = MEMO.get(k);
  if (inMem && (ttlMem < 0 || Date.now() - inMem.t < ttlMem)) {
    return { data: inMem.data, level: "memory" };
  }

  // 磁盘缓存
  const p = path.join(CACHE_DIR, `${symbol}.${kind}.json`);
  if (fs.existsSync(p)) {
    try {
      const json = JSON.parse(fs.readFileSync(p, "utf8"));
      const ts = Number(json.timestamp || 0);
      if (ttlDisk < 0 || Date.now() - ts < ttlDisk) {
        MEMO.set(k, { t: Date.now(), data: json.data });
        return { data: json.data, level: "disk" };
      }
    } catch (_) {}
  }
  return null;
}

function writeCache(symbol, kind, data) {
  const p = path.join(CACHE_DIR, `${symbol}.${kind}.json`);
  try {
    fs.writeFileSync(p, JSON.stringify({ timestamp: Date.now(), data }, null, 2), "utf8");
  } catch (_) {}
}
// 删除缓存文件接口
// 删除缓存文件接口
router.delete("/:symbol", async (req, res) => {
  const symbol = String(req.params.symbol || "").trim().toUpperCase();
  if (!symbol || !/^[A-Z0-9.\-]+$/.test(symbol)) {
    return res.status(400).json({ ok: false, error: "Invalid symbol" });
  }

  try {
    const fs = require("fs");
    const path = require("path");
    const cacheDir = path.join(__dirname, "../../data");

    let deleted = [];

    if (fs.existsSync(cacheDir)) {
      const allFiles = fs.readdirSync(cacheDir);
      for (const f of allFiles) {
        const upper = f.toUpperCase();
        // 👇 删除所有与 symbol 匹配的 summary/history 缓存
        if (
          upper.startsWith(symbol) &&
          (upper.includes("SUMMARY") || upper.includes("HISTORY"))
        ) {
          const fullPath = path.join(cacheDir, f);
          fs.unlinkSync(fullPath);
          deleted.push(f);
        }
      }
    }

    // 清除内存缓存
    for (const k of Array.from(MEMO.keys())) {
      if (k.startsWith(symbol + ":")) MEMO.delete(k);
    }

    console.log(`🗑️ 已清理缓存文件 [${symbol}]:`, deleted);
    return res.json({ ok: true, deleted });
  } catch (e) {
    console.error("❌ 删除缓存出错:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});



module.exports = router;
