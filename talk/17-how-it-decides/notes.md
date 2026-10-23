# 17 — How it decides

## Say

- One thread in the ISO/IEC 42001 AIMS, written as Gemara artefacts.
- Threat: unauthorized-trade-execution. The assistant submits an order on its own.
- Risk: unauthorized-trading. That is the trading-authority risk it creates.
- Control: apa-ctl-006-execute-prohibit. demo.SubmitOrders must never come from the assistant identity.
- Policy: AIPA Policy, proportional-authority. Autonomous execute is prohibited in all circumstances.
- apa-ctl-005 sits in front of that: an order proposal needs recorded human approval. That is Fluxnova, via fdc3.approval.
- The YAML is the point: this is Governance as Code. The plugin evaluates an action against this versioned chain. The reference-id fields are the joins.

## Don't put on the slide

- Full catalog files. The excerpts are the story.

## Citations

- AI Portfolio Assistant catalogs under src/data/governance/finos/ai-portfolio-assistant: threat unauthorized-trade-execution, risk unauthorized-trading, control apa-ctl-006-execute-prohibit, policy apa-policy.
- ISO/IEC 42001:2023. Artificial intelligence management system.
- fdc3.approval extension. examples/aipa/fdc3-extensions/fdc3.approval/

## Timing

3 min
