import fs from 'node:fs';
import path from 'node:path';
import {
  CONTEXT_TYPES,
  ORDER_APPROVAL_PROCESS_KEY,
  PROCESS_KEY,
  PROCESS_KEYS,
  approvalFromContext,
  statusFromDecision,
  type FluxnovaHistoricTask,
  type FluxnovaTask,
  type TaskSnapshot,
} from './types.js';

export const ENGINE_UNREACHABLE =
  'Fluxnova engine not reachable. Start it with `docker compose up -d` in server-apps/fluxnova.';

export class EngineUnreachableError extends Error {
  constructor(cause?: unknown) {
    super(ENGINE_UNREACHABLE);
    this.name = 'EngineUnreachableError';
    this.cause = cause;
  }
}

type EngineTask = {
  id?: string;
  name?: string;
  description?: string;
  assignee?: string;
  created?: string;
  processInstanceId?: string;
  processDefinitionKey?: string;
};

type EngineHistoricTask = EngineTask & {
  endTime?: string;
  deleteReason?: string;
  duration?: number;
  startTime?: string;
};

type EngineVariable = {
  name?: string;
  value?: unknown;
  type?: string;
};

function engineBase(): string {
  return (process.env.FLUXNOVA_REST ?? 'http://localhost:8080/engine-rest').replace(/\/$/, '');
}

async function engineFetch(pathname: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${engineBase()}${pathname}`, init);
  } catch (error) {
    throw new EngineUnreachableError(error);
  }
}

async function readJson<T>(res: Response): Promise<T> {
  if (res.status === 404) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function asTask(raw: EngineTask): FluxnovaTask | undefined {
  if (!raw.id) return undefined;
  return {
    id: raw.id,
    name: raw.name?.trim() || 'Untitled task',
    description: raw.description || undefined,
    assignee: raw.assignee || undefined,
    created: raw.created,
    processInstanceId: raw.processInstanceId,
    processDefinitionKey: raw.processDefinitionKey,
  };
}

export async function pingEngine(): Promise<boolean> {
  try {
    const res = await engineFetch('/engine');
    return res.ok;
  } catch {
    return false;
  }
}

async function deployProcess(appRoot: string, processKey: string): Promise<void> {
  const existing = await engineFetch(`/process-definition/key/${processKey}`);
  if (existing.ok) return;
  if (existing.status !== 404) {
    if (existing.status >= 500 || existing.status === 0) throw new EngineUnreachableError();
  }

  const bpmnPath = path.join(appRoot, 'processes', `${processKey}.bpmn`);
  const bpmn = fs.readFileSync(bpmnPath);
  const form = new FormData();
  form.append('deployment-name', processKey);
  form.append('enable-duplicate-filtering', 'true');
  form.append('deploy-changed-only', 'true');
  form.append('data', new Blob([bpmn], { type: 'text/xml' }), `${processKey}.bpmn`);

  const res = await engineFetch('/deployment/create', { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Fluxnova deploy failed for ${processKey} (${res.status}): ${detail || res.statusText}`);
  }
}

export async function ensureProcessDeployed(appRoot: string, processKey?: string): Promise<void> {
  const keys = processKey ? [processKey] : [...PROCESS_KEYS];
  for (const key of keys) {
    await deployProcess(appRoot, key);
  }
}

function stringVar(value: string): { value: string; type: 'String' } {
  return { value, type: 'String' };
}

