# D:\usstocks\server\tools\earnings_calendar_fetch.py
import os
import sys
import json
import time
import requests
from datetime import datetime, timedelta

def log(msg):
    """输出到 stderr（Node 不会解析这里的内容）"""
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


FMP_KEY  = os.getenv("FMP_API_KEY") or os.getenv("FMP_KEY") or "z1m4vMNiLtZ1oXbdGJIulSpbMxGfLqvx"
FINN_KEY = os.getenv("FINNHUB_KEY") or os.getenv("FINNHUB_TOKEN") or "d46d1epr01qgc9es8a40d46d1epr01qgc9es8a4g"
log(f"🔐 Keys loaded: FMP={bool(FMP_KEY)} FINN={bool(FINN_KEY)}")

CACHE_FILE = "calendar_cache.json"
CACHE_TTL = 60 * 30  # 30分钟

log("🚀 [fetch_all] 开始执行")


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
    json.dump(data, open(CACHE_FILE, "w", encoding="utf-8"), indent=2)


def fetch_fmp(from_date, to_date):
    url = f"https://financialmodelingprep.com/api/v3/earning_calendar?from={from_date}&to={to_date}&apikey={FMP_KEY}"
    log(f"📅 Fetching FMP: {url}")
    r = requests.get(url, timeout=15)
    if r.status_code != 200:
        log(f"❌ FMP Error {r.status_code}")
        return []
    try:
        data = r.json()
    except Exception as e:
        log(f"⚠️ JSON Decode Error (FMP): {e}")
        return []

    if not isinstance(data, list):
        return []
    out = []
    for d in data:
        out.append({
            "symbol": d.get("symbol"),
            "date": to_iso(d.get("date") or d.get("filingDate")),
            "eps": safe_num(d.get("eps") or d.get("epsEstimate") or d.get("estimatedEps")),
            "revenue": safe_num(d.get("revenue") or d.get("revenueActual")),
            "revenueEstimate": safe_num(d.get("revenueEstimate") or d.get("estimatedRevenue")),
            "time": "After Close" if (d.get("hour") or d.get("time")) == "amc" else ("Before Open" if (d.get("hour") or d.get("time")) == "bmo" else "N/A"),
            "source": "FMP",
            "marketCap": safe_num(d.get("marketCap")),
            "price": safe_num(d.get("price")),
            "sector": d.get("sector") or "N/A"
        })

    log(f"✅ FMP 返回 {len(out)} 条记录")
    log(f"🧾 FMP 原始数据预览:")
    for i, d in enumerate(out[:20]):
        log(f"{i+1}. {json.dumps(d, ensure_ascii=False)}")
    return out


def fetch_finnhub(from_date, to_date):
    url = f"https://finnhub.io/api/v1/calendar/earnings?from={from_date}&to={to_date}&token={FINN_KEY}"
    log(f"📅 Fetching Finnhub: {url}")
    r = requests.get(url, timeout=15)
    if r.status_code != 200:
        log(f"❌ Finnhub Error {r.status_code}")
        return []
    try:
        data = r.json()
    except Exception as e:
        log(f"⚠️ JSON Decode Error (Finnhub): {e}")
        return []

    try:
        items = data.get("earningsCalendar", [])
        log(f"✅ Finnhub 返回 {len(items)} 条记录")
        log("🧾 Finnhub 原始数据预览（前20条）：")
        for i, d in enumerate(items[:20]):
            log(f"{i+1}. {json.dumps(d, ensure_ascii=False)}")

        out = []
        for d in items:
            out.append({
                "symbol": d.get("symbol"),
                "date": to_iso(d.get("date")),
                "eps": safe_num(d.get("epsEstimate")),
                "revenue": safe_num(d.get("revenueActual")),
                "revenueEstimate": safe_num(d.get("revenueEstimate")),
                "time": "After Close" if (d.get("hour") or d.get("time")) == "amc" else ("Before Open" if (d.get("hour") or d.get("time")) == "bmo" else "N/A"),
                "source": "Finnhub",
                "marketCap": safe_num(d.get("marketCapitalization")),
                "price": safe_num(d.get("close")),
                "sector": d.get("sector") or "N/A"
            })
        return out
    except Exception as e:
        log("❌ Finnhub Parse Error:" + str(e))
        return []

# 


def fetch_quote(symbol):
    url = f"https://financialmodelingprep.com/api/v3/profile/{symbol}?apikey={FMP_KEY}"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            j = r.json()
            if isinstance(j, list) and len(j) > 0:
                return {
                    "price": safe_num(j[0].get("price")),
                    "marketCap": safe_num(j[0].get("mktCap")),
                    "sector": j[0].get("sector")
                }
    except:
        pass
    return {}

