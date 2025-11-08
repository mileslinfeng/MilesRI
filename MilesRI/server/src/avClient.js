const fetch = require('node-fetch');
const { ALPHAVANTAGE_API_KEY } = process.env;

const BASE = 'https://www.alphavantage.co/query';

// 公司季度财报（历史）含 EPS/Surprise
async function getEarnings(symbol) {
  const url = `${BASE}?function=EARNINGS&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHAVANTAGE_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Alpha Vantage EARNINGS failed');
  return r.json();
}

// 未来财报预告（最多 3 个月 horizon）
// Alpha Vantage 文档：EARNINGS_CALENDAR（可传 symbol 或不传，支持 horizon=3month）
async function getEarningsCalendar({ symbol = '', horizon = '3month' } = {}) {
  const params = new URLSearchParams({
    function: 'EARNINGS_CALENDAR',
    apikey: ALPHAVANTAGE_API_KEY,
    horizon
  });
  if (symbol) params.set('symbol', symbol);
  const url = `${BASE}?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Alpha Vantage EARNINGS_CALENDAR failed');
  return r.json();
}

module.exports = { getEarnings, getEarningsCalendar };
