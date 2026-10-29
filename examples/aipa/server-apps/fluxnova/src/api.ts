import type { ApprovalRecord, DemoTaskResult, TaskSnapshot } from './types.ts';
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

export async function pingEngine(): Promise<boolean> {
  try {
    const res = await fetch('/api/engine');
    return res.ok;
  } catch {
    return false;
  }
}

export async function createTask(input: {
  name?: string;
  description?: string;
  assignee?: string;
}): Promise<DemoTaskResult & { task?: TaskSnapshot }> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as {
    processInstanceId: string;
    taskId?: string;
    task?: TaskSnapshot | null;
  };
  return {
    type: 'demo.taskResult',
    processInstanceId: body.processInstanceId,
    taskId: body.taskId,
    task: body.task ?? undefined,
  };
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
  task?: TaskSnapshot;
}> {
  const res = await fetch('/api/approvals/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as {
    processInstanceId: string;
    taskId?: string;
    approval: ApprovalRecord;
    requester: string;
    approver: string;
    task?: TaskSnapshot | null;
  };
  return { ...body, task: body.task ?? undefined };
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

export async function listOpenTasks(): Promise<TaskSnapshot[]> {
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { tasks?: TaskSnapshot[] };
  return Array.isArray(body.tasks) ? body.tasks : [];
}

export async function listCompletedTasks(opts?: {
  finishedAfter?: string;
  maxResults?: number;
}): Promise<TaskSnapshot[]> {
  const params = new URLSearchParams({ historic: 'true' });
  if (opts?.finishedAfter) params.set('finishedAfter', opts.finishedAfter);
  if (opts?.maxResults != null) params.set('maxResults', String(opts.maxResults));
  const res = await fetch(`/api/tasks?${params}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { tasks?: TaskSnapshot[] };
  return Array.isArray(body.tasks) ? body.tasks : [];
}

export async function fetchTaskSnapshot(taskId: string): Promise<TaskSnapshot | undefined> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as TaskSnapshot;
}

export async function completeTask(
  taskId: string,
  decision: 'approved' | 'rejected'
): Promise<TaskSnapshot | undefined> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { task?: TaskSnapshot | null };
  return body.task ?? undefined;
}

export async function fetchTaskDecision(processInstanceId: string): Promise<string | undefined> {
  const res = await fetch(`/api/history/tasks/${encodeURIComponent(processInstanceId)}/decision`);
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { decision?: string | null };
  return body.decision ?? undefined;
}
