# Fluxnova implementation

How the AIPA demo maps the [`fdc3.approval`](README.md) intents onto Fluxnova. The raising application depends on approval concepts rather than BPMN implementation details: Fluxnova process-instance IDs and task IDs stay behind the adapter.

## Adapter responsibilities

| Piece | Role |
| --- | --- |
| Fluxnova FDC3 app | Handles the five intents; displays My tasks, approval progress and review forms. |
| Approval service | Authenticates users, resolves the action and its nested context, applies policy, deduplicates requests and maps public approval IDs to Fluxnova instances/tasks. |
| Fluxnova process | Runs the human task, approval/rejection/cancellation branch and expiry handling. |
| Provider execution | After a recorded approval, performs the subject `fdc3.action` once, signed as the approving application, and forwards the target's IntentResult to the raising application. |

## Order demo

1. A trader or AI prepares an order. The order backend calculates its authoritative value.
2. An order at or below the configured threshold proceeds under the normal submission policy.
3. An order above the threshold enters `pendingApproval`; the backend creates or validates the approval request. FDC3 provides the app-facing request and navigation interface, while backend enforcement applies to every entry point.
4. The raising application can raise `UpdateApproval` to refresh the latest `fdc3.approval`, or open `ViewApproval` to inspect progress.
5. A second authenticated user opens the task from their inbox or through `ReviewApproval` and approves or rejects it.
6. Approval causes the approving application to raise `demo.SubmitOrder` (signed as itself) for the reviewed order version. The target's `fdc3.transactionResult` is forwarded to the raising application as the `GetApproval` IntentResult. Rejection or expiry prevents that raise and completes `GetApproval` with an error.
7. The demo shows the decision history alongside the resulting order state.

The AI can propose an action and request approval. Its own approval claim has no authority over execution.
