# Agent UI

FDC3 **Agent UI** for the AI Portfolio Assistant demo.

Raises `AskAgent` with `fdc3.ai.agentQuery` at `aipa-agent-harness`, receives a
**PrivateChannel**, and renders streaming `fdc3.ai.agentDelta` / final
`fdc3.ai.agentAnswer`. Sends `fdc3.ai.agentCancel` on Stop.

Also listens for user-channel `fdc3.portfolio` so the chat can align with the
Portfolio app (demo step 1 — observe).

## Provenance

Chat UX and turn flow were inspired by
[OpenBB Agent Rita](https://github.com/OpenBB-finance/agents)
(`repos/agents/agent-rita`). The implementation here is AIPA-specific: FDC3
`fdc3.ai` over a PrivateChannel to the Agent harness (no OpenBB Workspace SSE /
widget bridge). Rita itself is not vendored in this tree.

See [`../../fdc3-extensions/fdc3.ai/README.md`](../../fdc3-extensions/fdc3.ai/README.md).
