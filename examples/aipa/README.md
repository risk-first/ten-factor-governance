# AI Portfolio Assistant (AIPA) demo

This folder is the **runnable demo** for Ten Factor Governance: an FDC3 suite
in which a portfolio manager’s AI assistant can observe holdings, analyse risk,
pull research, and propose trades — while **governance decides what the agent
is allowed to do**.

Deterministic apps (Portfolio, Risk, Market Data, Research, Order Entry,
Execution) do the numbers. The Agent UI + harness chat with an LLM and raise
FDC3 intents. A Sail Desktop Agent extension (`sail-governance`) is the policy
enforcement point: on `demo.SubmitOrder` it asks a PDP (Direct or JEV), then
**Allow**, **Escalate** to human approval (Approvals / Fluxnova), or **Deny**.
That is the observe → analyse → explain → recommend → propose → execute arc
with enforceable authority boundaries.

### Browse the story & catalogs (published site)

Start on the website — Gemara twins, architecture, deployment, demo steps, and
ISO/IEC 42001 AIMS — then come back here to run the code:

| | |
| --- | --- |
| **Example overview** | [AI Portfolio Assistant](https://tenfactorgovernance.org/docs/artifacts/finos/ai-portfolio-assistant/) |
| Demo walkthrough | [Demo steps](https://tenfactorgovernance.org/docs/artifacts/finos/ai-portfolio-assistant/demo-steps) |
| CALM architecture | [Architecture](https://tenfactorgovernance.org/docs/artifacts/finos/ai-portfolio-assistant/architecture) |
| How to deploy / ports | [Deployment](https://tenfactorgovernance.org/docs/artifacts/finos/ai-portfolio-assistant/deployment) |
| Gemara catalogs | [Gemara tree](https://tenfactorgovernance.org/docs/artifacts/finos/ai-portfolio-assistant/gemara/) |
| Ten Factor home | [tenfactorgovernance.org](https://tenfactorgovernance.org/) |

In-repo mirrors of those docs live under
[`docs/artifacts/finos/ai-portfolio-assistant/`](../../docs/artifacts/finos/ai-portfolio-assistant/).

### Runtime sketch

- Chat: Agent UI → harness (`AskAgent` / [`fdc3.ai`](./fdc3-extensions/fdc3.ai/))
- Sensitive raise: Sail Governance → Direct or JEV (`demo.GetGovernanceDecision`)
  → Allow / Escalate (`GetApproval` + `ApprovalRequired`) / Deny
- Sail **Evaluation**: `off` / `direct` / `jev`; **Approval**: Approvals or Fluxnova
  (+ approver). JEV scores `rules.json` via LM Studio System One (`CLEF_*`);
  the harness chat model is separate (`DEFAULT_MODEL` / OpenAI-compatible).

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

### 1. Configure `.env`

```bash
cd examples/aipa
cp .env.example .env
```

Edit `.env` before the first run. Template comments live in
[`.env.example`](./.env.example).

Without market-data keys the apps still run on fixtures. Without an LLM key,
chat (`AskAgent`) will fail; without CLEF, only **Direct** Sail evaluation
works (not **JEV**). See [Data sources](#data-sources) for provider links.


#### Data sources

| Need | Source | Env |
| --- | --- | --- |
| Quotes | [Finnhub](https://finnhub.io/) | `FINNHUB_API_KEY` (personal-use free tier) |
| Charts | [`yahoo-finance2`](https://www.npmjs.com/package/yahoo-finance2) + [Lightweight Charts](https://github.com/tradingview/lightweight-charts) | none |
| Macro (stress) | [FRED](https://fred.stlouisfed.org/docs/api/fred/) | `FRED_API_KEY` |
| Filings | [SEC EDGAR](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | `SEC_USER_AGENT` |
| News | Finnhub company-news | same Finnhub key |

Offline **fixtures** under `common/fixtures/` are used when keys are missing or
live calls fail.

### 2. Run the AIPA apps + App Directory

```bash
cd examples/aipa
npm install
npm start
```

From the repo root (after `.env` exists under `examples/aipa/`):

```bash
npm run aipa:dev
```

That starts the assisting apps, the combined App Directory on **4099**, and the
Sail Governance extension host on **9101**.

Combined App Directory:

`http://localhost:4099/static/generated/aipa-fdc3-apps.json`

### 3. Run FDC3 Sail v2 (pluggable-sail)

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

### 4. Add the AIPA App Directory in Sail

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

### 5. Chrome flags for localhost

Because the demo is running on localhost using HTTP rather than HTTP/S, we need to make some changes to chrome's flags - Chrome rightly disapproves of HTTP sites and we need to get it to allow them.

Open [chrome://flags](chrome://flags), then:

1. **Insecure origins treated as secure**
   (`#unsafely-treat-insecure-origin-as-secure`) — set to **Enabled** and put
   this comma-separated list in the text box:

   ```text
   http://localhost:8090,http://localhost:3002
   ```

   Add further `http://localhost:<port>` origins if you hit secure-context
   errors on other AIPA ports.

2. **Local Network Access Checks** (`#local-network-access-check`) — set to
   **Disabled** so Sail can load the AIPA iframes / call other localhost ports
   without Local Network Access prompts or blocks.

Relaunch Chrome when it prompts. These are local-dev only; reset both flags
afterward.

**Also:** Approvals / Fluxnova Sign-in uses MSAL popups. If the login window is
blocked, allow **Pop-ups and redirects** for `http://localhost:8090` (and
`http://localhost:4110` / `4112` if needed) via the padlock → **Site settings**.


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
