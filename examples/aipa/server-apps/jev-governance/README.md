# JEV Governance

Invisible singleton policy decision point (PDP) for AIPA. Sail opens this app
when evaluation mode is **jev** and raises `demo.GetGovernanceDecision`. The
browser registers that intent via `remoteIntentHandler`; the trusted backend
`POST`s `{ rules, activity }` to `{JEV_ENGINE_URL}/decide` (from the AIPA `.env`,
default `http://localhost:3000`) with committed [`rules.json`](rules.json) and
the raise as `{ kind: "raiseIntent", … }`.

Port **4113**. Not autostart. Do **not** load the JEV Sail extension
(`http://localhost:3000/sail-extension/index.js`) — that would double-wrap the
Desktop Agent. AIPA’s `sail-governance` is the PEP.

## Engine and Clef

Any engine that implements `POST /decide` works. Point AIPA at it with
`JEV_ENGINE_URL` (default `http://localhost:3000`). Optional `ENGINE_API_KEY`
is sent as `Authorization: Bearer`. Start the engine yourself — AIPA does not
spawn it.

For a local demo, run
[governance-compliance-jev](https://github.com/SeeWhatsOn/governance-compliance-jev)
(`bun index.ts`) with `CLEF_URL` / `CLEF_MODEL` / `CLEF_TIMEOUT_MS` in **that**
process. Load a decision model in LM Studio — step-by-step in [`SETUP.md`](SETUP.md). 

## Rules

Committed `rules.json` watches `demo.SubmitOrder`:

- **apa-ctl-006-execute-prohibit** — AI identity (`aipa-agent-harness`) must not execute → Block / Failed
- **apa-ctl-005-propose-human-approval** — unsigned execute needs human review → Review / Needs Review

Worst-wins is inside the engine. Thresholds `{ block: 0.8, review: 0.5 }`.
Sail maps `log.result`: Passed → Allow, Needs Review → Escalate, Failed → Deny.
This app raises `LogEvaluation` for every decision and `LogEnforcement` when
the result is Allow or Deny. Escalate leaves layer 6 to the approval app.
