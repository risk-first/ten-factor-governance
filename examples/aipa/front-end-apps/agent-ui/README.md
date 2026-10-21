# Agent UI

Front-end FDC3 **Agent UI** (no backend) for the AI Portfolio Assistant demo.

- Opens `AskAgent` → session **PrivateChannel**; follow-ups reuse the channel.
- Attach files → broadcast `fdc3.data.file`, then `fdc3.ai.agentQuery` with `fileIds`.
- Renders streaming markdown, status, citations, HTML artifacts, and suggestion chips.
- Observes user-channel `fdc3.portfolio`.

## Provenance

Chat UX inspired by [OpenBB Agent Rita](https://github.com/OpenBB-finance/agents). Wire protocol is AIPA `fdc3.ai` / `fdc3.data`.

See [`../../fdc3-extensions/fdc3.ai/README.md`](../../fdc3-extensions/fdc3.ai/README.md).
