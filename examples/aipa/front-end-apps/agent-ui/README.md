# AIPA Agent UI

Thin CopilotKit chat front end.

- Opens `AskAgent` with `fdc3.ai.agentQuery` → session **PrivateChannel**.
- Chat is CopilotKit `CopilotChat` with `Fdc3PrivateChannelAgent`: AG-UI transport only (`agui.run` / `agui.event`).
- No harness HTTP from this app — LLM calls stay harness browser ↔ Node.
