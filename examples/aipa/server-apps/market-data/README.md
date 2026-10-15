# Market Data

Server-app data proxy for quotes (Finnhub) and OHLC charts (`yahoo-finance2`).

## Intents

| Intent | Context in | Result / effect |
| --- | --- | --- |
| `ViewChart` | `fdc3.instrument` | Load ticker into the chart UI |
| `demo.GetPriceHistory` | instrument / list / portfolio / chart | Returns `demo.priceHistory` for peer apps (e.g. Risk) |
| `GetAppData` | `fdc3.data.dataRequest` (`id.dataId` = `market-data-prices`) | Returns `fdc3.data.tabularData` for the loaded closes |
| `ViewData` | `fdc3.data.tabularData` | Replace-in-place: render the table/chart from the payload |

Does not sign FDC3 contexts.

## `fdc3.data` discovery

Joined to the Desktop Agent user channel, the app listens for
`fdc3.data.advertiseDatasets` and broadcasts an `fdc3.data.appOffer` for dataset
`market-data-prices` (`contextType`: `fdc3.data.tabularData`). Consumers raise
targeted `GetAppData` with that `dataId` to pull columns + rows (optional
embedded `fdc3.chart`).

History for `GetPriceHistory` is still served by `/api/chart/:symbol?days=N`.
