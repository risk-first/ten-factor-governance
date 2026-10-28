import type {
  ApprovalRecord,
  DemoTaskResult,
  FluxnovaHistoricTask,
  FluxnovaTask,
} from './types.ts';
import type { SignedEnvelope } from '../../../common/src/security/envelope.ts';

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    /* ignore */
  }
  return `${res.status} ${res.statusText}`;
}

export async function createTask(input: {
  name?: string;
  description?: string;
  assignee?: string;
}): Promise<DemoTaskResult> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { processInstanceId: string; taskId?: string };
  return { type: 'demo.taskResult', processInstanceId: body.processInstanceId, taskId: body.taskId };
}

export async function startApproval(input: {
  approval: ApprovalRecord;
  raiserAppId?: string;
}): Promise<{
  processInstanceId: string;
  taskId?: string;
  approval: ApprovalRecord;
  requester: string;
  approver: string;
}> {
  const res = await fetch('/api/approvals/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    processInstanceId: string;
    taskId?: string;
    approval: ApprovalRecord;
    requester: string;
    approver: string;
  };
}

export async function signContext(context: unknown): Promise<SignedEnvelope> {
  const res = await fetch('/api/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as SignedEnvelope;
}

export async function listOpenTasks(): Promise<FluxnovaTask[]> {
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { tasks?: FluxnovaTask[] };
  return Array.isArray(body.tasks) ? body.tasks : [];
}

export async function listCompletedTasks(opts?: {
  finishedAfter?: string;
  maxResults?: number;
  processDefinitionKey?: string;
}): Promise<FluxnovaHistoricTask[]> {
  const params = new URLSearchParams();
  if (opts?.finishedAfter) params.set('finishedAfter', opts.finishedAfter);
  if (opts?.maxResults != null) params.set('maxResults', String(opts.maxResults));
  if (opts?.processDefinitionKey) params.set('processDefinitionKey', opts.processDefinitionKey);
  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(`/api/history/tasks${query}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { tasks?: FluxnovaHistoricTask[] };
  return Array.isArray(body.tasks) ? body.tasks : [];
}

export async function fetchTaskDecision(processInstanceId: string): Promise<string | undefined> {
  const res = await fetch(`/api/history/tasks/${encodeURIComponent(processInstanceId)}/decision`);
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { decision?: string | null };
  return body.decision ?? undefined;
}
