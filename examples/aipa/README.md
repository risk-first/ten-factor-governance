# AIPA FDC3 Assisting Apps

Runnable FDC3 specialist apps for the
[AI Portfolio Assistant](../../docs/artifacts/finos/ai-portfolio-assistant/)
example. Browse the published Gemara catalogs and AIMS docs on
[tenfactorgovernance.org](https://tenfactorgovernance.org/docs/artifacts/finos/ai-portfolio-assistant/).
Modelled on [`@finos/fdc3-example-apps`](https://github.com/finos/FDC3/tree/main/toolbox/fdc3-example-apps).

The Agent UI + harness cover the assistant chat path via
[`fdc3.ai`](./fdc3-extensions/fdc3.ai/). Sail's `sail-governance` extension
(`sail-extensions/sail-governance`) is the policy enforcement point: it
intercepts `demo.SubmitOrder`, asks Direct or JEV for
`demo.GetGovernanceDecision`, and enforces Allow / Escalate (`GetApproval` +
`ApprovalRequired` to the raiser) / Deny. Sail
settings split into **Evaluation** (`off` / `direct` / `jev`) and **Approval**
(GetApproval app + approver). JEV scores committed rules via LM Studio
`POST /v1/systemone` with a loaded **decision** model (instance id in `CLEF_MODEL`);
the harness keeps QWEN on chat completions.

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
| Approvals | 4110 | inbox: `GetApproval` and siblings; view: `ViewApproval` | Two apps, one origin: invisible singleton inbox + visible singleton view; shared Entra login; view signs and raises `demo.SubmitOrder` |
| Governance Console | 4111 | `LogEvaluation`, `LogEnforcement` | Invisible autostart; Gemara L5/L6 store |
| Fluxnova | 4112 | inbox: `GetApproval`, `CreateTask`; view: `ViewTask` | Two apps, one origin: invisible singleton inbox polls Fluxnova; visible singleton task panel for approve/deny. Inbox executes the subject `fdc3.action` after the engine records approval (second-user path). |
| JEV governance | 4113 | `demo.GetGovernanceDecision` | Invisible singleton PDP; scores rules.json on LM Studio System One |
| Direct governance | 4114 | `demo.GetGovernanceDecision` | Invisible singleton PDP; unsigned SubmitOrder → human review |
| App Directory | 4099 | — | Combined AppD JSON |

## Quick start

### 1. Run the AIPA apps + App Directory

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

That starts the assisting apps, the combined App Directory on **4099**, and the
Sail Governance extension host on **9101**.

Combined App Directory:

`http://localhost:4099/static/generated/aipa-fdc3-apps.json`

The JSON is rewritten at request time: `localhost` / `127.0.0.1` in app
`details.url` (and icon/screenshot URLs) become the hostname you called the
directory with (e.g. your LAN IP), so phones on the same Wi‑Fi can resolve
apps. On-disk `directory/static/generated/aipa-fdc3-apps.json` stays localhost.

Apps also expose local **API** buttons so you can exercise backends without an
agent.

### 2. Run FDC3 Sail v2 (pluggable-sail)

Use the **`pluggable-sail`** branch of
[FINOS FDC3-Sail](https://github.com/finos/FDC3-Sail/tree/pluggable-sail) — that
is the Desktop Agent build with loadable extensions (including governance).

```bash
git clone https://github.com/finos/FDC3-Sail.git
cd FDC3-Sail
git checkout pluggable-sail
npm install
cd packages/sail-v2-web
npm run dev
```

Open Sail at `http://localhost:8090`.

`pluggable-sail` already lists `http://localhost:9101/src/index.ts` in
`SAIL_EXTENSION_URLS`, so with AIPA running the **Sail Governance** extension
loads automatically (Settings → Sail Governance for Evaluation / Approval).

### 3. Add the AIPA App Directory in Sail

In Sail, open directory / AppD settings and add (or activate) this directory:

| Label | URL |
| --- | --- |
| AIPA | `http://localhost:4099/static/generated/aipa-fdc3-apps.json` |

Leave other directories inactive if you want only the demo apps. After refresh
you should see Portfolio, Risk, Order Entry, Execution, Approvals / Fluxnova,
governance PDPs, and the rest of the table above.

**Order of startup:** start AIPA first (so **4099** and **9101** are up), then
Sail. If Sail started earlier, reload the page after AIPA is online so the
extension import and directory fetch succeed.

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
  fdc3-extensions/  # Proposed context/intent specs (approval, gemara, …)
  directory/        # aggregated AppD
  sail-extensions/  # Sail Desktop Agent extension (port 9101)
  main.ts           # Vite multi-app runner + sail-governance host
```

CALM: [`calm/`](./calm/) — `npm run calm:validate` / `npm run calm:diagrams`.
