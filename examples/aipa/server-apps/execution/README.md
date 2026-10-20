# Execution

Responds to `demo.SubmitOrder` with a signed `fdc3.transactionResult`.
Accepts a single `demo.order` or a `demo.orderList`. Inbound raise signatures
are checked when present. No governance denial in this phase — any raiser that
reaches this app succeeds.

Fills are applied to the Portfolio app's live book
(`server-apps/portfolio/temp/portfolio.json`).
