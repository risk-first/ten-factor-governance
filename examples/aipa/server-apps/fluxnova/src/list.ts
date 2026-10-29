import '../../../common/src/ui/styles.css';
import './list.css';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import { toSignedResult } from '../../../common/src/security/envelope.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type {
  AppIdentifier,
  Context,
  ContextMetadata,
  ContextWithMetadata,
  DesktopAgent,
} from '@finos/fdc3';
import {
  createTask,
  fetchTaskSnapshot,
  listCompletedTasks,
  listOpenTasks,
  pingEngine,
  signContext,
  startApproval,
} from './api.ts';
import { formatWhen, outcomeClass, statusLabel, summarizeTask } from './task.ts';
import { mountSession } from './session.ts';
import {
  CONTEXT_TYPES,
  EXECUTION_APP_ID,
  INTENTS,
  VIEW_APP_ID,
  approvalFromContext,
  snapshotFromContext,
  statusFromDecision,
  taskFromContext,
  type ApprovalRecord,
  type ApprovalSubject,
  type DemoTaskResult,
  type TaskSnapshot,
} from './types.ts';

const POLL_MS = 2000;

type HeldApproval = {
  approval: ApprovalRecord;
  taskId?: string;
  processInstanceId: string;
  resolve: (result: Context | ContextWithMetadata) => void;
  reject: (error: Error) => void;
  settled: boolean;
};

type Row = {
  task: TaskSnapshot;
};

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;
const byId = new Map<string, Row>();
const seenIds = new Set<string>();
const heldByTaskId = new Map<string, HeldApproval>();
const heldByProcessId = new Map<string, HeldApproval>();
let work: Row[] = [];
let selectedId: string | undefined;
let primed = false;
let createInFlight = 0;
let fdc3: DesktopAgent | null = null;
let engineOk: boolean | undefined;

function findHeld(taskId?: string, processInstanceId?: string): HeldApproval | undefined {
  if (taskId && heldByTaskId.has(taskId)) return heldByTaskId.get(taskId);
  if (processInstanceId && heldByProcessId.has(processInstanceId)) {
    return heldByProcessId.get(processInstanceId);
  }
  return undefined;
}

function upsert(task: TaskSnapshot, opts?: { select?: boolean }): Row {
  const id = task.id.taskId;
  seenIds.add(id);
  const existing = byId.get(id);
  const row = existing ?? { task };
  row.task = existing
    ? { ...existing.task, ...task, approval: task.approval ?? existing.task.approval }
    : task;
  if (!existing) {
    byId.set(id, row);
    work = [row, ...work];
  }
  if (opts?.select !== false) selectedId = id;
  return row;
}

function removeRow(id: string): void {
  const row = byId.get(id);
  if (!row) return;
  byId.delete(id);
  work = work.filter(item => item !== row);
  if (selectedId === id) selectedId = work[0]?.task.id.taskId;
}

function renderEngine(): void {
  const badge = document.getElementById('engine')!;
  if (engineOk === true) {
    badge.className = 'badge';
    badge.textContent = 'Engine up';
  } else if (engineOk === false) {
    badge.className = 'badge warn';
    badge.textContent = 'Engine down';
  } else {
    badge.className = 'badge';
    badge.textContent = 'Engine…';
  }
}

function render(): void {
  renderEngine();
  const tbody = document.getElementById('work')!;
  tbody.replaceChildren();

  for (const row of work) {
    const task = row.task;
    const id = task.id.taskId;
    const pending = task.status === 'pending';
    const tr = document.createElement('tr');
    if (selectedId === id) tr.classList.add('selected');
    tr.addEventListener('click', event => {
      if ((event.target as HTMLElement).closest('button')) return;
      selectedId = id;
      render();
    });

    const whenTd = document.createElement('td');
    whenTd.textContent = formatWhen(task.ended ?? task.created);

    const statusTd = document.createElement('td');
    statusTd.className = outcomeClass(task.status);
    statusTd.textContent = statusLabel(task.status);

    const taskTd = document.createElement('td');
    taskTd.textContent = summarizeTask(task);

    const assigneeTd = document.createElement('td');
    assigneeTd.textContent = task.assignee ?? task.approver ?? '—';

    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions--multi';
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'primary';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', event => {
      event.stopPropagation();
      selectedId = id;
      render();
      void openView(task);
    });
    actionsTd.append(openBtn);
    if (!pending) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', event => {
        event.stopPropagation();
        removeRow(id);
        render();
        setStatus(statusEl(), 'Cleared from worklist');
      });
      actionsTd.append(clearBtn);
    }

    tr.append(whenTd, statusTd, taskTd, assigneeTd, actionsTd);
    tbody.append(tr);
  }
}

async function hideInbox(): Promise<void> {
  if (!fdc3) return;
  try {
    await fdc3.close();
  } catch {
    /* already hidden or agent ignored close */
  }
}

