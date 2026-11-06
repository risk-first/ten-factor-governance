# Fluxnova

Two FDC3 apps share one Express/Vite process and origin (`http://localhost:4112`).
They are a Sail-native Fluxnova Tasklist: the inbox polls the engine; the view
completes a user task. Desktops talk to each other through Fluxnova, not through
a shared FDC3 session — so a second user can approve work the first user raised.

| | AIPA Fluxnova | AIPA Fluxnova Task |
| --- | --- | --- |
| `appId` | `aipa-fluxnova` | `aipa-fluxnova-view` |
| URL | `http://localhost:4112/list.html` | `http://localhost:4112/view.html` |
| Host | Invisible, singleton, not autostart, not searchable | Visible, singleton, not autostart, not searchable |
| Listens | `GetApproval`, `CreateTask` | `ViewTask` |
| Raises | `ViewTask`, `LogEnforcement`; signed subject action (`demo.SubmitOrder`, or broadcast) | — |

## Engine

AIPA `npm run dev` does not start Fluxnova. From this directory:

```bash
docker compose up -d
```

- REST: `http://localhost:8080/engine-rest` (override with `FLUXNOVA_REST`)
- Native Tasklist (optional): `http://localhost:8080/fluxnova/app/tasklist/` (login **demo** / **demo**)

On first API use the package deploys:

- `processes/aipa-create-task.bpmn` — generic `CreateTask`
- `processes/aipa-order-approval.bpmn` — order approval for `GetApproval` (order fields + Approve/Reject)

If the engine is down, intents fail with “engine not reachable”. **Restart AIPA** after backend changes (Express routes are loaded once).

## Entra (Sail apps, not the engine)

The inbox and view share origin `http://localhost:4112` and sign in with Microsoft
the same way Approvals does. Override via `server-apps/fluxnova/.env` if present;
otherwise `properties.json` (`entra.clientId` / `authority` / `tenantId` /
`redirectUri`). Add `http://localhost:4112` as a redirect URI on that app
registration (Approvals already uses `http://localhost:4110` on the same client).

Sign in on either page; MSAL uses `localStorage` and `/api/session` is
process-wide (one AIPA process = one signed-in Entra user). **Approve / Deny**
require that session, and the signed-in email must match the task assignee.
Set Sail Governance’s **Approver** to the reviewer’s Entra email so the
four-eyes check lines up. The Fluxnova engine stays open REST — it does not
talk to Entra.

## Flow

Two Sail users (two desktops) share the same Fluxnova engine. Sail Governance
opens the configured inbox (`aipa-fluxnova`) when it posts `GetApproval`; that
inbox polls `/api/tasks`.

1. Sail governance intercepts an unsigned `demo.SubmitOrder`, posts `GetApproval`
   with an `fdc3.approval` whose `subject` is the `fdc3.action` to run if approved,
   and fails the original raise with `ApprovalRequired`.
2. The **requester’s** inbox starts `aipa-order-approval`, assigns Sail
   Governance’s **Approver** email, and **holds** `GetApproval`. If the
   signed-in Entra user is that assignee, it opens `ViewTask` immediately.
   Otherwise it leaves the view closed — the approver may be on another desktop.
3. If the view was not opened on the raise, the **approver’s** inbox sees the
   new open task on the next poll and
   `raiseIntent('ViewTask', task, { appId: 'aipa-fluxnova-view' })` so Sail opens
   the task panel. The approver signs in with Microsoft. Approve / Deny call
   `POST /api/tasks/:id/complete` with `decision` only if the Entra session
   matches the task assignee.
4. The **requester’s** inbox sees the task leave the open list, reads `decision`
   from the engine, and only then performs the embedded `fdc3.action` (signed
   `raiseIntent` or `broadcast`). The original raiser already received
   `ApprovalRequired` from Sail; deny does not fill.

`Open` on a row uses the same `ViewTask` path. Terminal rows can be **Clear**’d
from the local worklist (the engine history remains).

## Intents

| Intent | App | Behaviour |
| --- | --- | --- |
| `GetApproval` | inbox | Start a Fluxnova user task, raise `LogEnforcement` (hold), keep the raise open. Open `ViewTask` when the signed-in user is the assignee. On approved complete, execute the subject action and raise `LogEnforcement` (allow). |
| `CreateTask` | inbox | Start `aipa-create-task`. Same inbox/view path; no FDC3 action on complete. |
| `ViewTask` | view | Render the task (order, proposed action, requester/approver). Handler stays open until Approve or Deny. |

## Raise CreateTask from FDC3 Workbench

| Field | Value |
| --- | --- |
| Intent | `CreateTask` |
| Target | `aipa-fluxnova` |
| Context | `{ "type": "demo.task", "name": "Review blotter", "description": "Optional", "assignee": "demo" }` |

The result is `{ "type": "demo.taskResult", "processInstanceId": "…", "taskId": "…" }`.

Sail Governance’s **Approver** email is written onto `GetApproval` and becomes
the Fluxnova task assignee. Starting an approval without that field returns
`400`.
