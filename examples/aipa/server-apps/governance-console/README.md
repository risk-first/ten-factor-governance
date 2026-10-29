# Governance Console

FDC3 app that owns Gemara layer 5/6 evidence for AIPA. Implements
[`fdc3.gemara`](../../fdc3-extensions/fdc3.gemara/README.md): listens for
`LogEvaluation` and `LogEnforcement`, appends receipts, and renders them with
`@gemara/react`.

History is persisted in gitignored `temp/evaluation-log.json` and
`temp/enforcement-log.json` (same pattern as Execution’s `temp/submit-order.json`).
Empty files are created on startup if missing. A reload shows historic rows.

The browser registers `LogEvaluation` / `LogEnforcement` via
`remoteIntentHandler` so appends run on the trusted backend
(`@finos/fdc3-security` secure-boundary WebSocket). The UI loads the store
with `exchangeData('load-logs')` and receives `logs-updated` pushes after
each append. There are no HTTP log APIs.

Started by `npm run dev` at the AIPA package root (port **4111**).

Control / requirement links in receipts open the published catalog from
`GEMARA_CONTROLS_CATALOG_URL` (AIPA `.env`), with `#apa-ctl-005-propose-human-approval`
and `#apa-ctl-005-propose-human-approval.ar01` fragments. Override
`GEMARA_POLICY_URL` for policy plan/method links. **Restart AIPA** after changing
these — Express `/api/config` is loaded once.
