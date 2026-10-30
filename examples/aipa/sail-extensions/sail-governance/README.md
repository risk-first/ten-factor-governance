# Sail Governance

Sail `wrapServer` MITM for AIPA — the **policy enforcement point (PEP)**.
Raising apps and Execution stay approval-agnostic: they raise and handle
`demo.SubmitOrder` as usual. This extension intercepts that intent, asks a
**policy decision point (PDP)** FDC3 app (`aipa-direct-governance` or
`aipa-jev-governance`) via `demo.GetGovernanceDecision`, then enforces the
filled Gemara EvaluationLog: **Passed** → forward, **Needs Review** →
`GetApproval`, **Failed** → `IntentDeliveryFailed`.

It is not the policy engine. Direct and JEV fill `log.result` /
`log.evaluations` and raise **LogEvaluation** (layer 5) plus **LogEnforcement**
(layer 6) when they Allow or Deny. Approvals / Fluxnova raise **LogEnforcement**
when they hold `GetApproval` and again when they execute an approved order.
This extension does not raise those intents.

Protocol background: [`fdc3.approval` / Sail governance](../../fdc3-extensions/fdc3.approval/sail-governance.md).
Layer 5 / 6 receipts are Gemara documents routed to the
[Governance Console](../../server-apps/governance-console/README.md) via
[`fdc3.gemara`](../../fdc3-extensions/fdc3.gemara/README.md).


### Evaluation

Which policy decision point (if any) Sail asks:

| Setting | Values | Default |
| --- | --- | --- |
| Mode | `off` (forward everything) / `direct` (`aipa-direct-governance`) / `jev` (`aipa-jev-governance`) | `direct` |

### Approval

Used only when evaluation **Escalates** (`Needs Review` → `REQUIRE_APPROVAL`).
Controls stay visible when evaluation is `off` (they are unused).

| Setting | Values | Default |
| --- | --- | --- |
| GetApproval app | `none` / `aipa-approvals` / `aipa-fluxnova` | `aipa-approvals` |
| Approver | Fluxnova Tasklist assignee written onto `GetApproval` | `demo` |

- **none** — post `GetApproval` to any connected listener (prefer fluxnova, then approvals); does not force-open an app.
- **aipa-approvals** — open/post to the Approvals stub inbox.
- **aipa-fluxnova** — open/post to the Fluxnova inbox (engine task; view opens on the approver’s poll).

## Intercept

| Message | Decision |
| --- | --- |
| Not `raiseIntentRequest` | Forward |
| Intent other than `demo.SubmitOrder` | Forward (`GetGovernanceDecision`, `GetApproval`, `LogEvaluation`, `LogEnforcement` are never intercepted) |
| Mode `off` | Forward |
| `demo.SubmitOrder` | Ask the configured PDP; wait for `demo.governanceDecision`; map `log.result` |

`log.result` mapping: **Passed** → ALLOW (`forwardAllowedSubmitOrder`);
**Needs Review** → REQUIRE_APPROVAL (existing GetApproval park);
**Failed** → DENY (`raiseIntentResponse` error `IntentDeliveryFailed`).
Missing PDP / timeout / malformed result fail-safe to **Needs Review**.

Trusted-approver Allow (approvals / Fluxnova second raise) is a **PDP**
decision, not a PEP bypass. Direct applies it in
[`direct-governance`](../../server-apps/direct-governance/README.md); JEV
applies the same check then scores
[`rules.json`](../../server-apps/jev-governance/rules.json)
(one question: trusted Approvals / Fluxnova signature) on LM Studio System One.

`REQUIRE_APPROVAL` does **not** hold the original `raiseIntentRequest` (that hits
`appLaunchTimeout`):

1. `post` a `raiseIntentResponse` (`intent: demo.SubmitOrder`, `source` = chosen approvals app).
2. `addPendingResolution` for the original uuid.
3. Resolve the GetApproval target from settings (`open` when a concrete appId is set), then
   `post` an `intentEvent` with a new uuid and an `fdc3.approval` whose `subject`
   is the original raise.
4. Remap a later `intentResultRequest` for that uuid back to the original raiser’s
   parked `getResult()`.

Do not `receive()` a synthetic `GetApproval` as the original app — that would leak
a GetApproval `raiseIntentResponse` to the raiser.
