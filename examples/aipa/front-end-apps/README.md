# front-end-apps

Browser-only FDC3 apps (no `src/backend.ts`). Vite + static files; they talk to
the Desktop Agent from the page.

| App | Port | Role |
| --- | --- | --- |
| Agent UI | 4106 | Chat front end; raises `AskAgent` |
| Markdown Viewer | 4108 | Renders `fdc3.data.markdown` via `fdc3.open` / `ViewData` |

Apps with a trusted Node backend live under [`../server-apps/`](../server-apps/).
