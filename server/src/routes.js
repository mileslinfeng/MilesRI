// D:\usstocks\server\src\routes.js
const express = require('express');
const db = require('./db');
const { getEarnings, getEarningsCalendar } = require('./avClient');

const router = express.Router();

router.get('/watchlist', (req, res) => {
  const rows = db.prepare('SELECT symbol, created_at FROM watchlist ORDER BY symbol ASC').all();
  res.json(rows);
});

router.post('/watchlist', (req, res) => {
  const { symbol } = req.body || {};
  if (!symbol || !/^[A-Za-z.\-]{1,10}$/.test(symbol)) {
    return res.status(400).json({ error: 'Invalid symbol' });
  }
  try {
    db.prepare('INSERT OR IGNORE INTO watchlist(symbol) VALUES (?)').run(symbol.toUpperCase());
    res.json({ ok: true, symbol: symbol.toUpperCase() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/watchlist/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  db.prepare('DELETE FROM watchlist WHERE symbol = ?').run(symbol);
  res.json({ ok: true });
});

// 单只股票：历史季度财报（带 Surprise）
router.get('/earnings/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const data = await getEarnings(symbol);
    res.json({ symbol, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 单只股票：未来 3 个月预告财报（若返回数组为空，表示官方尚未发布）
router.get('/calendar/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const data = await getEarningsCalendar({ symbol, horizon: '3month' });
    res.json({ symbol, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 总预告视图：合并 watchlist 中所有股票的 3 个月预告
router.get('/calendar', async (req, res) => {
  try {
    const rows = db.prepare('SELECT symbol FROM watchlist').all();
    const results = [];
    for (const r of rows) {
      try {
        const cal = await getEarningsCalendar({ symbol: r.symbol, horizon: '3month' });
        if (Array.isArray(cal)) {
          cal.forEach(item => results.push(item));
        } else if (Array.isArray(cal?.earningsCalendar)) {
          cal.earningsCalendar.forEach(item => results.push(item));
        }
      } catch (_) { /* 单个失败不影响整体 */ }
    }
    // 简单排序：最近在前
    results.sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
