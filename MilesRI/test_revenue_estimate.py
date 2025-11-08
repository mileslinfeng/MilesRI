import requests

keys = {
    "FMP": "z1m4vMNiLtZ1oXbdGJIulSpbMxGfLqvx",
    "FINNHUB": "d46d1epr01qgc9es8a40d46d1epr01qgc9es8a4g",
    "ALPHAV": "LP7X0GBZ6I486XCO",
    "EODHD": "690cd18c78e591.25613652"
}

def test_finnhub(symbol):
    url = f"https://finnhub.io/api/v1/calendar/earnings?symbol={symbol}&token={keys['FINNHUB']}"
    r = requests.get(url)
    if r.status_code == 200:
        data = r.json().get("earningsCalendar", [])
        if data:
            d = data[0]
            print(f"🟢 Finnhub {symbol}: EPS={d.get('epsActual')} vs {d.get('epsEstimate')} | Rev={d.get('revenueActual')} vs {d.get('revenueEstimate')}")
        else:
            print(f"⚪ Finnhub 无数据 {symbol}")
    else:
        print(f"🔴 Finnhub Error {r.status_code}")

def test_eodhd(symbol):
    url = f"https://eodhd.com/api/calendar_earnings?symbol={symbol}&api_token={keys['EODHD']}&fmt=json"
    r = requests.get(url)
    if r.status_code == 200:
        data = r.json()
        if data:
            d = data[0]
            print(f"🟢 EODHD {symbol}: EPS={d.get('epsActual')} vs {d.get('epsEstimate')} | Rev={d.get('revenueActual')} vs {d.get('revenueEstimate')}")
        else:
            print(f"⚪ EODHD 无数据 {symbol}")
    else:
        print(f"🔴 EODHD Error {r.status_code}")

def test_alphav(symbol):
    url = f"https://www.alphavantage.co/query?function=EARNINGS&symbol={symbol}&apikey={keys['ALPHAV']}"
    r = requests.get(url)
    if r.status_code == 200:
        data = r.json().get("quarterlyEarnings", [])
        if data:
            d = data[0]
            print(f"🟢 AlphaV {symbol}: EPS={d.get('reportedEPS')} vs {d.get('estimatedEPS')}")
        else:
            print(f"⚪ AlphaV 无数据 {symbol}")
    else:
        print(f"🔴 AlphaV Error {r.status_code}")

if __name__ == "__main__":
    symbols = ["AAPL", "MSFT", "NVDA", "AMZN"]
    for s in symbols:
        print(f"\n==== {s} ====")
        test_finnhub(s)
        test_eodhd(s)
        test_alphav(s)