async function openView(task: TaskSnapshot): Promise<void> {
  if (!fdc3) return;
  selectedId = task.id.taskId;
  render();
  try {
    await fdc3.raiseIntent(INTENTS.ViewTask, task, { appId: VIEW_APP_ID });
    void hideInbox();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(statusEl(), `Open view failed: ${message}`);
  }
}

async function notifyViews(task: TaskSnapshot): Promise<void> {
  if (!fdc3) return;
  try {
    const instances = await fdc3.findInstances({ appId: VIEW_APP_ID });
    await Promise.all(
      instances.map(async instance => {
        try {
          await fdc3!.raiseIntent(INTENTS.ViewTask, task, instance);
        } catch {
          /* instance may have closed */
        }
      })
    );
  } catch {
    /* no running views */
  }
}

function targetFor(subject: ApprovalSubject): AppIdentifier {
  const appId = subject.app?.appId ?? EXECUTION_APP_ID;
  return subject.app?.instanceId ? { appId, instanceId: subject.app.instanceId } : { appId };
}

async function performAction(subject: ApprovalSubject): Promise<Context | ContextWithMetadata> {
  if (!fdc3) throw new Error('No Desktop Agent');
  const context = subject.context;
  if (!context || typeof context !== 'object') {
    throw new Error('Approval has no subject context');
  }
  const envelope = await signContext(context);
  const signed = toSignedResult(envelope);
  const metadata = {
    signature: signed.metadata.signature,
    antiReplay: signed.metadata.antiReplay,
  };
  const signedContext = signed.context as Context;

  if (subject.action === 'broadcast') {
    setStatus(
      statusEl(),
      subject.channelId ? `Broadcasting on ${subject.channelId}…` : 'Broadcasting…'
    );
    if (subject.channelId) {
      const channel = await fdc3.getOrCreateChannel(subject.channelId);
      await channel.broadcast(signedContext, metadata);
    } else {
      await fdc3.broadcast(signedContext, metadata);
    }
    return { type: 'fdc3.nothing' };
  }

  const intent = subject.intent;
  const target = targetFor(subject);
  if (!intent) {
    setStatus(statusEl(), `Raising for context → ${target.appId}…`);
    const resolution = await fdc3.raiseIntentForContext(
      signedContext,
      target.instanceId ? target : { appId: target.appId },
      undefined,
      metadata
    );
    const result = await resolution.getResult();
    return result && typeof result === 'object' && 'type' in result
      ? (result as Context)
      : { type: 'fdc3.nothing' };
  }

  setStatus(statusEl(), `Submitting ${intent} → ${target.appId}…`);
  const resolution = await fdc3.raiseIntent(
    intent,
    signedContext,
    target.instanceId ? target : { appId: target.appId },
    undefined,
    metadata
  );
  const result = await resolution.getResult();
  let resultMetadata: ContextMetadata | undefined;
  try {
    resultMetadata = await resolution.getResultMetadata();
  } catch {
    resultMetadata = undefined;
  }
  if (result && typeof result === 'object' && 'type' in result && resultMetadata) {
    return { context: result as Context, metadata: resultMetadata };
  }
  if (result && typeof result === 'object' && 'type' in result) {
    return result as Context;
  }
  return { type: 'fdc3.nothing' };
}

