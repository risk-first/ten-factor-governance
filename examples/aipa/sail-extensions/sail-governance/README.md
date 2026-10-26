# Sail Governance

Sail `wrapServer` MITM for AIPA. Raising apps and Execution stay approval-agnostic:
they raise and handle `demo.SubmitOrder` as usual. This extension parks unsigned
raises and sends `GetApproval` to [`aipa-approvals`](../../server-apps/approvals/README.md).

Protocol background: [`fdc3.approval` / Sail governance](../../fdc3-extensions/fdc3.approval/sail-governance.md).
This package is the hard-coded first cut — no policy YAML evaluation or DENY.
Layer 5 / 6 receipts use Gemara `EvaluationLog` / `EnforcementLog` types from
`@gemara/react`.

## Hosting

Not a Vite app (do not put this under `server-apps/`). Sail v2-web loads it from
the pinned list in `FDC3-Sail/packages/sail-v2-web/src/extensions.ts`:

`http://localhost:9100/sail-governance/src/index.ts`

The extension-server scan root
`examples/aipa/sail-extensions` is in `SAIL_EXTENSION_SCAN_DIRS`.
`@finos/sail-extension` is a `file:` dep on the local Sail checkout — do not publish.

`sail.config` (Sail Configuration popup) has three screens. Settings persist
`{ mode }` under storage key `settings`. Default is `intercept`. Layer 5 / 6
receipts are appended to gitignored `temp/evaluation-log.json` and
`temp/enforcement-log.json` (same pattern as Execution’s `temp/submit-order.json`).

| Screen | Role |
| --- | --- |
| Sail Governance | Mode: `off` (forward everything) or `intercept`. |
| Evaluation Log | Layer 5 receipts: actor, intent, policy/control versions, `ALLOW` / `REQUIRE_APPROVAL`. |
| Enforcement Log | Layer 6 receipts: forward, or hold and raise `GetApproval`. |

## Intercept rule

| Message | Decision |
| --- | --- |
| Not `raiseIntentRequest` | Forward |
| `GetApproval` / `UpdateApproval` / `CancelApproval` / `ViewApproval` / `ReviewApproval` | Forward |
| `demo.SubmitOrder` from `aipa-approvals`, or raise metadata `signature` whose protected-header `jku` is `http://localhost:4110/.well-known/jwks.json` | ALLOW |
| Other `demo.SubmitOrder` | REQUIRE_APPROVAL |
| Everything else | ALLOW |

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
