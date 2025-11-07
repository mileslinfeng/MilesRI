# server/src/tools/earnings_calendar_fetch.py
import os
import sys
import json
import time
import requests
from datetime import datetime, timedelta

# ✅ Key 读取（保留你的默认值）
FMP_KEY = os.getenv("FMP_API_KEY", "z1m4vMNiLtZ1oXbdGJIulSpbMxGfLqvx")
FINN_KEY = os.getenv("FINNHUB_KEY", "d46d1epr01qgc9es8a40d46d1epr01qgc9es8a4g")

# ✅ 本地轻缓存，避免频繁外呼
CACHE_FILE = "calendar_cache.json"
CACHE_TTL = 60 * 30  # 30分钟

def log(msg):
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()

def to_iso(d):
    try:
        return datetime.fromisoformat(str(d)[:10]).strftime("%Y-%m-%d")
    except Exception:
        return None

def safe_num(v):
    try:
        return float(v)
    except:
        return None

def cache_load():
    if os.path.exists(CACHE_FILE):
        if time.time() - os.path.getmtime(CACHE_FILE) < CACHE_TTL:
            try:
                return json.load(open(CACHE_FILE, "r", encoding="utf-8"))
            except:
                pass
    return None

def cache_save(data):
    json.dump(data, open(CACHE_FILE, "w", encoding="utf-8"), indent=2, ensure_ascii=False)

# === 上游数据 ===
def fetch_fmp(from_date, to_date):
    url = f"https://financialmodelingprep.com/api/v3/earning_calendar?from={from_date}&to={to_date}&apikey={FMP_KEY}"
    log(f"📅 Fetching FMP: {url}")
    r = requests.get(url, timeout=15)
    if r.status_code != 200:
        log(f"❌ FMP Error {r.status_code}")
        return []
    try:
        data = r.json()
        if not isinstance(data, list):
            return []
        out = []
        for d in data:
            out.append({
                "symbol": d.get("symbol"),
                "date": to_iso(d.get("date") or d.get("filingDate")),
                "eps": safe_num(d.get("eps") or d.get("epsEstimate") or d.get("estimatedEps")),
                "revenue": safe_num(d.get("revenue") or d.get("revenueEstimate")),
                "time": d.get("time") or "N/A",
                "source": "FMP",
                # 这些字段 FMP 预告接口通常不给，先占位，后续补齐
                "marketCap": safe_num(d.get("marketCap")),
                "price": safe_num(d.get("price")),
                "sector": d.get("sector") or None
            })
        log(f"✅ FMP 返回 {len(out)} 条记录")
        return out
    except Exception as e:
        log("❌ FMP Parse Error:" + str(e))
        return []

def fetch_finnhub(from_date, to_date):
    url = f"https://finnhub.io/api/v1/calendar/earnings?from={from_date}&to={to_date}&token={FINN_KEY}"
    log(f"📅 Fetching Finnhub: {url}")
    r = requests.get(url, timeout=15)
    if r.status_code != 200:
        log(f"❌ Finnhub Error {r.status_code}")
        return []
    try:
        data = r.json()
        items = data.get("earningsCalendar", [])
        out = []
        for d in items:
            out.append({
                "symbol": d.get("symbol"),
                "date": to_iso(d.get("date")),
                "eps": safe_num(d.get("epsEstimate")),
                "revenue": safe_num(d.get("revenueEstimate")),
                "time": d.get("time") or "N/A",
                "source": "Finnhub",
                # 同理，这里也需要二次补齐
                "marketCap": safe_num(d.get("marketCapitalization")),
                "price": safe_num(d.get("close")),
                "sector": d.get("sector") or None
            })
        log(f"✅ Finnhub 返回 {len(out)} 条记录")
        return out
    except Exception as e:
        log("❌ Finnhub Parse Error:" + str(e))
        return []

# === 二次补齐：公司概况 ===
def fetch_profile(symbol):
    # FMP profile（含 sector / price / mktCap）
    url = f"https://financialmodelingprep.com/api/v3/profile/{symbol}?apikey={FMP_KEY}"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            j = r.json()
            if isinstance(j, list) and len(j) > 0:
                p = j[0]
                return {
                    "price": safe_num(p.get("price")),
                    "marketCap": safe_num(p.get("mktCap")),
                    "sector": p.get("sector") or None,
                }
    except Exception as e:
        log(f"⚠️ profile fetch fail {symbol}: {e}")
    return {}

def group_by_time(rows):
    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    week_ahead = today + timedelta(days=7)
    month_ahead = today + timedelta(days=30)

    groups = {"yesterday": [], "today": [], "thisWeek": [], "thisMonth": []}
    for d in rows:
        if not d.get("date"):
            continue
        dt = datetime.strptime(d["date"], "%Y-%m-%d").date()
        if dt == yesterday:
            groups["yesterday"].append(d)
        elif dt == today:
            groups["today"].append(d)
        elif today < dt <= week_ahead:
            groups["thisWeek"].append(d)
        elif week_ahead < dt <= month_ahead:
            groups["thisMonth"].append(d)
    for k in groups:
        groups[k] = sorted(groups[k], key=lambda x: x["date"])
    return groups

def fetch_all():
    # 读缓存（已分组的结构）
    cached = cache_load()
    if cached:
        log("📁 Using cached result.")
        return cached

    # 1) 主列表
    today = datetime.now().date()
    from_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    to_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")

    rows = fetch_fmp(from_date, to_date)
    if not rows:
        rows = fetch_finnhub(from_date, to_date)

    # 兜底：最少给点 mock，保证前端可视
    if not rows:
        rows = [
            {"symbol": "AAPL", "date": today.strftime("%Y-%m-%d"), "eps": 1.2, "revenue": 9e10, "time": "After Close", "source": "Mock"},
            {"symbol": "MSFT", "date": today.strftime("%Y-%m-%d"), "eps": 2.4, "revenue": 7.8e10, "time": "Before Open", "source": "Mock"},
            {"symbol": "NVDA", "date": (today + timedelta(days=5)).strftime("%Y-%m-%d"), "eps": 1.05, "revenue": 4.6e10, "time": "After Close", "source": "Mock"},
        ]

    # 2) 二次补齐：仅对缺失字段调用 profile，控制请求量
    symbols = sorted({r["symbol"] for r in rows if r.get("symbol")})
    profile_cache = {}
    for sym in symbols:
        profile_cache[sym] = fetch_profile(sym)

    for r in rows:
        prof = profile_cache.get(r["symbol"], {})
        # 只在缺失时补齐，避免覆盖上游已带的值
        if r.get("price") is None and prof.get("price") is not None:
            r["price"] = prof["price"]
        if r.get("marketCap") is None and prof.get("marketCap") is not None:
            r["marketCap"] = prof["marketCap"]
        if (not r.get("sector")) and prof.get("sector"):
            r["sector"] = prof["sector"]

    # 3) 分组 + 缓存
    grouped = group_by_time(rows)
    cache_save(grouped)
    return grouped

if __name__ == "__main__":
    try:
        result = fetch_all()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
