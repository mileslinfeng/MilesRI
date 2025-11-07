import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from openbb import obb

def get_upcoming_earnings(days_ahead: int = 7, enrich: bool = True):
    start = datetime.today().date()
    end = start + timedelta(days=days_ahead)
    print(f"📅 Fetching earnings calendar: {start} → {end}")

    df = obb.equity.calendar.earnings(
        start_date=str(start),
        end_date=str(end),
        provider="nasdaq"   # ✅ 指定使用 nasdaq 免费源
    ).to_df()


    if df.empty:
        print("⚠️ No upcoming earnings found.")
        return df

    df = df.reset_index(drop=True)
    df = df[["symbol", "date", "epsEstimate", "revenueEstimate"]]
    df.columns = ["Ticker", "Earnings Date", "EPS Est", "Revenue Est"]

    if enrich:
        print("🔍 Enriching company info via yfinance...")
        infos = []
        for t in df["Ticker"].head(30):
            try:
                info = yf.Ticker(t).info
                infos.append({
                    "Ticker": t,
                    "Name": info.get("shortName"),
                    "Sector": info.get("sector"),
                    "MarketCap": info.get("marketCap"),
                    "Price": info.get("currentPrice"),
                })
            except Exception as e:
                infos.append({
                    "Ticker": t,
                    "Name": None,
                    "Sector": None,
                    "MarketCap": None,
                    "Price": None
                })
        extra = pd.DataFrame(infos)
        df = pd.merge(df, extra, on="Ticker", how="left")

    df["Earnings Date"] = pd.to_datetime(df["Earnings Date"]).dt.strftime("%Y-%m-%d")
    df = df.sort_values("Earnings Date")

    print(f"✅ Retrieved {len(df)} upcoming earnings entries.")
    return df

if __name__ == "__main__":
    result = get_upcoming_earnings(days_ahead=7, enrich=True)
    if not result.empty:
        print(result.head(20))
        result.to_csv("upcoming_earnings_openbb.csv", index=False)
        print("💾 Saved to 'upcoming_earnings_openbb.csv'")
