# Sail Governance

Sail `wrapServer` MITM for AIPA. Raising apps and Execution stay approval-agnostic:
they raise and handle `demo.SubmitOrder` as usual. This extension parks unsigned
raises and sends `GetApproval` to [`aipa-approvals`](../../server-apps/approvals/README.md).

Protocol background: [`fdc3.approval` / Sail governance](../../fdc3-extensions/fdc3.approval/sail-governance.md).
This package is the hard-coded first cut — no policy YAML evaluation or DENY.
Layer 5 / 6 receipts are built as Gemara documents and raised to the
[Governance Console](../../server-apps/governance-console/README.md) via
[`fdc3.gemara`](../../fdc3-extensions/fdc3.gemara/README.md) (`LogEvaluation` /
`LogEnforcement`).

## Hosting

Not an FDC3 app (do not put this under `server-apps/`). This package runs
`sail-extension-server --port 9101` (`npm run dev`). AIPA `npm run dev` starts
that host. Sail hosts pin the same URL for browser and Node:

`http://localhost:9101/src/index.ts`

`@finos/sail-extension` and `@finos/sail-extension-server` are `file:` deps on
the local Sail checkout — do not publish.

`sail.config` has one screen: mode `off` (forward everything) or `intercept`
(default). Settings persist `{ mode }` under storage key `settings`. Evidence
lives in the Governance Console app, not in this extension.

## Intercept rule

| Message | Decision |
| --- | --- |
| Not `raiseIntentRequest` | Forward |
| Intent other than `demo.SubmitOrder` | Forward |
| `demo.SubmitOrder` from `aipa-approvals`, or raise metadata `signature` whose protected-header `jku` is `http://localhost:4110/.well-known/jwks.json` | ALLOW |
| Other `demo.SubmitOrder` | REQUIRE_APPROVAL |

After each `ALLOW` / `REQUIRE_APPROVAL` on `demo.SubmitOrder`, Sail opens
`aipa-governance-console` if needed and posts `LogEvaluation` then
`LogEnforcement`.

`REQUIRE_APPROVAL` does **not** hold the original `raiseIntentRequest` (that hits
`appLaunchTimeout`):

1. `post` a `raiseIntentResponse` (`intent: demo.SubmitOrder`, `source: aipa-approvals`).
2. `addPendingResolution` for the original uuid.
3. `open('aipa-approvals')` if needed, wait for its `GetApproval` listener, then
   `post` an `intentEvent` with a new uuid and an `fdc3.approval` whose `subject`
   is the original raise.
4. Remap a later `intentResultRequest` for that uuid back to the original raiser’s
   parked `getResult()`.

Do not `receive()` a synthetic `GetApproval` as the original app — that would leak
a GetApproval `raiseIntentResponse` to the raiser.
