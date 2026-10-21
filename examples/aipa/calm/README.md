# AI Portfolio Assistant — CALM

Complete [CALM](https://calm.finos.org) architecture for the AIPA example:
FDC3 desktop apps, AI Portfolio Assistant as chat harness, Governance Runtime (FDC3 + agent-ingress +
LLM-egress firewalling), Artifact Repository, Decisions and Evidence Record,
in-firewall foundation model, and Managed Kubernetes hosts.

Lives under [`examples/aipa/`](../) with the runnable FDC3 assisting apps.

Paired with:

- Gemara twins under `src/data/governance/finos/ai-portfolio-assistant/gemara/`
- ISO/IEC 42001 AIMS under `src/data/governance/finos/ai-portfolio-assistant/iso/`
- AIGF / CCC catalogs under `src/data/governance/finos/{aigf,ccc-*}/`
- Narrative docs under `docs/artifacts/finos/ai-portfolio-assistant/`
- Runnable apps under [`examples/aipa/server-apps/`](../server-apps/) (`npm run aipa:dev`)

## Validate

```bash
npm run calm:validate
```

## Control catalogs on components

Two mechanisms:

1. **First-class `controls`** on nodes/relationships (schema-valid requirements).
2. **Decorators** in [`decorators/`](./decorators/) (`type: control-catalog`) that
   bind AIGF, CCC MA Ref Arch, Gemara, CCC K8s and CCC Object Storage catalogs
   to CALM `unique-id`s without bloating `architecture.json`.

The assistant **is** the chat harness. Chat and model traffic still go through the Governance Gateway because of
[AIGF AIR-PREV-003](../../../src/data/governance/finos/aigf/guidance.yaml) and
[CCC.MARefArc.CN02](../../../src/data/governance/finos/ccc-ma-refarch/controls.yaml)
— not only for FDC3 intents.

## Diagrams

Docify templates live in `templates/diagrams.md`. Run from the repo root:

```bash
npm run calm:diagrams           # mermaid + SVG (needs Chrome / Chromium)
npm run calm:diagrams:mermaid   # mermaid only (no browser)
```

| Artifact | Path | In git? |
| --- | --- | --- |
| Mermaid sources | `diagrams/*.mmd` | **No** — derived from docify |
| Combined docify markdown | `diagrams/docify-output.md` | **No** — derived |
| SVGs for Docusaurus | `static/img/calm/ai-portfolio-assistant/*.svg` | **No** — derived |

Only `diagrams/README.md` is kept under `diagrams/`. Docs pages under
`docs/artifacts/finos/ai-portfolio-assistant/` reference the SVG paths, so run
`npm run calm:diagrams` (or ensure CI does) before `npm run build` / local docs preview.
