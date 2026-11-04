# JEV Governance

Invisible singleton policy decision point (PDP) for AIPA. Sail opens this app
when evaluation mode is **jev** and raises `demo.GetGovernanceDecision`. The
browser registers that intent via `remoteIntentHandler`; the trusted backend
scores committed [`rules.json`](rules.json) against the raise (`{ kind:
"raiseIntent", … }`) on LM Studio
[System One](https://lmstudio.ai/docs/developer/jev-compat/systemone)
(`POST /v1/systemone`). Thresholds and worst-wins run in this process.

Port **4113**. Not autostart.

## Clef

| Env | Default |
| --- | --- |
| `CLEF_URL` | `http://127.0.0.1:1234/v1/systemone` |
| `CLEF_MODEL` | `clef-flash-artemis` (must match the loaded LM Studio **instance id**) |
| `CLEF_TIMEOUT_MS` | `30000` |

Load a decision model in LM Studio — step-by-step in [`SETUP.md`](SETUP.md).
Do not point `CLEF_URL` at `/v1/chat/completions`.

## Rules

Committed `rules.json` has **one** question on `demo.SubmitOrder`
(**apa-ctl-005-propose-human-approval**): was this raised or signed by
`aipa-approvals` or `aipa-fluxnova`? If `state.signature.trusted` is true →
Allow. Otherwise → Review (human approval).

Clef `state` includes that `signature` check (`present`, `jku`, `trustedAppId`,
`trustedJku`, `trusted`, `reason`) — the same inspection Direct uses.
Thresholds `{ block: 1, review: 0.5 }` — `block: 1` disables Deny, so a miss
**escalates** instead of blocking. Score below 0.5 is Allow.
Sail maps `log.result`: Passed → Allow, Needs Review → Escalate, Failed → Deny.
This app raises `LogEvaluation` for every decision and `LogEnforcement` when
the result is Allow or Deny. Escalate leaves layer 6 to the approval app.
If Clef is down or a score is missing, the result is **Needs Review**.
