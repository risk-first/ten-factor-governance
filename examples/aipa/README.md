# AIPA FDC3 Assisting Apps

Runnable FDC3 specialist apps for the [AI Portfolio Assistant](../../docs/artifacts/finos/ai-portfolio-assistant/)
example. Modelled on [`@finos/fdc3-example-apps`](https://github.com/finos/FDC3/tree/main/toolbox/fdc3-example-apps).

The Agent UI + harness cover the assistant chat path via
[`fdc3.ai`](./fdc3-extensions/fdc3.ai/). Sail's `sail-governance` extension
(`sail-extensions/sail-governance`) can intercept unsigned `demo.SubmitOrder`
and send `GetApproval` to Approvals.

## Apps

| App | Port | Intents | Notes |
| --- | --- | --- | --- |
| Portfolio | 4100 | `GetPortfolio`, `ViewHoldings` | Broadcasts `fdc3.portfolio` / position / instrument |
| Risk | 4101 | `demo.GetPortfolioRisk`, `demo.RunStressScenario`, `ViewAnalysis` | finance-toolkit metrics; pulls OHLC via `demo.GetPriceHistory`; signs results; FRED for rf/stress |
| Research | 4102 | `demo.GetResearch`, `ViewInstrument`, `ViewNews`, `ViewResearch` | Signs `demo.researchBundle`; EDGAR + Finnhub |
| Market Data | 4103 | `ViewChart`, `demo.GetPriceHistory`, `GetAppData`, `ViewData` | Finnhub / yahoo-finance2; `fdc3.data` data app |
| Order Entry | 4104 | `demo.CreateOrder`, `ViewOrders` | Signs `demo.order` / `demo.orderList`; blotter |
| Execution | 4105 | `demo.SubmitOrder` | Signs `fdc3.transactionResult` |
| Agent UI | 4106 | raises `AskAgent` | Front-end chat; `fdc3.ai` PrivateChannel; file attach (`fdc3.data.file`) |
| Agent harness | 4107 | listens `AskAgent` | Rita-derived agent loop; generic FDC3 tools; streams `fdc3.ai.*`; LLM via `/api/query` |
| Markdown Viewer | 4108 | `ViewData` | Front-end; renders `fdc3.data.markdown` (open / replace-in-place) |
| Discoverability | 4109 | — | Responder on `fdc3.discoverability` (apps / intents / context types) |
| Approvals | 4110 | `GetApproval` and siblings | Invisible singleton; Entra login; signed re-raise of `demo.SubmitOrder` |
| App Directory | 4099 | — | Combined AppD JSON |

## Quick start

```bash
cd examples/aipa
cp .env.example .env   # optional API keys
npm install
npm start
```

From the repo root:

```bash
npm run aipa:dev
```

Combined App Directory:

`http://localhost:4099/static/generated/aipa-fdc3-apps.json`

Point a Desktop Agent (e.g. FDC3 Sail) at that URL. Apps also expose local
**API** buttons so you can exercise backends without an agent.

## Data sources

| Need | Source | Env |
| --- | --- | --- |
| Quotes | [Finnhub](https://finnhub.io/) | `FINNHUB_API_KEY` (personal-use free tier) |
| Charts | [`yahoo-finance2`](https://www.npmjs.com/package/yahoo-finance2) + [Lightweight Charts](https://github.com/tradingview/lightweight-charts) | none |
| Macro (stress) | [FRED](https://fred.stlouisfed.org/docs/api/fred/) | `FRED_API_KEY` |
| Filings | [SEC EDGAR](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | `SEC_USER_AGENT` |
| News | Finnhub company-news | same Finnhub key |

Offline **fixtures** under `common/fixtures/` are used when keys are missing or
live calls fail.

## FDC3 Security (trusted backend)

Uses **FDC3 3.0 beta** and [`@finos/fdc3-security`](https://www.npmjs.com/package/@finos/fdc3-security),
following the same trusted-backend pattern as
[`encrypted-channel-receiver`](https://github.com/finos/FDC3/tree/master/toolbox/fdc3-example-apps/server-apps/encrypted-channel-receiver):

- Backend: `createJosePrivateFDC3Security` + `setupWebsocketServer`
- Frontend (with Desktop Agent): `connectRemoteHandlers` then
  `exchangeData('sign-context', { context })`
- Private keys never enter the browser; HTTP data routes that return already-signed
  envelopes are also fine for local API demos without an agent

Signing apps expose:

- `GET /.well-known/jwks.json`
- `POST /api/sign`
- Secure-boundary WebSocket (`exchangeData('sign-context', …)`)

Signed intent results return `{ context, metadata }` (`signature`, `antiReplay`
on `ContextMetadata`). Contexts that **MUST** be signed:

- `demo.portfolioRisk`
- `demo.researchBundle`
- `demo.stressScenarioResult`
- `demo.order`
- `demo.orderList`

## Layout

```text
examples/aipa/
  calm/             # CALM architecture.json, decorators, diagrams
  common/           # contexts, fixtures, signing, data clients
  server-apps/      # apps with a trusted Node backend
  front-end-apps/   # Agent UI, Markdown Viewer (browser-only)
  directory/        # aggregated AppD
  main.ts           # Vite multi-app runner
```

CALM: [`calm/`](./calm/) — `npm run calm:validate` / `npm run calm:diagrams`.
