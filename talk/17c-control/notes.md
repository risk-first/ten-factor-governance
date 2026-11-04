# 17c — Control

## Say

- This is the control the example actually evaluates. apa-ctl-005-propose-human-approval.
- Objective: a recorded first human approval before any agent-initiated order executes.
- The assessment requirement is what Sail and the PDP run: demo.SubmitOrder is Passed only when Approvals or Fluxnova raised it, or signed it with their JWKS. Otherwise Needs Review and GetApproval.
- The assistant must not submit the order itself. Self-approval is a control failure.
- The AIR lines are not decoration. This is least privilege, a human-in-the-loop on the execute tool, a recorded decision, and an evaluation receipt.
- The threats join closes the chain: unauthorized-trade-execution.

## Don't put on the slide

- The full assessment-requirement paragraph. The Passed / Needs Review rule is enough to say.

## Citations

- src/data/governance/finos/ai-portfolio-assistant/gemara/components/ai-portfolio-assistant/control.yaml — apa-ctl-005-propose-human-approval.
- FINOS AI Governance Framework: AIR-PREV-018, AIR-PREV-019, AIR-DET-011, AIR-DET-021.
- examples/aipa: sail-governance, Direct / JEV, Approvals / Fluxnova.

## Timing

1 min
