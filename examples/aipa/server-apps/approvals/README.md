# Approvals

Entra-backed human approval for [`fdc3.approval`](../../fdc3-extensions/fdc3.approval/README.md).
Listens for `GetApproval` (and `UpdateApproval` / `CancelApproval` / `ViewApproval` /
`ReviewApproval`). On approve, re-raises the subject `demo.SubmitOrder` to Execution
with FDC3 3.0 `ContextMetadata` (`signature` / `antiReplay`) as `aipa-approvals`.

This is the stub of Fluxnova Approvals: in-memory store only, no process ids.

## Hosting

Port **4110**. Sail `hostManifests`: `injectApi: "3.0"`, invisible, singleton,
autostart, not searchable. Intent delivery does not project the iframe — open
the Approvals icon in the Sail top bar, sign in, then decide.

Override Entra via `server-apps/approvals/.env` if present; otherwise
`properties.json` (`entra.clientId` / `authority` / `tenantId` / `redirectUri`).

## Flow

1. Sail governance (`sail-extensions/sail-governance`) intercepts an unsigned
   `demo.SubmitOrder` and posts `GetApproval` with an `fdc3.approval` whose
   `subject` is `{ type: fdc3.action, action: raiseIntent, intent: demo.SubmitOrder, … }`.
2. `GetApproval` stays open. The UI shows the pending subject.
3. **Approve** requires a valid Entra session (`loginPopup` → `POST /api/session`).
   The backend signs the subject context (`POST /api/sign`, JWKS at
   `/.well-known/jwks.json`). The client then
   `raiseIntent('demo.SubmitOrder', context, { appId: 'aipa-execution' }, undefined, { signature, antiReplay })`.
   The held `GetApproval` forwards Execution’s `fdc3.transactionResult` (and
   result metadata).
4. **Reject** / `CancelApproval` fail the held `GetApproval` and do not raise
   SubmitOrder.

A `demo.SubmitOrder` already signed by this app (or raised from `aipa-approvals`)
is ALLOW’d through the intercept.

## Intents

| Intent | Behaviour |
| --- | --- |
| `GetApproval` | Accept, assign `approvalId`, keep the raise open. |
| `ReviewApproval` / `ViewApproval` | Open the same pending record (no decision from the raise). |
| `UpdateApproval` | Return the current snapshot. |
| `CancelApproval` | If `pending`, mark `cancelled` and fail the held `GetApproval`. |
