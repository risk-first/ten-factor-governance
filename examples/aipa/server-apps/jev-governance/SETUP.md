# Set up LM Studio for JEV governance

LM Studio must serve **two models on one server** (port 1234): the harness chat
model, and a **decision** model for JEV. This file only covers the decision
model.

JEV scores [`rules.json`](rules.json) on
[System One](https://lmstudio.ai/docs/developer/jev-compat/systemone)
(`POST /v1/systemone`). `jev-governance` sends `"model": CLEF_MODEL` (the loaded
instance id, default `clef-flash-artemis`). Do not point `CLEF_URL` at
`/v1/chat/completions`.

Needs LM Studio **0.4.26+** with a llama.cpp runtime that knows architecture
`clef` (2.64+). Older Studio builds fail with `unknown model architecture: 'clef'`.

## 1. Install and start the local server

1. Install [LM Studio](https://lmstudio.ai/download).
2. Open **Developer** (or **Local Server**) and **Start server**.
3. Leave the port at **1234** (`http://127.0.0.1:1234`).

## 2. Download a decision model

Search the catalog for a **Decision model**, or open:

- [turintech/clef-flash-artemis](https://lmstudio.ai/turintech/clef-flash-artemis)
  — recommended file `Clef-Flash-Artemis-IQ4_XS.gguf`.
- [turintech/clef-artemis](https://lmstudio.ai/turintech/clef-artemis) — larger
  Clef; set `CLEF_MODEL` to that instance’s id.

Click **Use Model in LM Studio** / download.

## 3. Load it and note the instance id

Load the decision model. The `model` field on `POST /v1/systemone` must be the
loaded instance id (Hub default is often `clef-flash-artemis`).

Before you load, open the model’s load settings (gear / **Developer → Load**)
and raise the llama.cpp batch so a real `demo.SubmitOrder` fits:

- **Context Length** — at least **2048** (4096 is safer).
- **Batch Size** / physical batch (`n_batch` / `n_ubatch`) — at least **1024**,
  in the same ballpark as context length.

The Studio default physical batch is often **512**. Two `rules.json` questions
plus the full order as `state` is about **560+ tokens**, so System One then
returns HTTP 500:

`clef-flash-artemis: input (561 tokens) is too large to process. increase the
physical batch size (current batch size: 512).`

JEV fail-safes that to **Needs Review**. The smoke curl in the next section uses
a one-line `state`, so it can succeed while a live order fails. If the load UI
only shows context length, raise that first; some Studio builds keep `n_ubatch`
at 512 until you set batch size explicitly.

Confirm with the curl below rather than assuming `clef-flash`.

## 4. Check System One

```bash
curl http://127.0.0.1:1234/v1/systemone \
  -H "Content-Type: application/json" \
  -d '{
    "model": "clef-flash-artemis",
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
or chat model mean the decision model is not loaded under that id.

List what LM Studio thinks is loaded:

```bash
curl http://127.0.0.1:1234/api/v1/models
```

Look for `"type": "decision"` and a loaded instance id; put that id in `CLEF_MODEL`.

## 5. AIPA `.env`

From `examples/aipa/` (`cp .env.example .env` if needed):

```bash
CLEF_URL=http://127.0.0.1:1234/v1/systemone
CLEF_MODEL=clef-flash-artemis
CLEF_TIMEOUT_MS=30000
```

Local inference is slower than a hosted Clef — keep `CLEF_TIMEOUT_MS` generous.
Restart AIPA after changing these.

## 6. Run the demo

1. `npm start` in `examples/aipa`.
2. Sail **Evaluation** = **jev**.

If LM Studio is down, the decision model is not loaded, or `/v1/systemone`
errors, JEV fail-safes to **Needs Review** (human approval), not Deny.
