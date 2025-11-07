# test_finnhub_esea.py
"""
测试：从 Finnhub 获取指定股票 (ESEA) 的财报预期数据
要求：
- 安装 requests 库： pip install requests
- 替换 FINNHUB_KEY 为你自己的 API Key
"""

import requests
from datetime import datetime, timedelta

FINNHUB_KEY = "d46d1epr01qgc9es8a40d46d1epr01qgc9es8a4g"  # ⚠️ 替换为真实 key
SYMBOL = "ESEA"

# 设定查询时间窗口（财报发布前后 ±120 天）
today = datetime.utcnow()
start = (today - timedelta(days=120)).strftime("%Y-%m-%d")
end = (today + timedelta(days=240)).strftime("%Y-%m-%d")

url = f"https://finnhub.io/api/v1/calendar/earnings?symbol={SYMBOL}&from={start}&to={end}&token={FINNHUB_KEY}"

print(f"🔍 请求 URL:\n{url}\n")

resp = requests.get(url, timeout=20)
if resp.status_code != 200:
    print(f"❌ HTTP {resp.status_code}")
    exit()

data = resp.json()
rows = data.get("earningsCalendar", [])
if not rows:
    print("⚠️ 没有返回 earningsCalendar 数据")
    exit()

found = False
for r in rows:
    date = r.get("date")
    if not date:
        continue
    # 查找目标日期 2025-08-13 附近的记录
    if date.startswith("2025-08-13"):
        found = True
        print("✅ 找到记录:")
        print(f"  Symbol: {r.get('symbol')}")
        print(f"  Date: {r.get('date')}")
        print(f"  Time: {r.get('time')}")
        print(f"  EPS Actual: {r.get('epsActual')}")
        print(f"  EPS Estimate: {r.get('epsEstimate')}")
        print(f"  Revenue Actual: {r.get('revenueActual')}")
        print(f"  Revenue Estimate: {r.get('revenueEstimate')}")
        break

if not found:
    print("⚠️ 没有找到 ESEA 在 2025-08-13 附近的财报记录。")
