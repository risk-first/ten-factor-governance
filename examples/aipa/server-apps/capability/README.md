# Capability

FDC3 **responder** for [`fdc3.capability`](../../fdc3-extensions/fdc3.capability/).

Listens for intent **`GetCapabilities`** with context `fdc3.capability.request` and returns the catalog slice selected by `capability`:

| `capability` | IntentResult |
| --- | --- |
| `apps` | `fdc3.capability.appDirectory` |
| `intents` | `fdc3.capability.intentList` |
| `contextTypes` | `fdc3.capability.contextTypeList` |
| `contextSchema` | `fdc3.capability.contextSchema` |
| `appDirectoryRecord` | `fdc3.capability.appDirectoryRecord` |

Port **4109** (`aipa-capability`). Agent harness callers use `fdc3_discover_apps` / `fdc3_discover_intents` / `fdc3_discover_context_types` / `fdc3_discover_context_schema` / `fdc3_discover_app_directory_record`.
