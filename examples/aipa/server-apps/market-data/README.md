# Market Data

Server-app data proxy for quotes (Finnhub) and OHLC charts (`yahoo-finance2`).
Handles `ViewChart` and `demo.GetPriceHistory` (returns `demo.priceHistory` for
peer apps such as Risk). Does not sign FDC3 contexts.

History is served by the existing `/api/chart/:symbol?days=N` endpoint; the
GetPriceHistory intent assembles one call per ticker into `demo.priceHistory`.
