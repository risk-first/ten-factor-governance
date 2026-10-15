# Agent harness

FDC3 **Agent harness** for the AI Portfolio Assistant.

| Piece | Role |
| --- | --- |
| `src/llm.ts` + `src/backend.ts` | Node LLM proxy (`POST /api/query` SSE). |
| `src/AgentHarnessApp.tsx` | FDC3 app: `AskAgent` → `createPrivateChannel()`, stream `fdc3.ai.*` to the Agent UI. |

UI ↔ harness conversation is only `fdc3.ai` on a session PrivateChannel (one
`AskAgent` open; follow-up `agentQuery` on the same channel). The harness keeps
per-channel chat history and sends the full message list to `/api/query` so the
LLM sees prior turns. Tool /
data-app calls (risk, research, …) are raised separately by the harness via the
Desktop Agent when wired for the demo.

## Provenance

Derived from [OpenBB Agent Rita](https://github.com/OpenBB-finance/agents)
(`repos/agents/agent-rita`, MIT). In particular, `src/llm.ts` provider selection
and env vars (`OPENAI_*`, OpenRouter, Groq, Ollama) follow Rita’s
`lib/providers.ts` patterns. The FDC3 intent / PrivateChannel surface and
`/api/query` SSE bridge are AIPA originals — Rita’s OpenBB Workspace SSE /
widget bridge is not used, and Rita sources are not vendored here.

## Configure LLM

Copy `.env.example` values into the AIPA package `.env` (or export):

- `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `GROQ_API_KEY` / `OLLAMA_BASE_URL`
- optional `DEFAULT_MODEL` (e.g. `openai:gpt-4o-mini`)

Without keys the harness still answers with an offline fallback so the FDC3
path can be exercised.

## Protocol

See [`../../fdc3-extensions/fdc3.ai/README.md`](../../fdc3-extensions/fdc3.ai/README.md).
