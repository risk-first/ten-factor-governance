# CALM control-catalog decorators

CALM [decorators](https://calm.finos.org) that attach the governance-factors
control catalogs to elements of `../architecture.json` without bloating the
architecture document.

The **AI Portfolio Assistant is the chat harness** (no separate `chat-harness`
node). Chat turns and model I/O are still firewalled at the Governance Gateway.

| Decorator | Catalog | Applies to |
| --- | --- | --- |
| `aigf-user-app-model-firewalling` | AIGF guidance (`AIR-PREV-003`, `AIR-PREV-002`) | AIPA chat + gateway + model path |
| `ccc-ma-refarch-gateway-firewalling` | CCC Multi-Agent Ref Arch (`CN02`) | Agent-ingress + LLM-egress path |
| `gemara-aipa-controls` | AIPA Gemara twin controls | Assistant, FDC3, gateway |
| `ccc-k8s-host-controls` | CCC Managed Kubernetes | `aipa-k8s`, `governance-runtime-k8s` |
| `ccc-object-storage-controls` | CCC Object Storage | Evidence record path |

`type` is `control-catalog`. Each `data.catalog` path is relative to the repo
root. Nodes and relationships also carry first-class `controls` blocks where
enforcement is architectural.
