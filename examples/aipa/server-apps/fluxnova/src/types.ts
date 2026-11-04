export const PROCESS_KEY = 'aipa-create-task';
export const ORDER_APPROVAL_PROCESS_KEY = 'aipa-order-approval';
export const PROCESS_KEYS = [PROCESS_KEY, ORDER_APPROVAL_PROCESS_KEY] as const;

export const BRIDGE_APP_ID = 'aipa-fluxnova';
export const VIEW_APP_ID = 'aipa-fluxnova-view';
export const EXECUTION_APP_ID = 'aipa-execution';

export const INTENTS = {
  CreateTask: 'CreateTask',
  GetApproval: 'GetApproval',
  ViewTask: 'ViewTask',
  SubmitOrder: 'demo.SubmitOrder',
} as const;

export const CONTEXT_TYPES = {
  task: 'demo.task',
  taskResult: 'demo.taskResult',
  approval: 'fdc3.approval',
  action: 'fdc3.action',
} as const;

export type TaskStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export type DemoTask = {
  type: typeof CONTEXT_TYPES.task;
  id?: { taskId?: string; processInstanceId?: string };
  name?: string;
  description?: string;
  assignee?: string;
  processInstanceId?: string;
  status?: TaskStatus;
};

export type DemoTaskResult = {
  type: typeof CONTEXT_TYPES.taskResult;
  processInstanceId: string;
  taskId?: string;
};

export type ApprovalSubject = {
  type?: string;
  action?: string;
  intent?: string;
  title?: string;
  context?: unknown;
  channelId?: string;
  app?: { appId?: string; instanceId?: string };
};

export type ApprovalRecord = {
  type: typeof CONTEXT_TYPES.approval;
  id: {
    requestId?: string;
    approvalId?: string;
    processInstanceId?: string;
  };
  name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  subject?: ApprovalSubject;
  reason?: string;
  requester?: string;
  approver?: string;
  updatedAt?: string;
};

/** Inbox/view snapshot: Fluxnova task plus process variables (and optional fdc3.approval). */
export type TaskSnapshot = DemoTask & {
  id: { taskId: string; processInstanceId?: string };
  name: string;
  status: TaskStatus;
  created?: string;
  ended?: string;
  processDefinitionKey?: string;
  decision?: string;
  requester?: string;
  approver?: string;
  orderSummary?: string;
  ticker?: string;
  side?: string;
  quantity?: string;
  approval?: ApprovalRecord;
};

export type FluxnovaTask = {
  id: string;
  name: string;
  description?: string;
  assignee?: string;
  created?: string;
  processInstanceId?: string;
  processDefinitionKey?: string;
};

export type FluxnovaHistoricTask = FluxnovaTask & {
  endTime?: string;
  deleteReason?: string;
  duration?: number;
  decision?: string;
};

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseTaskStatus(value: unknown): TaskStatus | undefined {
  return value === 'pending' ||
    value === 'approved' ||
    value === 'rejected' ||
    value === 'completed' ||
    value === 'cancelled'
    ? value
    : undefined;
}

export function statusFromDecision(decision?: string, ended?: boolean): TaskStatus {
  if (decision === 'approved') return 'approved';
  if (decision === 'rejected') return 'rejected';
  if (ended) return 'completed';
  return 'pending';
}

export function textField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function taskFromContext(ctx: unknown): DemoTask {
  const record = asRecord(ctx);
  const id = asRecord(record?.id);
  return {
    type: CONTEXT_TYPES.task,
    id: {
      taskId: textField(id, 'taskId'),
      processInstanceId: textField(id, 'processInstanceId') ?? textField(record, 'processInstanceId'),
    },
    name: textField(record, 'name'),
    description: textField(record, 'description'),
    assignee: textField(record, 'assignee'),
    processInstanceId: textField(id, 'processInstanceId') ?? textField(record, 'processInstanceId'),
  };
}

export function acceptApproval(incoming: ApprovalRecord): ApprovalRecord {
  const requestId = incoming.id?.requestId ?? crypto.randomUUID();
  const approvalId = incoming.id?.approvalId ?? crypto.randomUUID();
  return {
    ...incoming,
    type: CONTEXT_TYPES.approval,
    id: {
      requestId,
      approvalId,
      processInstanceId: incoming.id?.processInstanceId,
    },
    status: incoming.status ?? 'pending',
    updatedAt: incoming.updatedAt ?? new Date().toISOString(),
  };
}

export function approvalFromContext(ctx: unknown): ApprovalRecord {
  const record = asRecord(ctx);
  const id = asRecord(record?.id);
  const subject = asRecord(record?.subject);
  const app = asRecord(subject?.app);
  const status = textField(record, 'status');
  return acceptApproval({
    type: CONTEXT_TYPES.approval,
    id: {
      requestId: textField(id, 'requestId'),
      approvalId: textField(id, 'approvalId'),
      processInstanceId: textField(id, 'processInstanceId'),
    },
    name: textField(record, 'name'),
    status:
      status === 'approved' || status === 'rejected' || status === 'cancelled' || status === 'pending'
        ? status
        : 'pending',
    subject: subject
      ? {
          type: textField(subject, 'type') ?? CONTEXT_TYPES.action,
          action: textField(subject, 'action'),
          intent: textField(subject, 'intent'),
          title: textField(subject, 'title'),
          context: subject.context,
          channelId: textField(subject, 'channelId'),
          app: app
            ? {
                appId: textField(app, 'appId'),
                instanceId: textField(app, 'instanceId'),
              }
            : undefined,
        }
      : undefined,
    reason: textField(record, 'reason'),
    requester: textField(record, 'requester'),
    approver: textField(record, 'approver'),
    updatedAt: textField(record, 'updatedAt'),
  });
}

export function snapshotFromContext(ctx: unknown): TaskSnapshot | undefined {
  const record = asRecord(ctx);
  const task = taskFromContext(ctx);
  const taskId = task.id?.taskId ?? textField(record, 'taskId');
  if (!taskId) return undefined;
  const approvalRecord = asRecord(record?.approval);
  return {
    ...task,
    type: CONTEXT_TYPES.task,
    id: {
      taskId,
      processInstanceId: task.id?.processInstanceId ?? task.processInstanceId,
    },
    name: task.name?.trim() || textField(record, 'name') || 'Untitled task',
    status: parseTaskStatus(record?.status) ?? 'pending',
    created: textField(record, 'created'),
    ended: textField(record, 'ended'),
    processDefinitionKey: textField(record, 'processDefinitionKey'),
    decision: textField(record, 'decision'),
    requester: textField(record, 'requester'),
    approver: textField(record, 'approver') ?? task.assignee,
    orderSummary: textField(record, 'orderSummary'),
    ticker: textField(record, 'ticker'),
    side: textField(record, 'side'),
    quantity: textField(record, 'quantity'),
    approval: approvalRecord ? approvalFromContext(approvalRecord) : undefined,
  };
}
