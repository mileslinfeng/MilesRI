// client/src/api.js
const BASE = window.location.hostname.includes("github.io")
  ? "https://api.flinai.com"  // ✅ 改为 HTTPS 域名
  : "http://localhost:5050";   // ✅ 本地开发


export const api = {
  getWatchlist: async () => (await fetch(`${BASE}/api/watchlist`)).json(),
  addSymbol: async (symbol) =>
    (await fetch(`${BASE}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    })).json(),
  removeSymbol: async (symbol) =>
    (await fetch(`${BASE}/api/watchlist/${symbol}`, { method: 'DELETE' })).json(),

  // 数据相关
  getEarnings: async (symbol) => (await fetch(`${BASE}/api/earnings/${symbol}`)).json(),
  getCalendarBySymbol: async (symbol) => (await fetch(`${BASE}/api/calendar/${symbol}`)).json(),
  getCalendarAll: async () => (await fetch(`${BASE}/api/calendar`)).json(),
};
