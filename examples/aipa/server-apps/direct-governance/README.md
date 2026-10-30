# Direct Governance

Invisible singleton policy decision point (PDP) for AIPA. Sail opens this app
when evaluation mode is **direct** and raises `demo.GetGovernanceDecision` with
a skeleton `demo.governanceDecision`. This app fills `log.result` /
`log.evaluations`, raises `LogEvaluation` at the Governance Console, raises
`LogEnforcement` when the result is Allow, and returns the same context.
Escalate (`Needs Review`) leaves layer 6 to the approval app.

Port **4114**. Browser listener only (no secrets). Not autostart — Sail opens
it on first intercept via `ensureAppWithListener`.

## Intercept rule

Copied from the previous Sail hard-coded table. Sail still skips trusted
approvers before asking this app (so an approver’s second raise is not
re-escalated). Direct applies the same rule if it does see the raise.

| Message | Decision |
| --- | --- |
| `demo.SubmitOrder` from `aipa-approvals` or `aipa-fluxnova`, or raise metadata `signature` whose protected-header `jku` is `http://localhost:4110/.well-known/jwks.json` or `http://localhost:4112/.well-known/jwks.json` | Passed (`log.result`) → Sail Allows |
| Other `demo.SubmitOrder` | Needs Review → Sail Escalates (`GetApproval`) |

Direct never returns Failed / Deny. Receipts cite
**apa-ctl-005-propose-human-approval** (unsigned execute → human review).
