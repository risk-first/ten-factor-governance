# 1. App lifecycle configuration

Proposed Sail-specific AppD configuration:

```json
{
  "hostManifests": {
    "sail": {
      "invisible": true,
      "singleton": true,
      "autostart": true,
      "searchable": false
    }
  }
}
```

| Field | Default | Meaning |
| --- | --- | --- |
| `invisible` | `false` | Start without a visible panel, using a hidden hosted page connected to FDC3. Icons appear in the Sail top bar; clicking one presents the page in a dialog. |
| `singleton` | `false` | **At most one** live instance per app ID within one Sail session. |
| `autostart` | `false` | Ensure **at least one** live instance of the app after Sail loads (and after catalog refreshes). If an instance already exists or a launch is in flight, do nothing. Invisible apps without `autostart` are not restored across a page reload. |
| `searchable` | `true` | Means the app is available to choose in the directory picker (already implemented and used for conformance) |

These settings are independent. Invisible apps can subsequently become visible (dialog). Singleton is an instance policy, not a presentation policy. Autostart is deployment-controlled; an arbitrary announcement cannot cause future automatic launches beyond ensuring ≥1 for apps already in the active directories.

Combined (`autostart` + `singleton`): exactly one instance.

Opening or raising an intent to a singleton reuses its instance. If it is starting, concurrent launches share the same pending launch. Intent delivery waits until the handler is ready. Closing its dialog hides the hosted page rather than terminating it. React must preserve the iframe and its browsing context via shadow-DOM named slots (same approach as grid panels); moving or recreating an iframe can reload it, so the layout implementation must verify instance continuity.
