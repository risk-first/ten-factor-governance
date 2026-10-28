# Fluxnova

Invisible FDC3 bridge for Fluxnova (Camunda-shaped) processes. Native Tasklist
runs in a browser tab (not framed in Sail).

| | AIPA Fluxnova |
| --- | --- |
| `appId` | `aipa-fluxnova` |
| URL | `http://localhost:4112/bridge.html` |
| Host | Invisible, singleton, autostart, not searchable |
| Listens | `CreateTask`, `GetApproval` |
| Raises | `demo.SubmitOrder` (after Tasklist approve) |

The Sail popup for this app has **Open Fluxnova Tasklist**, which opens
`http://localhost:8080/fluxnova/app/tasklist/` in a new tab. Login **demo** / **demo**.
The activity log shows CreateTask / GetApproval starts and Tasklist completions.

## Engine

AIPA `npm run dev` does not start Fluxnova. From this directory:

```bash
docker compose up -d
```

- REST: `http://localhost:8080/engine-rest` (override with `FLUXNOVA_REST`)
- Tasklist: `http://localhost:8080/fluxnova/app/tasklist/`

On first API use the package deploys:

- `processes/aipa-create-task.bpmn` — generic `CreateTask`
- `processes/aipa-order-approval.bpmn` — order approval for `GetApproval` (order form + Approve/Reject)

If the engine is down, intents fail with “engine not reachable”. **Restart AIPA** after backend changes (Express routes are loaded once).

## GetApproval (order approval)

1. In Sail Governance config, set **GetApproval app** to `aipa-fluxnova` (or raise `GetApproval` at `aipa-fluxnova` from Workbench).
2. On `GetApproval` with `fdc3.approval`, the bridge starts `aipa-order-approval`, assigns the requester’s supervisor (demo org map → Tasklist user `demo`), and holds `getResult()`.
3. Open Tasklist as **demo** / **demo**, open the **Approve order** task, review the order fields, set **Decision** to Approve or Reject, complete.
4. The bridge polls completion. On **Approve** it app-signs the subject context and raises `demo.SubmitOrder` at `aipa-execution`, then forwards the IntentResult. On **Reject** it fails `GetApproval`.

Supervisor map (see `src/org.ts`): `rob@finos.org` and `demo` → Tasklist assignee `demo`.

## Raise CreateTask from FDC3 Workbench

| Field | Value |
| --- | --- |
| Intent | `CreateTask` |
| Target | `aipa-fluxnova` |
| Context | `{ "type": "demo.task", "name": "Review blotter", "description": "Optional", "assignee": "demo" }` |

The result is `{ "type": "demo.taskResult", "processInstanceId": "…", "taskId": "…" }`.

No `sail.manifest` entry and no governance wrap for `CreateTask`.
