const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data.db'));

// 自选表：唯一 symbol
db.exec(`
CREATE TABLE IF NOT EXISTS watchlist (
  symbol TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

module.exports = db;
