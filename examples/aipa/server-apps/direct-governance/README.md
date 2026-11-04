# Direct Governance

Invisible singleton policy decision point (PDP) for AIPA. Sail opens this app
when evaluation mode is **direct** and raises `demo.GetGovernanceDecision` with
a skeleton `demo.governanceDecision`. This app fills `log.result` /
`log.evaluations`, raises `LogEvaluation` at the Governance Console, raises
`LogEnforcement` when the result is Allow, and returns the same context.
Escalate (`Needs Review`) leaves layer 6 to the approval app.

Port **4114**. Trusted backend inspects the raise (actor appId + signature
`jku`) and fills the EvaluationLog. Not autostart — Sail opens it on first
intercept via `ensureAppWithListener`.

## Intercept rule

Sail asks this app for every `demo.SubmitOrder`, including the approver’s
second raise. Direct Allows that raise so it is not re-escalated.

| Message | Decision |
| --- | --- |
| `demo.SubmitOrder` from `aipa-approvals` or `aipa-fluxnova`, or raise metadata `signature` whose protected-header `jku` is `http://localhost:4110/.well-known/jwks.json` or `http://localhost:4112/.well-known/jwks.json` | Passed (`log.result`) → Sail Allows |
| Other `demo.SubmitOrder` | Needs Review → Sail Escalates (`GetApproval`) |

Direct never returns Failed / Deny. Receipts cite
**apa-ctl-005-propose-human-approval** (unsigned execute → human review).
