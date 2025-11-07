const BASE = 'http://localhost:5050/api';

export const api = {
  getWatchlist: async () => (await fetch(`${BASE}/watchlist`)).json(),
  addSymbol: async (symbol) =>
    (await fetch(`${BASE}/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    })).json(),
  removeSymbol: async (symbol) =>
    (await fetch(`${BASE}/watchlist/${symbol}`, { method: 'DELETE' })).json(),

  // 数据
  getEarnings: async (symbol) => (await fetch(`${BASE}/earnings/${symbol}`)).json(),
  getCalendarBySymbol: async (symbol) => (await fetch(`${BASE}/calendar/${symbol}`)).json(),
  getCalendarAll: async () => (await fetch(`${BASE}/calendar`)).json(),
};
