import yfinance as yf
import json
import pandas as pd

def print_section(title, content):
    print("\n" + "=" * 80)
    print(f"📊 {title}")
    print("=" * 80)
    if isinstance(content, (dict, list)):
        try:
            print(json.dumps(content, indent=2, ensure_ascii=False))
        except Exception:
            print(str(content))
    elif isinstance(content, pd.DataFrame):
        with pd.option_context("display.max_rows", 50, "display.max_columns", 10, "display.width", 160):
            print(content.head(20))
    else:
        print(content)


def test_yfinance_all(symbol="AAPL"):
    print(f"🚀 Fetching all yfinance data for {symbol} ...\n")

    ticker = yf.Ticker(symbol)

    # === 基本信息 ===
    print_section("Ticker Info (公司基本信息)", ticker.info)

    # === 股价历史 ===
    print_section("History (股价历史 1y)", ticker.history(period="1y"))

    # === 股息与拆股历史 ===
    print_section("Dividends (分红记录)", ticker.dividends)
    print_section("Splits (拆股记录)", ticker.splits)

    # === 财报 ===
    print_section("Financials (损益表 Income Statement)", ticker.financials)
    print_section("Quarterly Financials (季度损益表)", ticker.quarterly_financials)

    # === 资产负债表 ===
    print_section("Balance Sheet (资产负债表)", ticker.balance_sheet)
    print_section("Quarterly Balance Sheet (季度资产负债表)", ticker.quarterly_balance_sheet)

    # === 现金流 ===
    print_section("Cashflow (现金流)", ticker.cashflow)
    print_section("Quarterly Cashflow (季度现金流)", ticker.quarterly_cashflow)

    # === 盈利预告 ===
    print_section("Earnings Dates (财报预告)", ticker.earnings_dates)

    # === 机构持股与内部人持股 ===
    print_section("Major Holders (主要股东)", ticker.major_holders)
    print_section("Institutional Holders (机构股东)", ticker.institutional_holders)
    print_section("Mutual Fund Holders (共同基金持股)", ticker.mutualfund_holders)

    # === 分析师预测 ===
    print_section("Analyst Recommendations (分析师评级)", ticker.recommendations)
    print_section("Upgrades/Downgrades (评级历史)", ticker.upgrades_downgrades)
    print_section("Earnings Forecast (盈利预测)", ticker.earnings_forecasts)
    print_section("Revenue Forecast (营收预测)", ticker.revenue_forecasts)

    # === 可选数据 ===
    print_section("Calendar (事件日历)", ticker.calendar)
    print_section("ISIN", ticker.isin)
    print_section("ISIN (国际证券识别号)", getattr(ticker, "isin", None))

    # === 新闻 ===
    print_section("News (新闻列表)", ticker.news)

    # === 期权数据 ===
    print_section("Options (期权到期日)", ticker.options)
    if ticker.options:
        opt = ticker.option_chain(ticker.options[0])
        print_section(f"Option Chain - Calls ({ticker.options[0]})", opt.calls)
        print_section(f"Option Chain - Puts ({ticker.options[0]})", opt.puts)

    print("\n✅ 完成！已展示 yfinance 可访问的全部主要字段。")



if __name__ == "__main__":
    test_yfinance_all("AAPL")
