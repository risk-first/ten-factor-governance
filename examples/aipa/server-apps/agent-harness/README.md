# Agent harness

FDC3 **Agent harness** for the AI Portfolio Assistant.

| Piece | Role |
| --- | --- |
| `src/agent/` | Slim agent loop (Rita-derived): native helpers, local document tools, generic `fdc3_*` tool schemas (including `fdc3_discover_*`). |
| `src/llm.ts` + `src/backend.ts` | Node LLM proxy (`POST /api/query` SSE) with `function_call` re-POST for browser FDC3 execution. |
| `src/fdc3Executor.ts` | Browser DesktopAgent executor for deferred FDC3 tools. |
| `src/AgentHarnessApp.tsx` | FDC3 app: `AskAgent` → PrivateChannel; stages `fdc3.data.file`; streams `fdc3.ai.*`. |

## Flow

1. Agent UI opens a session (`AskAgent`) and may broadcast `fdc3.data.file` then `fdc3.ai.agentQuery` (`fileIds` refs).
2. Node `streamText` loop runs in-process tools; FDC3 tools pause and emit SSE `function_call`.
3. Browser runs `DesktopAgent` / `Channel` APIs and re-POSTs `toolResults` until `done`.
4. Results stream to the UI as `agentDelta` / `agentAnswer` (markdown, citations, artifacts).

`fdc3_discover_apps` still uses the full App Directory reply on channel `fdc3.discoverability`. Before that result is re-POSTed to the LLM, the browser executor summarizes each app to `{ appId, title?, description?, listensFor?, raises? }` so the model is not flooded with AppD payload. Intent and context-type catalogs are already compact and pass through unchanged.

No SQL in Phase 1. No MCP bridge yet — document extract is local (text/md/html; pdf/docx stub).

## Provenance

Derived from [OpenBB Agent Rita](https://github.com/OpenBB-finance/agents) (MIT). Provider selection follows Rita `lib/providers.ts`. Loop/tools adapted without Workspace SSE / SQL / MCP.

## Configure LLM

- `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `GROQ_API_KEY` / `OLLAMA_BASE_URL`
- optional `DEFAULT_MODEL`

## Protocol

See [`../../fdc3-extensions/fdc3.ai/README.md`](../../fdc3-extensions/fdc3.ai/README.md) and [`../../fdc3-extensions/fdc3.data/README.md`](../../fdc3-extensions/fdc3.data/README.md).
