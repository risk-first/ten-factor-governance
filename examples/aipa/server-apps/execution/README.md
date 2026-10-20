# Execution

Responds to `demo.SubmitOrder` with a signed `fdc3.transactionResult`.
Accepts a single `demo.order` or a `demo.orderList`. The UI is a log of each
raise: click **Order** or **Result** to inspect that context. The log is persisted
in `temp/submit-order.json` (gitignored) so a reload shows historic rows. Sail
hosts it as a visible singleton.

Inbound raise signatures are checked when present. No governance denial in this
phase — any raiser that reaches this app succeeds.

Fills are applied to the Portfolio app's live book
(`server-apps/portfolio/temp/portfolio.json`).
