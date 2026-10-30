# Set up LM Studio for JEV governance

LM Studio must serve **two models on one server** (port 1234): the harness chat
model, and a **decision** model for JEV. This file only covers the decision
model. 

JEV scores [`rules.json`](rules.json) on
[System One](https://lmstudio.ai/docs/developer/jev-compat/systemone)
(`POST /v1/systemone`). The engine sends `"model": CLEF_MODEL` (`clef` or
`clef-flash`, default `clef-flash`), so the loaded decision model’s API id must
match. Do not point `CLEF_URL` at `/v1/chat/completions`.

## 1. Install and start the local server

1. Install [LM Studio](https://lmstudio.ai/download).
2. Open **Developer** (or **Local Server**) and **Start server**.
3. Leave the port at **1234** (`http://127.0.0.1:1234`).

## 2. Download a decision model

Search the catalog for a **Decision model**, or open:

- [turintech/clef-flash-artemis](https://lmstudio.ai/turintech/clef-flash-artemis)
  — matches default `CLEF_MODEL=clef-flash`. Recommended file
  `Clef-Flash-Artemis-IQ4_XS.gguf`.
- [turintech/clef-artemis](https://lmstudio.ai/turintech/clef-artemis) — use if
  you set `CLEF_MODEL=clef`.

Click **Use Model in LM Studio** / download. The catalog key is often
`turintech/clef-flash-artemis`; that is not what the engine sends.

## 3. Load it as `clef-flash` (or `clef`)

Load the decision model. The `model` field on `POST /v1/systemone` must be the
loaded instance id, and it must be exactly `clef-flash` or `clef`.

In LM Studio, set the loaded model’s **API identifier** (sometimes labelled
identifier / alias) to `clef-flash` if you downloaded Flash, or `clef` for the
full Clef. JIT load by substring can also work if the catalog name contains
`clef-flash` and you send that id — confirm with the curl below rather than
assuming.

## 4. Check System One

```bash
curl http://127.0.0.1:1234/v1/systemone \
  -H "Content-Type: application/json" \
  -d '{
    "model": "clef-flash",
    "state": "demo.SubmitOrder from aipa-order-entry",
    "questions": {
      "smoke": {
        "type": "noul",
        "instructions": "Does this action require human review?"
      }
    }
  }'
```

A good reply has `answers.smoke.noul` (a number 0–1). Errors about an unknown
or chat model mean the decision model is not loaded under `clef-flash`.

List what LM Studio thinks is loaded:

```bash
curl http://127.0.0.1:1234/api/v1/models
```

Look for `"type": "decision"` and a loaded instance id of `clef-flash`.

## 5. AIPA `.env`

From `examples/aipa/` (`cp .env.example .env` if needed):

```bash
JEV_ENGINE_URL=http://localhost:3000
ENGINE_API_KEY=
```

`JEV_ENGINE_URL` is whoever implements `POST /decide`. `CLEF_*` belong on the
engine process, not AIPA. Local inference is slower than Cloudflare’s 2 s
default — keep `CLEF_TIMEOUT_MS` generous on the engine.

## 6. Run the demo

1. Start the engine (for example `bun index.ts` in
   [governance-compliance-jev](https://github.com/SeeWhatsOn/governance-compliance-jev))
   with `CLEF_URL=http://127.0.0.1:1234/v1/systemone`, `CLEF_MODEL=clef-flash`,
   `CLEF_TIMEOUT_MS=30000`.
2. `npm start` in `examples/aipa`.
3. Sail **Evaluation** = **jev**. Do **not** add
   `http://localhost:3000/sail-extension/index.js` to Sail.

If LM Studio is down, the decision model is not loaded, or `/v1/systemone`
errors, JEV fail-safes to **Needs Review** (human approval), not Deny.
