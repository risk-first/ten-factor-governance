import '../../../common/src/ui/styles.css';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import { toSignedResult } from '../../../common/src/security/envelope.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { Context, ContextMetadata, ContextWithMetadata, DesktopAgent } from '@finos/fdc3';
import {
  createTask,
  fetchTaskDecision,
  listCompletedTasks,
  listOpenTasks,
  signContext,
  startApproval,
} from './api.ts';
import {
  CONTEXT_TYPES,
  EXECUTION_APP_ID,
  INTENTS,
  approvalFromContext,
  taskFromContext,
  type ApprovalRecord,
  type DemoTask,
  type DemoTaskResult,
  type FluxnovaHistoricTask,
  type FluxnovaTask,
} from './types.ts';

const TASKLIST_URL = 'http://localhost:8080/fluxnova/app/tasklist/';
const POLL_MS = 2000;

type LogEntry = {
  id: string;
  at: string;
  event: string;
  task: DemoTask;
  outcome: 'pending' | 'ok' | 'fail';
  result?: DemoTaskResult;
  error?: string;
  durationMs?: number;
  decision?: string;
};

type HeldApproval = {
  approval: ApprovalRecord;
  taskId?: string;
  processInstanceId: string;
  resolve: (result: Context | ContextWithMetadata) => void;
  reject: (error: Error) => void;
  settled: boolean;
};

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;
const log: LogEntry[] = [];
const seenCompletions = new Set<string>();
/** Open engine tasks we are watching for disappearance (= completion). */
const openTasks = new Map<string, DemoTask>();
const heldByTaskId = new Map<string, HeldApproval>();
const heldByProcessId = new Map<string, HeldApproval>();
let selectedId: string | undefined;
let finishedAfter = new Date().toISOString();
let historyAvailable: boolean | undefined;
let fdc3: DesktopAgent | null = null;

