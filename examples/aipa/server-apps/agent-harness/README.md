# AIPA Agent Harness

FDC3 app + local Node CopilotRuntime bridge.

| Path | Role |
| --- | --- |
| `src/AgentHarnessApp.tsx` | FDC3 app: `AskAgent` → PrivateChannel; `agui.run` / `agui.event`. |
| `src/backend.ts` | Express `CopilotRuntime` at `/api/copilotkit`. |
| `src/agui/` | Loop agent + desktop-tool bridge. |

1. Agent UI opens a session (`AskAgent` + `fdc3.ai.agentQuery`); harness returns a PrivateChannel (listeners already attached).
2. UI sends `agui.run` (`RunAgentInput`). Harness bridges to CopilotRuntime over same-origin HTTP.
3. Every AG-UI event is broadcast as `fdc3.ai.agui.event` with monotonic `seq`.
4. Stop: UI aborts locally (unsubscribes); harness aborts the active run on unsubscribe/disconnect.
