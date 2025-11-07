# server/tools/yf_revenue_fetch.py
import sys, json, math
import yfinance as yf

def to_safe_number(x):
    try:
        if x is None: return None
        if isinstance(x, float) and (math.isnan(x) or math.isinf(x)): 
            return None
        return float(x)
    except:
        return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "symbol required"}, ensure_ascii=False, allow_nan=False))
        return
    sym = sys.argv[1].strip().upper()
    tk = yf.Ticker(sym)

    # 1) 先尝试 earnings（yfinance 自带的季度营收/净利）
    out = []
    try:
        q = tk.quarterly_earnings  # DataFrame: columns=['Earnings', 'Revenue']
        if q is not None and not q.empty:
            for idx, row in q.iterrows():
                # idx 是 Period (时间)，row['Revenue'] 可能是 NaN
                out.append({
                    "symbol": sym,
                    "period": str(idx),
                    "revenue": to_safe_number(row.get("Revenue")),
                    "earnings": to_safe_number(row.get("Earnings"))
                })
    except Exception as e:
        pass

    # 2) 如果上面为空，再兜底用 quarterly_financials（Total Revenue 行）
    if not out:
        try:
            qf = tk.quarterly_financials  # rows as index, columns are periods
            if qf is not None and not qf.empty:
                if "Total Revenue" in qf.index:
                    row = qf.loc["Total Revenue"]
                    for period, val in row.items():
                        out.append({
                            "symbol": sym,
                            "period": str(period),
                            "revenue": to_safe_number(val)
                        })
        except Exception as e:
            pass

    print(json.dumps({"ok": True, "symbol": sym, "items": out}, ensure_ascii=False, allow_nan=False))

if __name__ == "__main__":
    main()
