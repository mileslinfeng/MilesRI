import os
import requests
import time
import json
from datetime import datetime
from dotenv import load_dotenv
from colorama import Fore, Style, init

init(autoreset=True)
load_dotenv(dotenv_path=os.path.join(os.getcwd(), ".env"))

symbols = ["AAPL", "NVDA"]
timeout = 10
results = {}

ALPHA_KEY = os.getenv("ALPHA_VANTAGE_KEY")
FINNHUB_KEY = os.getenv("FINNHUB_KEY")
FMP_KEY = os.getenv("FMP_KEY")
EODHD_KEY = os.getenv("EODHD_KEY")

def safe_get(url):
    try:
        r = requests.get(url, timeout=timeout)
        return r.status_code, r.json()
    except Exception as e:
        return None, {"error": str(e)}

def ok(text): return Fore.GREEN + "✅ " + Style.RESET_ALL + text
def fail(text): return Fore.RED + "❌ " + Style.RESET_ALL + text

def test_alpha(symbol):
    ok_count = 0
    url = f"https://www.alphavantage.co/query?function=EARNINGS&symbol={symbol}&apikey={ALPHA_KEY}"
    status, data = safe_get(url)
    if data.get("quarterlyEarnings"):
        latest = data["quarterlyEarnings"][0]
        eps = latest.get("reportedEPS")
        surprise = latest.get("surprisePercentage")
        print(ok(f"AlphaVantage {symbol}: EPS={eps}, Surprise%={surprise}"))
        ok_count += 1
    else:
        print(fail(f"AlphaVantage {symbol}: 无季度数据 (status={status})"))

    url2 = f"https://www.alphavantage.co/query?function=OVERVIEW&symbol={symbol}&apikey={ALPHA_KEY}"
    s2, d2 = safe_get(url2)
    if d2.get("RevenueTTM"):
        print(ok(f"AlphaVantage {symbol}: RevenueTTM={d2['RevenueTTM']}"))
        ok_count += 1
    else:
        print(fail(f"AlphaVantage {symbol}: 无 RevenueTTM"))
    return ok_count > 0

def test_finnhub(symbol):
    ok_count = 0
    url = f"https://finnhub.io/api/v1/stock/earnings?symbol={symbol}&token={FINNHUB_KEY}"
    status, data = safe_get(url)
    if isinstance(data, list) and data:
        last = data[0]
        print(ok(f"Finnhub {symbol}: EPS={last.get('actual')}, Est={last.get('estimate')}, Surprise%={last.get('surprisePercent')}"))
        ok_count += 1
    else:
        print(fail(f"Finnhub {symbol}: 无历史 EPS 数据 (status={status})"))

    url2 = f"https://finnhub.io/api/v1/stock/metric?symbol={symbol}&metric=all&token={FINNHUB_KEY}"
    s2, d2 = safe_get(url2)
    if d2.get("metric"):
        pe = d2["metric"].get("peInclExtraTTM")
        eps = d2["metric"].get("epsTTM")
        print(ok(f"Finnhub {symbol}: PE={pe}, EPS={eps}"))
        ok_count += 1
    else:
        print(fail(f"Finnhub {symbol}: 无 metric 数据"))
    return ok_count > 0

def test_fmp(symbol):
    ok_count = 0
    url = f"https://financialmodelingprep.com/api/v3/key-metrics/{symbol}?limit=1&apikey={FMP_KEY}"
    status, data = safe_get(url)
    if isinstance(data, list) and data:
        d = data[0]
        print(ok(f"FMP {symbol}: PE={d.get('peRatio')}, EPS={d.get('netIncomePerShare')}, ROE={d.get('roe')}"))
        ok_count += 1
    else:
        print(fail(f"FMP {symbol}: 无 key-metrics 数据 (status={status})"))

    url2 = f"https://financialmodelingprep.com/api/v3/income-statement/{symbol}?limit=1&apikey={FMP_KEY}"
    s2, d2 = safe_get(url2)
    if isinstance(d2, list) and d2:
        r = d2[0]
        print(ok(f"FMP {symbol}: Revenue={r.get('revenue')}, NetIncome={r.get('netIncome')}"))
        ok_count += 1
    else:
        print(fail(f"FMP {symbol}: 无 income-statement 数据"))
    return ok_count > 0

def test_eodhd(symbol):
    ok_count = 0
    symbol_us = symbol if symbol.endswith(".US") else f"{symbol}.US"
    url = f"https://eodhd.com/api/fundamentals/{symbol_us}?api_token={EODHD_KEY}&fmt=json"
    status, data = safe_get(url)
    if not isinstance(data, dict):
        print(fail(f"EODHD {symbol}: 无返回 (status={status})"))
        return False
    highlights = data.get("Highlights", {})
    eps = highlights.get("EarningsShare")
    if eps:
        print(ok(f"EODHD {symbol}: EPS={eps}"))
        ok_count += 1
    fin = data.get("Financials", {}).get("Income_Statement", {}).get("quarterly", {})
    if fin:
        last_period = list(fin.values())[0]
        revenue = last_period.get("totalRevenue")
        print(ok(f"EODHD {symbol}: Revenue={revenue}"))
        ok_count += 1
    else:
        print(fail(f"EODHD {symbol}: 无 Income_Statement 数据"))
    return ok_count > 0

def main():
    print("\n🧪 Running Multi-Source Earnings API Test (v3)...\n")
    if not all([ALPHA_KEY, FINNHUB_KEY, FMP_KEY, EODHD_KEY]):
        print("⚠️ 请确认四个 API Key 已在 .env 中设置。\n")
        return

    for sym in symbols:
        print(f"{'='*20} {sym} {'='*20}")
        start = time.time()
        res = {
            "AlphaVantage": test_alpha(sym),
            "Finnhub": test_finnhub(sym),
            "FMP": test_fmp(sym),
            "EODHD": test_eodhd(sym),
        }
        elapsed = round(time.time() - start, 2)
        valid = sum(1 for v in res.values() if v)
        print(f"{Fore.CYAN}➡️  {sym} 有效来源数: {valid}/4 | 耗时: {elapsed}s{Style.RESET_ALL}")
        print("-" * 70)
        results[sym] = res
        time.sleep(2)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    outfile = f"earnings_results_{ts}.json"
    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n✅ 测试完成，结果已保存至 {outfile}\n")

if __name__ == "__main__":
    main()
