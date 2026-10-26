# Fluxnova implementation

How the AIPA demo maps [`fdc3.approval`](README.md) onto Fluxnova in Sail. Fluxnova is a Camunda-shaped engine: BPMN processes, user tasks, and a Tasklist. Sail decides *whether* approval is required ([`sail-governance.md`](sail-governance.md)). Fluxnova’s job is **four-eyes where needed**: a second authenticated human, who is not the requester, must complete the user task.

Signed messages are what make that rule checkable. The original raise carries the requester’s (or assistant’s) signature. Fluxnova will not complete the user task as that same identity. After a distinct reviewer approves, the Fluxnova app raises the subject action signed as the approving application. Sail `ALLOW`s that second raise because the signer is no longer the original actor. The target sees only that signed raise.

```mermaid
sequenceDiagram
  participant Raise as Raising application
  participant Sail as Sail
  participant Flux as Fluxnova app
  participant Review as Reviewer
  participant Target as Target application

  Raise->>Sail: raiseIntent (subject), signed as requester
  Sail->>Flux: GetApproval (keep original signer)
  Review->>Flux: ReviewApproval (authenticate)
  alt Same person as original signer
    Flux-->>Review: refuse self-approval
  else Distinct reviewer rejects
    Flux-->>Sail: error
    Sail-->>Raise: getResult error
  else Distinct reviewer approves
    Flux->>Sail: raiseIntent (subject), signed as approver
    Sail->>Target: ALLOW (signer is not requester)
    Target-->>Flux: IntentResult
    Flux-->>Sail: forwarded result
    Sail-->>Raise: getResult
  end
```

The AI can propose the original action. Its signature has no authority over execution, and it cannot complete the Fluxnova user task.

## Sail apps

Two FDC3 apps sit on the Fluxnova engine. They are the Camunda Tasklist and the approval-intent bridge, not a new workflow product.

| App | Sail host | Role |
| --- | --- | --- |
| Fluxnova Inbox | Visible, singleton. Opens to **My tasks** when launched without context. | The Tasklist. The signed-in user sees their user tasks, opens one, authenticates, and completes it (approve or reject). |
| Fluxnova Approvals | Invisible, singleton, autostart. See [`sail.manifest`](../sail.manifest/README.md). | The bridge between `fdc3.approval` (and the related intents) and the Fluxnova process system. Always connected. Starts a process on `GetApproval`, writes `id.processInstanceId` onto the snapshot, and when the process reaches a terminal outcome performs the subject action or fails `GetApproval`. |

The inbox is how people action Fluxnova work in Sail. Opening an inbox on the requester’s desktop does not deliver the task to another user; notifications and the inbox on the reviewer’s desktop do.

## Starting a workflow

`GetApproval` is the start message. Sail (or any explicit caller) raises it at Fluxnova Approvals with `fdc3.approval`. That app starts the four-eyes process, stores the original signer, and creates the user task.

The process instance is an FDC3 identifier, not a hidden adapter secret. After accept, snapshots include it on `id`:

```json
{
  "type": "fdc3.approval",
  "id": {
    "requestId": "req-123",
    "approvalId": "approval-456",
    "processInstanceId": "a1b2c3-fluxnova-instance"
  }
}
```

`UpdateApproval`, `CancelApproval`, `ViewApproval` and `ReviewApproval` may resolve by `requestId`, `approvalId` or `processInstanceId`. BPMN definition keys, activity ids and variables stay off the wire.

| Intent | App | Meaning in Fluxnova |
| --- | --- | --- |
| `GetApproval` | Approvals | Start (or idempotently resume) the approval process. |
| `UpdateApproval` | Approvals | Latest process snapshot. Does not complete the task. |
| `CancelApproval` | Approvals | Cancel a `pending` process. |
| `ViewApproval` | Inbox | Open that case read-only. |
| `ReviewApproval` | Inbox | Open the user task for the signed-in reviewer. Does not complete the task by itself. |

## Completing a workflow

When the user task is completed, Fluxnova Approvals tells the rest of the desktop in two FDC3 ways. It does not dump BPMN internals onto a shared user channel.

1. **The held raise.** `GetApproval` stays open. On approve, Fluxnova Approvals raises the subject action signed as itself and forwards the target’s IntentResult to Sail, which completes the original `getResult()`. On reject, cancel or expiry it completes `GetApproval` with an error. That is how the raising application learns the outcome without knowing about Fluxnova.
2. **A snapshot to listeners.** Fluxnova Inbox or Fluxnova Approvals raises `ViewApproval` with the terminal `fdc3.approval` at apps that handle it — for example a blotter or governance trace — or sends that snapshot on a **private / app channel** those apps joined. `status` is the news (`approved`, `rejected`, `cancelled`, `expired`). Clients treat it as display information and resolve current state through `UpdateApproval`. Approval details are not broadcast on shared user channels.

```mermaid
sequenceDiagram
  participant Sail as Sail
  participant Approvals as Fluxnova Approvals
  participant Inbox as Fluxnova Inbox
  participant Review as Reviewer
  participant Listen as Listening app

  Sail->>Approvals: GetApproval
  Note over Approvals: start process, create user task
  Review->>Inbox: ReviewApproval / My tasks
  Inbox->>Approvals: complete user task (distinct signer)
  alt Approved
    Approvals->>Sail: raiseIntent (subject), signed as approver
    Approvals->>Listen: ViewApproval (fdc3.approval approved)
  else Rejected
    Approvals-->>Sail: GetApproval error
    Approvals->>Listen: ViewApproval (fdc3.approval rejected)
  end
```