function openTasklist(): void {
  window.open(TASKLIST_URL, '_blank', 'noopener,noreferrer');
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDuration(ms?: number): string | undefined {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return undefined;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes}m ${rem}s`;
}

function summarizeTask(task: DemoTask): string {
  const name = task.name?.trim() || 'Untitled task';
  const assignee = task.assignee?.trim();
  return assignee ? `${name} → ${assignee}` : name;
}

function summarizeResult(entry: LogEntry): string {
  if (entry.outcome === 'pending') return 'Starting…';
  if (entry.outcome === 'fail') return entry.error ?? 'Failed';
  if (entry.event === 'CompleteTask') {
    const parts = [entry.decision === 'rejected' ? 'Rejected' : 'Completed'];
    const duration = formatDuration(entry.durationMs);
    if (duration) parts.push(duration);
    if (entry.result?.taskId) parts.push(`task ${entry.result.taskId}`);
    return parts.join(' · ');
  }
  if (entry.event === INTENTS.GetApproval) {
    const result = entry.result;
    if (!result) return 'Pending Tasklist';
    const parts = [`process ${result.processInstanceId}`];
    if (result.taskId) parts.push(`task ${result.taskId}`);
    return parts.join(' · ');
  }
  const result = entry.result;
  if (!result) return 'Created';
  const parts = [`process ${result.processInstanceId}`];
  if (result.taskId) parts.push(`task ${result.taskId}`);
  return parts.join(' · ');
}

function showDetail(entry: LogEntry): void {
  selectedId = entry.id;
  const detail = document.getElementById('detail')!;
  detail.hidden = false;
  detail.textContent = JSON.stringify(
    {
      at: entry.at,
      event: entry.event,
      outcome: entry.outcome,
      task: entry.task,
      result: entry.result,
      error: entry.error,
      durationMs: entry.durationMs,
      decision: entry.decision,
    },
    null,
    2
  );
  renderLog();
}

function renderLog(): void {
  const tbody = document.getElementById('log')!;
  tbody.replaceChildren();

  for (const entry of log) {
    const tr = document.createElement('tr');
    if (selectedId === entry.id) tr.classList.add('selected');
    tr.addEventListener('click', () => showDetail(entry));

    const whenTd = document.createElement('td');
    whenTd.textContent = formatWhen(entry.at);

    const eventTd = document.createElement('td');
    eventTd.textContent = entry.event;

    const taskTd = document.createElement('td');
    taskTd.textContent = summarizeTask(entry.task);

    const resultTd = document.createElement('td');
    resultTd.className =
      entry.outcome === 'ok'
        ? 'outcome outcome--ok'
        : entry.outcome === 'fail'
          ? 'outcome outcome--fail'
          : 'outcome';
    resultTd.textContent = summarizeResult(entry);

    tr.append(whenTd, eventTd, taskTd, resultTd);
    tbody.appendChild(tr);
  }
}

function prependLog(entry: LogEntry, opts?: { select?: boolean }): void {
  log.unshift(entry);
  if (opts?.select !== false) showDetail(entry);
  else renderLog();
}

function demoTaskFromEngine(task: FluxnovaTask): DemoTask {
  return {
    type: CONTEXT_TYPES.task,
    id: { taskId: task.id, processInstanceId: task.processInstanceId },
    name: task.name,
    description: task.description,
    assignee: task.assignee,
    processInstanceId: task.processInstanceId,
  };
}

function demoTaskFromHistoric(historic: FluxnovaHistoricTask): DemoTask {
  return {
    type: CONTEXT_TYPES.task,
    id: { taskId: historic.id, processInstanceId: historic.processInstanceId },
    name: historic.name,
    description: historic.description,
    assignee: historic.assignee,
    processInstanceId: historic.processInstanceId,
  };
}

function watchOpenTask(taskId: string, task: DemoTask): void {
  if (seenCompletions.has(taskId) || openTasks.has(taskId)) return;
  openTasks.set(taskId, task);
}

function findHeld(taskId?: string, processInstanceId?: string): HeldApproval | undefined {
  if (taskId && heldByTaskId.has(taskId)) return heldByTaskId.get(taskId);
  if (processInstanceId && heldByProcessId.has(processInstanceId)) {
    return heldByProcessId.get(processInstanceId);
  }
  return undefined;
}

async function settleApproved(held: HeldApproval): Promise<void> {
  if (held.settled || !fdc3) return;
  const subject = held.approval.subject;
  const context = subject?.context;
  if (!context || typeof context !== 'object') {
    held.settled = true;
    held.approval.status = 'rejected';
    held.reject(new Error('Approval has no subject context'));
    return;
  }

  try {
    const envelope = await signContext(context);
    const signed = toSignedResult(envelope);
    const intent = subject.intent ?? INTENTS.SubmitOrder;
    const target = {
      appId: subject.app?.appId ?? (intent === INTENTS.SubmitOrder ? EXECUTION_APP_ID : EXECUTION_APP_ID),
      instanceId: subject.app?.instanceId,
    };
    setStatus(statusEl(), `Submitting ${intent} → ${target.appId}…`);
    const resolution = await fdc3.raiseIntent(
      intent,
      signed.context as Context,
      target.instanceId ? target : { appId: target.appId },
      undefined,
      { signature: signed.metadata.signature, antiReplay: signed.metadata.antiReplay }
    );
    const result = await resolution.getResult();
    let resultMetadata: ContextMetadata | undefined;
    try {
      resultMetadata = await resolution.getResultMetadata();
    } catch {
      resultMetadata = undefined;
    }
    held.settled = true;
    held.approval.status = 'approved';
    held.approval.updatedAt = new Date().toISOString();
    setStatus(statusEl(), 'Approved and submitted');
    const payload: Context | ContextWithMetadata =
      result && typeof result === 'object' && 'type' in result && resultMetadata
        ? { context: result as Context, metadata: resultMetadata }
        : result && typeof result === 'object' && 'type' in result
          ? (result as Context)
          : { type: 'fdc3.nothing' };
    held.resolve(payload);
  } catch (error) {
    held.settled = true;
    const message = error instanceof Error ? error.message : String(error);
    setStatus(statusEl(), `Approve failed: ${message}`);
    held.reject(error instanceof Error ? error : new Error(message));
  }
}

function settleRejected(held: HeldApproval, reason: string): void {
  if (held.settled) return;
  held.settled = true;
  held.approval.status = 'rejected';
  held.approval.updatedAt = new Date().toISOString();
  held.reject(new Error(reason));
  setStatus(statusEl(), reason);
}

async function onTaskCompleted(input: {
  taskId: string;
  task: DemoTask;
  processInstanceId?: string;
  endTime?: string;
  durationMs?: number;
}): Promise<void> {
  if (seenCompletions.has(input.taskId)) return;
  seenCompletions.add(input.taskId);
  openTasks.delete(input.taskId);

  const processInstanceId = input.processInstanceId ?? input.task.processInstanceId ?? input.task.id?.processInstanceId;
  const held = findHeld(input.taskId, processInstanceId);
  let decision: string | undefined;
  if (processInstanceId) {
    try {
      decision = await fetchTaskDecision(processInstanceId);
    } catch {
      decision = undefined;
    }
  }

  const at = input.endTime ?? new Date().toISOString();
  if (input.endTime && input.endTime > finishedAfter) finishedAfter = input.endTime;

  const outcome: LogEntry['outcome'] =
    held && decision !== 'approved' ? 'fail' : 'ok';

  prependLog(
    {
      id: `complete:${input.taskId}`,
      at,
      event: 'CompleteTask',
      task: input.task,
      outcome,
      decision: decision ?? (held ? 'unknown' : undefined),
      result: processInstanceId
        ? {
            type: CONTEXT_TYPES.taskResult,
            processInstanceId,
            taskId: input.taskId,
          }
        : undefined,
      durationMs: input.durationMs,
      error:
        held && decision !== 'approved'
          ? decision === 'rejected'
            ? 'Rejected in Tasklist'
            : 'Completed without decision'
          : undefined,
    },
    { select: false }
  );

  if (held) {
    if (decision === 'approved') {
      await settleApproved(held);
    } else if (decision === 'rejected') {
      settleRejected(held, 'Approval rejected');
    } else {
      settleRejected(held, 'Approval completed without decision');
    }
    if (held.taskId) heldByTaskId.delete(held.taskId);
    heldByProcessId.delete(held.processInstanceId);
  } else {
    setStatus(
      statusEl(),
      `CompleteTask · ${summarizeTask(input.task)}${decision ? ` · ${decision}` : ''}`
    );
  }
}

async function pollOpenTaskCompletions(): Promise<void> {
  const listed = await listOpenTasks();
  const stillOpen = new Set(listed.map(task => task.id));

  for (const task of listed) {
    watchOpenTask(task.id, demoTaskFromEngine(task));
  }

  for (const [taskId, task] of [...openTasks]) {
    if (stillOpen.has(taskId)) continue;
    await onTaskCompleted({
      taskId,
      task,
      processInstanceId: task.processInstanceId ?? task.id?.processInstanceId,
    });
  }
}

async function pollHistoryCompletions(): Promise<void> {
  if (historyAvailable === false) return;
  try {
    const completed = await listCompletedTasks({ finishedAfter, maxResults: 50 });
    historyAvailable = true;
    const fresh = completed
      .filter(task => !seenCompletions.has(task.id))
      .sort((a, b) => (a.endTime ?? '').localeCompare(b.endTime ?? ''));
    for (const task of fresh) {
      await onTaskCompleted({
        taskId: task.id,
        task: demoTaskFromHistoric(task),
        processInstanceId: task.processInstanceId,
        endTime: task.endTime,
        durationMs: task.duration,
      });
    }
  } catch {
    if (historyAvailable === undefined) historyAvailable = false;
  }
}

async function pollCompletions(): Promise<void> {
  try {
    await pollOpenTaskCompletions();
  } catch {
    /* engine may be down */
  }
  await pollHistoryCompletions();
}

async function handleCreateTask(ctx: unknown): Promise<DemoTaskResult> {
  const task = taskFromContext(ctx);
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    event: INTENTS.CreateTask,
    task,
    outcome: 'pending',
  };
  prependLog(entry);
  setStatus(statusEl(), `CreateTask · ${summarizeTask(task)}`);

  try {
    const created = await createTask({
      name: task.name,
      description: task.description,
      assignee: task.assignee,
    });
    const result: DemoTaskResult = {
      type: CONTEXT_TYPES.taskResult,
      processInstanceId: created.processInstanceId,
      taskId: created.taskId,
    };
    entry.outcome = 'ok';
    entry.result = result;
    if (created.taskId) {
      watchOpenTask(created.taskId, {
        ...task,
        id: { taskId: created.taskId, processInstanceId: created.processInstanceId },
        processInstanceId: created.processInstanceId,
      });
    }
    renderLog();
    showDetail(entry);
    setStatus(statusEl(), `Created ${summarizeResult(entry)}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    entry.outcome = 'fail';
    entry.error = message;
    renderLog();
    showDetail(entry);
    setStatus(statusEl(), `CreateTask failed: ${message}`);
    throw error;
  }
}

