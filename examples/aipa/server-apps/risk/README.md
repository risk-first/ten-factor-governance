# Risk

Server-app for `demo.GetPortfolioRisk` and `demo.RunStressScenario`. Results are
signed by the trusted backend (`demo.portfolioRisk`, `demo.stressScenarioResult`).

Risk pulls OHLC history from Market Data via `demo.GetPriceHistory` (or HTTP
fallback to `http://localhost:4103/api/chart/:symbol` when no Desktop Agent is
present), then computes VaR, Sharpe, drawdown, volatility, and correlation with
`@railpath/finance-toolkit`. Stress scenarios use FRED macro series when
`FRED_API_KEY` is set.