async function settleApproved(held: HeldApproval): Promise<void> {
  if (held.settled) return;
  const subject = held.approval.subject;
  if (!subject) {
    held.settled = true;
    held.approval.status = 'rejected';
    held.reject(new Error('Approval has no subject action'));
    return;
  }
  try {
    const payload = await performAction(subject);
    held.settled = true;
    held.approval.status = 'approved';
    held.approval.updatedAt = new Date().toISOString();
    setStatus(statusEl(), 'Approved and submitted');
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

function releaseHeld(held: HeldApproval): void {
  if (held.taskId) heldByTaskId.delete(held.taskId);
  heldByProcessId.delete(held.processInstanceId);
}

async function onTaskTerminal(task: TaskSnapshot): Promise<void> {
  upsert(task, { select: true });
  render();
  void notifyViews(task);

  const held = findHeld(task.id.taskId, task.processInstanceId);
  if (!held || held.settled) return;
  if (task.status === 'approved') {
    await settleApproved(held);
  } else if (task.status === 'rejected') {
    settleRejected(held, 'Approval rejected');
  } else {
    settleRejected(held, 'Approval completed without decision');
  }
  releaseHeld(held);
}

async function poll(): Promise<void> {
  engineOk = await pingEngine();
  if (!engineOk) {
    renderEngine();
    if (primed) setStatus(statusEl(), 'Fluxnova engine not reachable');
    return;
  }

  let open: TaskSnapshot[];
  try {
    open = await listOpenTasks();
  } catch (error) {
    engineOk = false;
    renderEngine();
    const message = error instanceof Error ? error.message : String(error);
    setStatus(statusEl(), `Task poll failed: ${message}`);
    return;
  }

  const wasPrimed = primed;
  const openIds = new Set(open.map(task => task.id.taskId));
  const arrived: TaskSnapshot[] = [];

  for (const task of open) {
    const held = findHeld(task.id.taskId, task.processInstanceId);
    if (held && !held.taskId && task.id.taskId) {
      held.taskId = task.id.taskId;
      heldByTaskId.set(task.id.taskId, held);
    }
    const isNew = !seenIds.has(task.id.taskId);
    upsert(task, { select: isNew && wasPrimed });
    if (isNew) arrived.push(task);
  }

  const pendingGone = work.filter(
    row => row.task.status === 'pending' && !openIds.has(row.task.id.taskId)
  );
  for (const row of pendingGone) {
    let snapshot = row.task;
    try {
      snapshot = (await fetchTaskSnapshot(row.task.id.taskId)) ?? row.task;
    } catch {
      snapshot = {
        ...row.task,
        status: statusFromDecision(undefined, true),
        ended: new Date().toISOString(),
      };
    }
    if (snapshot.status === 'pending') {
      snapshot = { ...snapshot, status: 'completed', ended: snapshot.ended ?? new Date().toISOString() };
    }
    await onTaskTerminal(snapshot);
  }

  if (!wasPrimed) {
    try {
      const recent = await listCompletedTasks({ maxResults: 20 });
      for (const task of recent) {
        if (!byId.has(task.id.taskId)) upsert(task, { select: false });
        seenIds.add(task.id.taskId);
      }
    } catch {
      /* history optional */
    }
  }

  primed = true;
  render();

  if (wasPrimed && createInFlight === 0) {
    const toOpen = arrived.find(task => !findHeld(task.id.taskId, task.processInstanceId));
    if (toOpen) {
      setStatus(statusEl(), `New task · ${summarizeTask(toOpen)}`);
      void openView(toOpen);
    }
  }
}

function handleGetApproval(ctx: unknown): Promise<Context | ContextWithMetadata> {
  const incoming = approvalFromContext(ctx);
  setStatus(statusEl(), `GetApproval · ${incoming.name || incoming.subject?.intent || 'approval'}`);
  return (async () => {
    createInFlight += 1;
    try {
      const started = await startApproval({ approval: incoming });
      const approval = started.approval;
      const task = started.task
        ? { ...started.task, approval: started.task.approval ?? approval }
        : snapshotFromContext({
            type: CONTEXT_TYPES.task,
            id: { taskId: started.taskId, processInstanceId: started.processInstanceId },
            name: approval.name || incoming.subject?.intent || 'Order approval',
            description: `Requester ${started.requester}; approver ${started.approver}`,
            assignee: started.approver,
            status: 'pending',
            requester: started.requester,
            approver: started.approver,
            approval,
          });
      if (task) upsert(task);
      render();
      setStatus(
        statusEl(),
        `Task posted · ${started.approver} · process ${started.processInstanceId}`
      );

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
      setStatus(statusEl(), `GetApproval failed: ${message}`);
      throw error;
    } finally {
      createInFlight -= 1;
    }
  })();
}

async function handleCreateTask(ctx: unknown): Promise<DemoTaskResult> {
  const incoming = taskFromContext(ctx);
  createInFlight += 1;
  setStatus(statusEl(), `CreateTask · ${incoming.name?.trim() || 'Untitled task'}`);
  try {
    const created = await createTask({
      name: incoming.name,
      description: incoming.description,
      assignee: incoming.assignee,
    });
    if (created.task) upsert(created.task);
    else if (created.taskId) {
      upsert({
        type: CONTEXT_TYPES.task,
        id: { taskId: created.taskId, processInstanceId: created.processInstanceId },
        name: incoming.name?.trim() || 'Untitled task',
        description: incoming.description,
        assignee: incoming.assignee,
        processInstanceId: created.processInstanceId,
        status: 'pending',
      });
    }
    render();
    setStatus(statusEl(), `Created process ${created.processInstanceId}`);
    return created;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(statusEl(), `CreateTask failed: ${message}`);
    throw error;
  } finally {
    createInFlight -= 1;
  }
}

async function setup(): Promise<void> {
  const session = await mountSession(statusEl, render);
  session.bind();
  session.render();
  render();
  void poll();
  window.setInterval(() => void poll().catch(() => undefined), POLL_MS);

  fdc3 = await connectAgent(statusEl());
  if (!fdc3) {
    setStatus(statusEl(), 'No Desktop Agent. GetApproval / CreateTask need an FDC3 host.');
    return;
  }
  await fdc3.addIntentListener(INTENTS.CreateTask, async ctx => handleCreateTask(ctx));
  await fdc3.addIntentListener(INTENTS.GetApproval, async ctx => handleGetApproval(ctx));
  setStatus(statusEl(), 'Listening for GetApproval / CreateTask');
}

void setup();
