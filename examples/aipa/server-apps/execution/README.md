# Execution

Responds to `demo.SubmitOrders` with a signed `fdc3.transactionResult`.
Inbound raise signatures are checked when present. No governance denial in this
phase — any raiser that reaches this app succeeds.

Fills are applied to the Portfolio app's live book
(`server-apps/portfolio/temp/portfolio.json`).
