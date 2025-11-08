const isGithubPages = window.location.hostname.endsWith("github.io");
const BASE = isGithubPages
  ? "https://api.flinai.com"    // ✅ GitHub Pages / 生产环境
  : "https://api.flinai.com";   // ✅ 本地开发也统一走 HTTPS
// （这样即使本地用 HTTPS，浏览器也不会出现 mixed content）

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

  getEarnings: async (symbol) => (await fetch(`${BASE}/api/earnings/${symbol}`)).json(),
  getCalendarBySymbol: async (symbol) => (await fetch(`${BASE}/api/calendar/${symbol}`)).json(),
  getCalendarAll: async () => (await fetch(`${BASE}/api/calendar`)).json(),
};