def group_by_time(data):
    log("🧩 进入 group_by_time()，共收到 %d 条记录" % len(data))
    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    week_ahead = today + timedelta(days=7)
    month_ahead = today + timedelta(days=30)

    groups = {"yesterday": [], "today": [], "thisWeek": [], "thisMonth": []}
    invalid_count = 0

    for d in data:
        date_str = d.get("date")
        if not date_str:
            invalid_count += 1
            continue
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d").date()
        except Exception as e:
            invalid_count += 1
            log(f"⚠️ 无效日期格式: {date_str} ({e})")
            continue

        if dt == yesterday:
            groups["yesterday"].append(d)
        elif dt == today:
            groups["today"].append(d)
        elif today < dt <= week_ahead:
            groups["thisWeek"].append(d)
        elif week_ahead < dt <= month_ahead:
            groups["thisMonth"].append(d)

    log(f"✅ group_by_time() 完成，有效记录 {len(data)-invalid_count} 条，丢弃 {invalid_count} 条")
    for k in groups:
        log(f"  └─ {k}: {len(groups[k])} 条")
        groups[k] = sorted(groups[k], key=lambda x: x["date"])
    return groups


def fetch_all():
    log("🚀 开始 fetch_all() 流程")

    cache = cache_load()
    if cache:
        log("📁 使用缓存数据")
        return cache

    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    month_ahead = today + timedelta(days=30)
    from_date = yesterday.strftime("%Y-%m-%d")
    to_date = month_ahead.strftime("%Y-%m-%d")
    log(f"📅 日期范围: {from_date} → {to_date}")

    # === 尝试从 FMP 拉取 ===
    data = fetch_fmp(from_date, to_date)
    log(f"📊 从 FMP 拿到 {len(data)} 条记录")

    # === 若 FMP 为空，再从 Finnhub 拉取 ===
    if not data:
        data = fetch_finnhub(from_date, to_date)
        log(f"📊 从 Finnhub 拿到 {len(data)} 条记录")

        # ✅ 打印前20条记录预览
        try:
            log("🧾 Finnhub 数据前 20 条内容：")
            for i, d in enumerate(data[:20]):
                log(f"{i+1}. {json.dumps(d, ensure_ascii=False)}")
        except Exception as e:
            log(f"⚠️ 打印预览时出错: {e}")

    # === 若两者都为空 ===
    if not data:
        log("⚠️ 两个数据源都无数据，使用 mock 数据")
        data = [
            {"symbol": "AAPL", "date": today.strftime("%Y-%m-%d"), "eps": 1.2, "revenue": 9e10, "revenueEstimate": 9.2e10, "time": "After Close", "source": "Mock"},
            {"symbol": "MSFT", "date": today.strftime("%Y-%m-%d"), "eps": 2.4, "revenue": 7.8e10, "revenueEstimate": 8.0e10, "time": "Before Open", "source": "Mock"},
            {"symbol": "NVDA", "date": (today + timedelta(days=5)).strftime("%Y-%m-%d"), "eps": 1.05, "revenue": 4.6e10, "revenueEstimate": 4.8e10, "time": "After Close", "source": "Mock"},
        ]



    # === 改进版 yfinance 批量补全 ===
    import yfinance as yf
    from math import ceil

    log(f"🔍 使用 yfinance 批量补全市场信息，共 {len(data)} 条")
    symbols = list({d["symbol"] for d in data if d.get("symbol")})
    batch_size = 50  # ⬅️ 首次抓取更稳一些
    yf_data = {}

    total_batches = ceil(len(symbols) / batch_size)
    log(f"📦 yfinance 批次数: {total_batches}（每批 {batch_size} 支）; symbols={len(symbols)}")


    for i in range(0, len(symbols), batch_size):
        batch = symbols[i:i + batch_size]
        batch_no = (i // batch_size) + 1
        log(f"⏳ yfinance 批 {batch_no}/{total_batches}：{batch[0]} ~ {batch[-1]}")

        try:
            tickers = yf.Tickers(" ".join(batch))
            for sym, obj in tickers.tickers.items():
                info = getattr(obj, "info", {})
                yf_data[sym] = {
                    "price": safe_num(info.get("currentPrice")),
                    "marketCap": safe_num(info.get("marketCap")),
                    "sector": info.get("sector") or "N/A",
                }
            log(f"✅ 第 {batch_no} 批完成，累计获取 {len(yf_data)} 条")
        except Exception as e:
            log(f"⚠️ 第 {batch_no} 批失败: {e}")
            continue
        log(f"✅ 批 {batch_no} 完成，当前累计 {len(yf_data)} 条（本批 {len(batch)}）")
    log(f"✅ yfinance 全部完成，共返回 {len(yf_data)} 条公司信息")

    # === 合并补全数据 ===
    filled = 0
    for d in data:
        sym = d.get("symbol")
        if sym in yf_data:
            d.update(yf_data[sym])
            filled += 1
    log(f"✅ yfinance 补全结束，共更新 {filled} 条/总 {len(data)} 条")



    log(f"🧮 进入分组前数据量: {len(data)}")
    grouped = group_by_time(data)
    log("💾 准备写入缓存文件 calendar_cache.json")


    # ✅ 转换成单一数组结构（适配前端）
    merged = []
    for k in grouped:
        merged.extend(grouped[k])

    cache_save(merged)
    log(f"🏁 fetch_all() 结束，最终返回 {len(merged)} 条统一记录")
    return merged


if __name__ == "__main__":
    try:
        print("✅ Python 脚本开始执行", file=sys.stderr)
        merged = fetch_all()
        print("✅ fetch_all 完成", file=sys.stderr)
        print(json.dumps(merged, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))

