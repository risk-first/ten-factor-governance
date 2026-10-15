# Discoverability

FDC3 **responder** for [`fdc3.discoverability`](../../fdc3-extensions/fdc3.discoverability/).

Listens on app channel `fdc3.discoverability` and replies to catalog requests:

| Request | Reply |
| --- | --- |
| `fdc3.discoverability.discoverApps` | `fdc3.discoverability.appDirectory` |
| `fdc3.discoverability.discoverIntents` | `fdc3.discoverability.intentList` |
| `fdc3.discoverability.discoverContextTypes` | `fdc3.discoverability.contextTypeList` |

Catalog is derived from the combined AIPA App Directory (`GET /api/catalog`).

Port **4109** (`aipa-discoverability`). Agent harness callers use `fdc3_discover_apps` / `fdc3_discover_intents` / `fdc3_discover_context_types`.
