import requests
import json
from datetime import datetime, timedelta

FINN_KEY = "d46d1epr01qgc9es8a40d46d1epr01qgc9es8a4g"

def main():
    today = datetime.now().date()
    from_date = (today - timedelta(days=2)).strftime("%Y-%m-%d")
    to_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")

    url = f"https://finnhub.io/api/v1/calendar/earnings?from={from_date}&to={to_date}&token={FINN_KEY}"
    print(f"📅 Fetching: {url}")

    try:
        r = requests.get(url, timeout=20)
        print(f"🔗 HTTP 状态码: {r.status_code}")
        if r.status_code != 200:
            print("❌ 请求失败:", r.text[:300])
            return

        data = r.json()
        if "earningsCalendar" not in data:
            print("⚠️ 无 earningsCalendar 字段, 实际返回:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return

        items = data["earningsCalendar"]
        print(f"✅ 拿到 {len(items)} 条记录")
        print("\n🧾 前 10 条原始数据结构:")
        for i, d in enumerate(items[:10]):
            print(f"\n{i+1}. {json.dumps(d, indent=2, ensure_ascii=False)}")

        # === 检查所有键出现频率 ===
        key_count = {}
        for d in items:
            for k in d.keys():
                key_count[k] = key_count.get(k, 0) + 1

        print("\n📊 字段出现频率统计:")
        for k, v in sorted(key_count.items(), key=lambda x: -x[1]):
            print(f"{k:<25} {v} 次")

    except Exception as e:
        print("❌ 出错:", e)

if __name__ == "__main__":
    main()