export async function startCreateTask(input: {
  name?: string;
  description?: string;
  assignee?: string;
}): Promise<{ processInstanceId: string; taskId?: string }> {
  const name = input.name?.trim() || `Workbench task ${new Date().toISOString()}`;
  const variables: Record<string, { value: string; type: 'String' }> = {
    name: stringVar(name),
  };
  if (input.description?.trim()) {
    variables.description = stringVar(input.description.trim());
  }
  if (input.assignee?.trim()) {
    variables.assignee = stringVar(input.assignee.trim());
  }

  const processInstanceId = await startProcess(PROCESS_KEY, variables);
  const created = await firstTask(processInstanceId);
  if (created) {
    try {
      await updateTask(created.id, {
        name,
        description: input.description?.trim(),
        assignee: input.assignee?.trim(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Fluxnova task metadata update skipped: ${message}`);
    }
  }
  return { processInstanceId, taskId: created?.id };
}

export async function startOrderApproval(input: {
  name: string;
  description?: string;
  requester: string;
  approver: string;
  orderSummary: string;
  ticker?: string;
  side?: string;
  quantity?: string;
  approvalJson: string;
}): Promise<{ processInstanceId: string; taskId?: string }> {
  const variables: Record<string, { value: string; type: 'String' }> = {
    name: stringVar(input.name),
    requester: stringVar(input.requester),
    approver: stringVar(input.approver),
    orderSummary: stringVar(input.orderSummary),
    approvalJson: stringVar(input.approvalJson),
    ticker: stringVar(input.ticker ?? ''),
    side: stringVar(input.side ?? ''),
    quantity: stringVar(input.quantity ?? ''),
  };
  if (input.description?.trim()) {
    variables.description = stringVar(input.description.trim());
  }

  const processInstanceId = await startProcess(ORDER_APPROVAL_PROCESS_KEY, variables);
  const created = await firstTask(processInstanceId);
  if (created) {
    try {
      await updateTask(created.id, {
        name: input.name,
        description: input.description?.trim() || input.orderSummary,
        assignee: input.approver,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Fluxnova approval task metadata update skipped: ${message}`);
    }
  }
  return { processInstanceId, taskId: created?.id };
}

async function startProcess(
  processKey: string,
  variables: Record<string, { value: string; type: 'String' }>
): Promise<string> {
  const started = await engineFetch(`/process-definition/key/${processKey}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variables }),
  });
  if (!started.ok) {
    const detail = await started.text();
    throw new Error(`Fluxnova start failed (${started.status}): ${detail || started.statusText}`);
  }
  const body = await readJson<{ id?: string }>(started);
  const processInstanceId = body?.id;
  if (!processInstanceId) throw new Error('Fluxnova start returned no process instance id');
  return processInstanceId;
}

async function firstTask(processInstanceId: string): Promise<FluxnovaTask | undefined> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const listed = await listTasks({ processInstanceId });
    if (listed[0]) return listed[0];
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return undefined;
}

async function updateTask(
  id: string,
  patch: { name: string; description?: string; assignee?: string }
): Promise<void> {
  const body: Record<string, string | number> = {
    name: patch.name,
    description: patch.description ?? '',
    priority: 50,
  };
  if (patch.assignee) body.assignee = patch.assignee;
  const res = await engineFetch(`/task/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    const detail = await res.text();
    throw new Error(`Fluxnova update task failed (${res.status}): ${detail || res.statusText}`);
  }
}

export async function listTasks(opts?: {
  processInstanceId?: string;
  processDefinitionKey?: string;
}): Promise<FluxnovaTask[]> {
  const params = new URLSearchParams();
  if (opts?.processInstanceId) params.set('processInstanceId', opts.processInstanceId);
  if (opts?.processDefinitionKey) params.set('processDefinitionKey', opts.processDefinitionKey);
  const query = params.toString() ? `?${params}` : '';
  const res = await engineFetch(`/task${query}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Fluxnova list tasks failed (${res.status}): ${detail || res.statusText}`);
  }
  const body = (await readJson<EngineTask[]>(res)) ?? [];
  return body.map(asTask).filter((task): task is FluxnovaTask => Boolean(task));
}

export async function getTask(id: string): Promise<FluxnovaTask | undefined> {
  const res = await engineFetch(`/task/${encodeURIComponent(id)}`);
  if (res.status === 404) return undefined;
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Fluxnova get task failed (${res.status}): ${detail || res.statusText}`);
  }
  return asTask((await readJson<EngineTask>(res)) ?? {});
}

export async function completeTask(
  id: string,
  decision?: 'approved' | 'rejected'
): Promise<void> {
  const body =
    decision === 'approved' || decision === 'rejected'
      ? {
          variables: {
            decision: { value: decision, type: 'String' },
          },
        }
      : {};
  const res = await engineFetch(`/task/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    const detail = await res.text();
    throw new Error(`Fluxnova complete failed (${res.status}): ${detail || res.statusText}`);
  }
}

function asHistoricTask(raw: EngineHistoricTask): FluxnovaHistoricTask | undefined {
  const task = asTask(raw);
  if (!task) return undefined;
  return {
    ...task,
    created: raw.startTime ?? raw.created,
    endTime: raw.endTime,
    deleteReason: raw.deleteReason,
    duration: typeof raw.duration === 'number' ? raw.duration : undefined,
  };
}

export async function listCompletedTasks(opts?: {
  processDefinitionKey?: string;
  finishedAfter?: string;
  maxResults?: number;
}): Promise<FluxnovaHistoricTask[]> {
  const params = new URLSearchParams({
    finished: 'true',
    sortBy: 'endTime',
    sortOrder: 'desc',
    maxResults: String(opts?.maxResults ?? 50),
  });
  if (opts?.processDefinitionKey) params.set('processDefinitionKey', opts.processDefinitionKey);
  if (opts?.finishedAfter) params.set('finishedAfter', opts.finishedAfter);
  const res = await engineFetch(`/history/task?${params}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Fluxnova history tasks failed (${res.status}): ${detail || res.statusText}`);
  }
  const body = (await readJson<EngineHistoricTask[]>(res)) ?? [];
  return body.map(asHistoricTask).filter((task): task is FluxnovaHistoricTask => Boolean(task));
}

export async function getProcessVariable(
  processInstanceId: string,
  name: string
): Promise<string | undefined> {
  const params = new URLSearchParams({
    processInstanceId,
    variableName: name,
    deserializeValues: 'false',
  });
  const res = await engineFetch(`/history/variable-instance?${params}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Fluxnova history variable failed (${res.status}): ${detail || res.statusText}`);
  }
  const body = (await readJson<EngineVariable[]>(res)) ?? [];
  const match = body.find(entry => entry.name === name);
  if (match?.value == null) return undefined;
  return String(match.value);
}

