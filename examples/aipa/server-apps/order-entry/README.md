# AIPA Order Entry

Responds to `demo.CreateOrder` with a signed `demo.order` or `demo.orderList`.
After human review, raises `demo.SubmitOrder` to Execution. If Sail escalates
that raise, `raiseIntent` fails with `ApprovalRequired` and the blotter shows
that the user must complete the request in Approvals or Fluxnova.
