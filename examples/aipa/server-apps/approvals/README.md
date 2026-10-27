# Approvals

Entra-backed human approval for [`fdc3.approval`](../../fdc3-extensions/fdc3.approval/README.md).

Two FDC3 apps share one Express/Vite process and origin (`http://localhost:4110`):

| | AIPA Approvals | AIPA Approval View |
| --- | --- | --- |
| `appId` | `aipa-approvals` | `aipa-approval-view` |
| URL | `http://localhost:4110/list.html` | `http://localhost:4110/view.html` |
| Host | Invisible, singleton, autostart, not searchable | Visible, singleton, not autostart, not searchable |
| Listens | `GetApproval`, `UpdateApproval`, `CancelApproval`, `ReviewApproval` | `ViewApproval` |
| Raises | `ViewApproval` | signed `demo.SubmitOrder` |

This is the stub of Fluxnova Approvals. The worklist is stored in
`server-apps/approvals/temp/approvals.json` (gitignored), same pattern as
Execution’s submit-order log, so history survives a restart.

## Hosting

Port **4110**. Both AppD records use `injectApi: "3.0"`. Sail parks `GetApproval` against the inbox; the view is the reviewer and the signer of the approved subject action.

Override Entra via `server-apps/approvals/.env` if present; otherwise
`properties.json` (`entra.clientId` / `authority` / `tenantId` / `redirectUri`).
`redirectUri` is the shared origin (`http://localhost:4110`). Sign in once on either
page; MSAL uses `localStorage` and `/api/session` is process-wide.

## Flow

1. Sail governance (`sail-extensions/sail-governance`) intercepts an unsigned
   `demo.SubmitOrder` and posts `GetApproval` with an `fdc3.approval` whose
   `subject` is `{ type: fdc3.action, action: raiseIntent, intent: demo.SubmitOrder, … }`.
2. The inbox holds `GetApproval`, adds a row, and
   `raiseIntent('ViewApproval', approval, { appId: 'aipa-approval-view' })` so Sail
   reuses the singleton view (or launches it). The inbox then `fdc3.close()`s
   itself to hide its dialog; the autostart instance stays connected.
3. The view’s `ViewApproval` handler stays open. **Approve** requires a valid Entra
   session. The view signs the subject context (`POST /api/sign`, JWKS at
   `/.well-known/jwks.json`) and
   `raiseIntent('demo.SubmitOrder', …, { appId: 'aipa-execution' }, undefined, { signature, antiReplay })`.
   Sail ALLOW still matches a `jku` of `http://localhost:4110/.well-known/jwks.json`.
   The view resolves `ViewApproval` with Execution’s `fdc3.transactionResult`, then
   `fdc3.close()`s its window.
4. The inbox `getResult()`s that raise, marks the row approved, and resolves the
   held `GetApproval` with the same result. **Deny** / `CancelApproval` fail
   `ViewApproval` and `GetApproval` and do not raise SubmitOrder. Deny also closes
   the view window.
5. **Open** on a row (and `ReviewApproval`) use the same `ViewApproval` +
   `getResult()` path, then hide the inbox. Terminal rows can be **Clear**’d.

## Intents

| Intent | App | Behaviour |
| --- | --- | --- |
| `GetApproval` | inbox | Accept, assign `approvalId`, keep the raise open, open a view. |
| `ReviewApproval` | inbox | Open a view for the matching (or supplied) approval. |
| `UpdateApproval` | inbox | Return the current snapshot. |
| `CancelApproval` | inbox | If `pending`, mark `cancelled` and fail the held `GetApproval`. |
| `ViewApproval` | view | Show JSON; handler stays open until Approve or Deny. |
