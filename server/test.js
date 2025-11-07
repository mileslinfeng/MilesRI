// server/test.js
const fetch = require("node-fetch");

const symbols = ["AAPL", "NVDA", "BBAI", "ENPH"];

(async () => {
  for (const s of symbols) {
    console.log(`🧪 Testing ${s} ...`);
    const res = await fetch(`http://localhost:5050/api/earningsSummary/test/${s}`);
    const json = await res.json();
    console.log(s, JSON.stringify(json.sourceTest, null, 2));
  }
})();