export async function getTaskDecision(processInstanceId: string): Promise<string | undefined> {
  return getProcessVariable(processInstanceId, 'decision');
}

type EngineVariableMap = Record<string, { value?: unknown; type?: string }>;

function stringifyVar(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function mapFromVariableObject(body: EngineVariableMap | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!body) return out;
  for (const [name, entry] of Object.entries(body)) {
    const value = stringifyVar(entry?.value);
    if (value != null && value !== '') out[name] = value;
  }
  return out;
}

function mapFromVariableList(body: EngineVariable[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!body) return out;
  for (const entry of body) {
    if (!entry.name) continue;
    const value = stringifyVar(entry.value);
    if (value != null && value !== '') out[entry.name] = value;
  }
  return out;
}

export async function getTaskVariables(taskId: string): Promise<Record<string, string>> {
  const res = await engineFetch(`/task/${encodeURIComponent(taskId)}/variables?deserializeValues=false`);
  if (res.status === 404) return {};
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Fluxnova task variables failed (${res.status}): ${detail || res.statusText}`);
  }
  return mapFromVariableObject(await readJson<EngineVariableMap>(res));
}

export async function getHistoricVariables(processInstanceId: string): Promise<Record<string, string>> {
  const params = new URLSearchParams({
    processInstanceId,
    deserializeValues: 'false',
  });
  const res = await engineFetch(`/history/variable-instance?${params}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Fluxnova history variables failed (${res.status}): ${detail || res.statusText}`);
  }
  return mapFromVariableList(await readJson<EngineVariable[]>(res));
}

async function variablesFor(task: FluxnovaTask, historic: boolean): Promise<Record<string, string>> {
  if (!historic) {
    try {
      const live = await getTaskVariables(task.id);
      if (Object.keys(live).length) return live;
    } catch {
      /* fall through to history */
    }
  }
  if (!task.processInstanceId) return {};
  try {
    return await getHistoricVariables(task.processInstanceId);
  } catch {
    return {};
  }
}

function parseApprovalJson(raw?: string): TaskSnapshot['approval'] {
  if (!raw) return undefined;
  try {
    return approvalFromContext(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function snapshotFromTask(
  task: FluxnovaTask | FluxnovaHistoricTask,
  vars: Record<string, string>,
  historic: boolean
): TaskSnapshot {
  const historicTask = task as FluxnovaHistoricTask;
  const ended = historic ? historicTask.endTime : undefined;
  const decision = vars.decision ?? historicTask.decision;
  const approval = parseApprovalJson(vars.approvalJson);
  return {
    type: CONTEXT_TYPES.task,
    id: {
      taskId: task.id,
      processInstanceId: task.processInstanceId,
    },
    name: vars.name?.trim() || task.name,
    description: vars.description || task.description,
    assignee: vars.approver || task.assignee,
    processInstanceId: task.processInstanceId,
    status: statusFromDecision(decision, historic || Boolean(ended)),
    created: task.created,
    ended,
    processDefinitionKey: task.processDefinitionKey,
    decision,
    requester: vars.requester,
    approver: vars.approver || task.assignee,
    orderSummary: vars.orderSummary,
    ticker: vars.ticker,
    side: vars.side,
    quantity: vars.quantity,
    approval,
  };
}

export async function toSnapshot(
  task: FluxnovaTask | FluxnovaHistoricTask,
  historic: boolean
): Promise<TaskSnapshot> {
  const vars = await variablesFor(task, historic);
  return snapshotFromTask(task, vars, historic);
}

export async function listOpenSnapshots(): Promise<TaskSnapshot[]> {
  const tasks = await listTasks();
  return Promise.all(tasks.map(task => toSnapshot(task, false)));
}

export async function getHistoricTask(id: string): Promise<FluxnovaHistoricTask | undefined> {
  const params = new URLSearchParams({ taskId: id, maxResults: '1' });
  const res = await engineFetch(`/history/task?${params}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Fluxnova history task failed (${res.status}): ${detail || res.statusText}`);
  }
  const body = (await readJson<EngineHistoricTask[]>(res)) ?? [];
  return body.map(asHistoricTask).find((task): task is FluxnovaHistoricTask => Boolean(task));
}

export async function getTaskSnapshot(id: string): Promise<TaskSnapshot | undefined> {
  const live = await getTask(id);
  if (live) return toSnapshot(live, false);
  const historic = await getHistoricTask(id);
  if (!historic) return undefined;
  return toSnapshot(historic, true);
}

export async function listCompletedSnapshots(opts?: {
  processDefinitionKey?: string;
  finishedAfter?: string;
  maxResults?: number;
}): Promise<TaskSnapshot[]> {
  const tasks = await listCompletedTasks(opts);
  return Promise.all(tasks.map(task => toSnapshot(task, true)));
}
