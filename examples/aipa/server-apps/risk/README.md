# Risk

Server-app for `demo.GetPortfolioRisk` and `demo.RunStressScenario`. Results are
signed by the trusted backend (`demo.portfolioRisk`, `demo.stressScenarioResult`).

Risk pulls OHLC history from Market Data via `demo.GetPriceHistory`, then computes
VaR, Sharpe, drawdown, volatility, and correlation with `@railpath/finance-toolkit`.
Stress scenarios use FRED macro series when `FRED_API_KEY` is set.