function handleGetApproval(ctx: unknown): Promise<Context | ContextWithMetadata> {
  const incoming = approvalFromContext(ctx);
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    event: INTENTS.GetApproval,
    task: {
      type: CONTEXT_TYPES.task,
      name: incoming.name || incoming.subject?.intent || 'Order approval',
      description: incoming.reason,
    },
    outcome: 'pending',
  };
  prependLog(entry);
  setStatus(statusEl(), `GetApproval · ${summarizeTask(entry.task)}`);

  return (async () => {
    try {
      const started = await startApproval({ approval: incoming });
      const approval = started.approval;
      const result: DemoTaskResult = {
        type: CONTEXT_TYPES.taskResult,
        processInstanceId: started.processInstanceId,
        taskId: started.taskId,
      };
      entry.outcome = 'ok';
      entry.result = result;
      entry.task = {
        type: CONTEXT_TYPES.task,
        id: { taskId: started.taskId, processInstanceId: started.processInstanceId },
        name: approval.name || entry.task.name,
        description: `Requester ${started.requester}; approver ${started.approver}`,
        assignee: started.approver,
        processInstanceId: started.processInstanceId,
      };
      renderLog();
      showDetail(entry);
      setStatus(
        statusEl(),
        `GetApproval pending · ${started.approver} · process ${started.processInstanceId}`
      );

      if (started.taskId) {
        watchOpenTask(started.taskId, entry.task);
      }

      return await new Promise<Context | ContextWithMetadata>((resolve, reject) => {
        const held: HeldApproval = {
          approval,
          taskId: started.taskId,
          processInstanceId: started.processInstanceId,
          resolve,
          reject,
          settled: false,
        };
        if (started.taskId) heldByTaskId.set(started.taskId, held);
        heldByProcessId.set(started.processInstanceId, held);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      entry.outcome = 'fail';
      entry.error = message;
      renderLog();
      showDetail(entry);
      setStatus(statusEl(), `GetApproval failed: ${message}`);
      throw error;
    }
  })();
}

async function setup(): Promise<void> {
  document.getElementById('open-tasklist')!.addEventListener('click', () => openTasklist());
  renderLog();
  void pollCompletions();
  window.setInterval(() => void pollCompletions(), POLL_MS);

  fdc3 = await connectAgent(statusEl());
  if (!fdc3) {
    setStatus(statusEl(), 'No Desktop Agent. CreateTask / GetApproval need an FDC3 host.');
    return;
  }
  await fdc3.addIntentListener(INTENTS.CreateTask, async ctx => handleCreateTask(ctx));
  await fdc3.addIntentListener(INTENTS.GetApproval, async ctx => handleGetApproval(ctx));
  setStatus(statusEl(), 'Listening for CreateTask / GetApproval');
}

void setup();
