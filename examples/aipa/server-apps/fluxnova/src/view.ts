import '../../../common/src/ui/styles.css';
import './view.css';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import { ordersFromContext } from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { Context, DesktopAgent } from '@finos/fdc3';
import { completeTask, fetchTaskSnapshot } from './api.ts';
import { sessionMatchesAssignee } from './org.ts';
import { mountSession, type SessionHandle } from './session.ts';
import { actionLabel, badgeClass, statusLabel, summarizeTask } from './task.ts';
import { INTENTS, snapshotFromContext, type TaskSnapshot } from './types.ts';

type Waiter = {
  resolve: (result: Context) => void;
  reject: (error: Error) => void;
};

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;
const waitersById = new Map<string, Waiter[]>();
let fdc3: DesktopAgent | null = null;
let session: SessionHandle | null = null;
let record: TaskSnapshot | undefined;
let busy = false;

function assigneeOf(task: TaskSnapshot | undefined): string | undefined {
  return task?.approver ?? task?.assignee;
}

function canDecide(task: TaskSnapshot | undefined): boolean {
  if (!task || task.status !== 'pending' || busy) return false;
  return sessionMatchesAssignee(session?.user, assigneeOf(task));
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function dlRow(term: string, value: string | undefined): HTMLDivElement | undefined {
  if (!value) return undefined;
  const row = el('div', 'task-view__row');
  row.append(el('dt', undefined, term), el('dd', undefined, value));
  return row;
}

function renderOrders(task: TaskSnapshot): HTMLElement | undefined {
  const orders = ordersFromContext(task.approval?.subject?.context);
  if (!orders.length && !task.orderSummary && !task.ticker) {
    return undefined;
  }
  const card = el('section', 'task-card');
  card.append(el('h3', 'task-card__title', 'Order'));

  if (orders.length) {
    const table = el('table', 'task-order');
    const thead = el('thead');
    const headRow = el('tr');
    for (const label of ['Side', 'Qty', 'Ticker', 'Name']) {
      headRow.append(el('th', undefined, label));
    }
    thead.append(headRow);
    const tbody = el('tbody');
    for (const order of orders) {
      const tr = el('tr');
      const side = el('td', `task-order__side task-order__side--${order.side ?? ''}`);
      side.textContent = (order.side ?? '').toUpperCase();
      const qty = el('td', 'task-order__qty', order.quantity != null ? String(order.quantity) : '—');
      const ticker = el('td', 'task-order__ticker', order.instrument?.id?.ticker ?? '—');
      const name = el('td', undefined, order.instrument?.name ?? order.name ?? '');
      tr.append(side, qty, ticker, name);
      tbody.append(tr);
    }
    table.append(thead, tbody);
    card.append(table);
    return card;
  }

  const summary = el('p', 'task-card__hero', summarizeTask(task));
  const meta = el('p', 'task-card__meta');
  const bits = [task.side, task.quantity, task.ticker].filter(Boolean);
  meta.textContent = bits.length ? bits.join(' · ') : '';
  card.append(summary);
  if (meta.textContent) card.append(meta);
  return card;
}

function renderAction(task: TaskSnapshot): HTMLElement | undefined {
  const subject = task.approval?.subject;
  if (!subject && !task.description) return undefined;
  const card = el('section', 'task-card');
  card.append(el('h3', 'task-card__title', 'Proposed action'));
  const dl = el('dl', 'task-view__dl');
  const rows = [
    dlRow('Action', actionLabel(task)),
    dlRow('Title', subject?.title),
    dlRow('Intent', subject?.intent),
    dlRow('Target', subject?.app?.appId),
    dlRow('Channel', subject?.channelId),
    dlRow('Context', subject?.context && typeof subject.context === 'object' ? (subject.context as { type?: string }).type : undefined),
  ].filter((row): row is HTMLDivElement => Boolean(row));
  for (const row of rows) dl.append(row);
  card.append(dl);
  return card;
}

function renderPeople(task: TaskSnapshot): HTMLElement {
  const card = el('section', 'task-card');
  card.append(el('h3', 'task-card__title', 'Task'));
  const dl = el('dl', 'task-view__dl');
  const rows = [
    dlRow('Name', task.name),
    dlRow('Requester', task.requester ?? task.approval?.requester),
    dlRow('Approver', task.approver ?? task.assignee),
    dlRow('Reason', task.approval?.reason ?? task.description),
    dlRow('Process', task.processInstanceId ?? task.id.processInstanceId),
  ].filter((row): row is HTMLDivElement => Boolean(row));
  for (const row of rows) dl.append(row);
  card.append(dl);
  return card;
}

function render(): void {
  session?.render();
  const detail = document.getElementById('detail')!;
  const approveBtn = document.getElementById('approve') as HTMLButtonElement;
  const denyBtn = document.getElementById('deny') as HTMLButtonElement;
  const badge = document.getElementById('task-status')!;

  if (!record) {
    detail.replaceChildren(el('p', 'task-view__empty', 'Waiting for a Fluxnova task…'));
    badge.hidden = true;
    approveBtn.disabled = true;
    denyBtn.disabled = true;
    approveBtn.title = '';
    denyBtn.title = '';
    document.title = 'AIPA Fluxnova Task';
    return;
  }

  const pending = record.status === 'pending' && !busy;
  const allowed = canDecide(record);
  approveBtn.disabled = !allowed;
  denyBtn.disabled = !allowed;
  const hint = !pending
    ? 'Already decided'
    : !session?.user
      ? 'Sign in to approve or deny'
      : allowed
        ? 'Complete this Fluxnova task'
        : `Assigned to ${assigneeOf(record) ?? 'nobody'}`;
  approveBtn.title = hint;
  denyBtn.title = hint;
  badge.hidden = false;
  badge.className = badgeClass(record.status);
  badge.textContent = statusLabel(record.status);
  document.title = record.name || 'AIPA Fluxnova Task';

  const header = el('header', 'task-view__header');
  header.append(el('h2', 'task-view__title', record.name || 'Untitled task'));
  header.append(el('p', 'task-view__summary', summarizeTask(record)));

  const body = el('div', 'task-view__body');
  const order = renderOrders(record);
  const action = renderAction(record);
  if (order) body.append(order);
  if (action) body.append(action);
  body.append(renderPeople(record));

  detail.replaceChildren(header, body);
}

function settleWaiters(action: (waiter: Waiter) => void): void {
  const id = record?.id.taskId;
  const pending = id ? (waitersById.get(id) ?? []) : [];
  if (id) waitersById.delete(id);
  for (const waiter of pending) action(waiter);
}

async function hideView(): Promise<void> {
  if (!fdc3) return;
  try {
    await fdc3.close();
  } catch {
    /* already hidden or agent ignored close */
  }
}

async function decide(decision: 'approved' | 'rejected'): Promise<void> {
  if (!session?.user) {
    setStatus(statusEl(), 'Sign in with Microsoft before completing.');
    return;
  }
  if (!record || record.status !== 'pending' || busy) return;
  if (!sessionMatchesAssignee(session.user, assigneeOf(record))) {
    setStatus(
      statusEl(),
      `Signed in as ${session.user.email}; this task is assigned to ${assigneeOf(record) ?? 'nobody'}`
    );
    return;
  }
  busy = true;
  render();
  setStatus(statusEl(), decision === 'approved' ? 'Sending approval to Fluxnova…' : 'Sending denial to Fluxnova…');
  try {
    const updated = await completeTask(record.id.taskId, decision);
    record = updated ?? {
      ...record,
      status: decision,
      decision,
      ended: new Date().toISOString(),
    };
    busy = false;
    render();
    setStatus(statusEl(), decision === 'approved' ? 'Approved in Fluxnova' : 'Denied in Fluxnova');
    settleWaiters(w => w.resolve({ type: 'fdc3.nothing' }));
    void hideView();
  } catch (error) {
    busy = false;
    render();
    setStatus(statusEl(), `Complete failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const POLL_MS = 2000;

async function refreshOpenTask(): Promise<void> {
  if (!record?.id.taskId || record.status !== 'pending' || busy) return;
  try {
    const latest = await fetchTaskSnapshot(record.id.taskId);
    if (!latest || latest.status === record.status) return;
    record = latest;
    render();
    setStatus(statusEl(), statusLabel(latest.status));
    settleWaiters(w => w.resolve({ type: 'fdc3.nothing' }));
  } catch {
    /* engine may be down */
  }
}

async function show(incoming: unknown): Promise<Context> {
  const fromIntent = snapshotFromContext(incoming);
  const taskId = fromIntent?.id.taskId;
  if (!taskId) {
    setStatus(statusEl(), 'ViewTask is missing a task id');
    return { type: 'fdc3.nothing' };
  }
  try {
    record = (await fetchTaskSnapshot(taskId)) ?? fromIntent;
  } catch {
    record = fromIntent;
  }
  render();
  if (!record || record.status !== 'pending') {
    setStatus(statusEl(), record ? statusLabel(record.status) : 'Task not found');
    return { type: 'fdc3.nothing' };
  }
  setStatus(statusEl(), `Pending · ${record.name}`);
  return new Promise<Context>((resolve, reject) => {
    const pending = waitersById.get(taskId) ?? [];
    pending.push({ resolve, reject });
    waitersById.set(taskId, pending);
  });
}

async function setup(): Promise<void> {
  session = await mountSession(statusEl, render);
  session.bind();
  render();
  document.getElementById('approve')!.addEventListener('click', () => void decide('approved'));
  document.getElementById('deny')!.addEventListener('click', () => void decide('rejected'));

  const app = await connectAgent(statusEl());
  fdc3 = app;
  if (!fdc3) {
    setStatus(statusEl(), 'No Desktop Agent. Waiting to be opened with ViewTask.');
    return;
  }
  await fdc3.addIntentListener(INTENTS.ViewTask, async ctx => show(ctx));
  window.setInterval(() => void refreshOpenTask(), POLL_MS);
  setStatus(statusEl(), 'Waiting for ViewTask…');
}

void setup();
