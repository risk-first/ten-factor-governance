import '../../../common/src/ui/styles.css';
import './list.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { INTENTS } from '../../../common/src/contexts/types.ts';
import { recordEnforcement } from '../../../common/src/governance/enforcement.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { Context, ContextMetadata, ContextWithMetadata, DesktopAgent } from '@finos/fdc3';
import {
  accept,
  formatWhen,
  keyOf,
  outcomeClass,
  statusLabel,
  summarizeSubject,
  VIEW_APP_ID,
  type ApprovalRecord,
} from './approval.ts';
import { mountSession } from './session.ts';

type Held = {
  record: ApprovalRecord;
  resolve: (result: Context | ContextWithMetadata) => void;
  reject: (error: Error) => void;
  settled: boolean;
};

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;
const byId = new Map<string, Held>();
let work: Held[] = [];
let selectedId: string | undefined;
let fdc3: DesktopAgent | null = null;

function findHeld(approval: { id?: { requestId?: string; approvalId?: string } }): Held | undefined {
  const approvalId = approval.id?.approvalId;
  const requestId = approval.id?.requestId;
  if (approvalId && byId.has(approvalId)) return byId.get(approvalId);
  if (requestId && byId.has(requestId)) return byId.get(requestId);
  return undefined;
}

function indexHeld(held: Held): void {
  if (held.record.id.requestId) byId.set(held.record.id.requestId, held);
  if (held.record.id.approvalId) byId.set(held.record.id.approvalId, held);
}

function removeHeld(held: Held): void {
  if (held.record.id.requestId) byId.delete(held.record.id.requestId);
  if (held.record.id.approvalId) byId.delete(held.record.id.approvalId);
  work = work.filter(item => item !== held);
  const id = keyOf(held.record);
  if (selectedId === id || selectedId === held.record.id.requestId || selectedId === held.record.id.approvalId) {
    selectedId = work[0] ? keyOf(work[0].record) : undefined;
  }
}

function persistWork(): void {
  void fetch('/api/approvals', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: work.map(item => item.record) }),
  }).catch(() => undefined);
}

function restoreHeld(record: ApprovalRecord): Held {
  const settled = record.status !== 'pending';
  const held: Held = {
    record,
    resolve: () => undefined,
    reject: () => undefined,
    settled,
  };
  indexHeld(held);
  return held;
}

function render(): void {
  const tbody = document.getElementById('work')!;
  tbody.replaceChildren();

  for (const held of work) {
    const id = keyOf(held.record)!;
    const pending = held.record.status === 'pending';
    const tr = document.createElement('tr');
    if (selectedId === id || selectedId === held.record.id.requestId || selectedId === held.record.id.approvalId) {
      tr.classList.add('selected');
    }
    tr.addEventListener('click', event => {
      if ((event.target as HTMLElement).closest('button')) return;
      selectedId = id;
      render();
    });

    const whenTd = document.createElement('td');
    whenTd.textContent = formatWhen(held.record.updatedAt);

    const statusTd = document.createElement('td');
    statusTd.className = outcomeClass(held.record.status);
    statusTd.textContent = statusLabel(held.record.status);

    const subjectTd = document.createElement('td');
    subjectTd.textContent = summarizeSubject(held.record);

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
      void openView(held);
    });
    actionsTd.append(openBtn);
    if (!pending) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', event => {
        event.stopPropagation();
        clear(id);
      });
      actionsTd.append(clearBtn);
    }

    tr.append(whenTd, statusTd, subjectTd, actionsTd);
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

async function openView(held: Held): Promise<void> {
  if (!fdc3) return;
  selectedId = keyOf(held.record);
  render();
  try {
    const resolution = await fdc3.raiseIntent(INTENTS.ViewApproval, held.record, { appId: VIEW_APP_ID });
    void hideInbox();
    const result = await resolution.getResult();
    if (held.settled) return;
    if (result && typeof result === 'object' && 'type' in result) {
      finishApproved(held, result as Context);
    } else {
      finishApproved(held, undefined);
    }
  } catch (error) {
    if (held.settled) return;
    finishRejected(held, error instanceof Error ? error.message : String(error));
  }
}

async function notifyViews(record: ApprovalRecord): Promise<void> {
  if (!fdc3) return;
  try {
    const instances = await fdc3.findInstances({ appId: VIEW_APP_ID });
    await Promise.all(
      instances.map(async instance => {
        try {
          await fdc3!.raiseIntent(INTENTS.ViewApproval, record, instance);
        } catch {
          /* instance may have closed */
        }
      })
    );
  } catch {
    /* no running views */
  }
}

function finishApproved(held: Held, result: Context | ContextWithMetadata | void): void {
  held.record.status = 'approved';
  held.record.updatedAt = new Date().toISOString();
  held.settled = true;
  selectedId = keyOf(held.record);
  work = [held, ...work.filter(item => item !== held)];
  render();
  setStatus(statusEl(), 'Approved and submitted');
  if (result && typeof result === 'object' && 'context' in result && 'metadata' in result) {
    held.resolve(result as ContextWithMetadata);
  } else if (result && typeof result === 'object' && 'type' in result) {
    held.resolve(result as Context);
  } else {
    held.resolve({ type: 'fdc3.nothing' });
  }
  persistWork();
}

function finishRejected(held: Held, message: string): void {
  held.record.status = 'rejected';
  held.record.updatedAt = new Date().toISOString();
  held.settled = true;
  selectedId = keyOf(held.record);
  work = [held, ...work.filter(item => item !== held)];
  render();
  setStatus(statusEl(), message === 'Approval rejected' ? 'Denied' : message);
  held.reject(new Error(message));
  persistWork();
}

function holdGetApproval(
  incoming: ApprovalRecord,
  metadata?: ContextMetadata
): Promise<Context | ContextWithMetadata> {
  const record = accept(incoming);
  recordEnforcement(fdc3, {
    id: record.id.requestId ?? record.id.approvalId ?? crypto.randomUUID(),
    actorAppId: metadata?.source?.appId ?? 'unknown',
    intent: record.subject?.intent ?? INTENTS.SubmitOrder,
    decision: 'REQUIRE_APPROVAL',
    authorId: 'aipa-approvals',
    authorName: 'AIPA Approvals',
    steps: ['aipa-approvals.holdGetApproval'],
  });
  const promise = new Promise<Context | ContextWithMetadata>((resolve, reject) => {
    const held: Held = { record, resolve, reject, settled: false };
    indexHeld(held);
    work = [held, ...work.filter(item => item !== held)];
    selectedId = keyOf(record);
    void openView(held);
  });
  persistWork();
  render();
  setStatus(statusEl(), `Pending approval ${record.id.approvalId}`);
  return promise;
}

async function openViewOnly(record: ApprovalRecord): Promise<void> {
  if (!fdc3) return;
  try {
    await fdc3.raiseIntent(INTENTS.ViewApproval, record, { appId: VIEW_APP_ID });
    void hideInbox();
  } catch {
    /* view may not be available */
  }
}

function snapshot(incoming: ApprovalRecord): ApprovalRecord {
  const held = findHeld(incoming);
  if (held) {
    selectedId = keyOf(held.record);
    render();
    return held.record;
  }
  return accept({ ...incoming, status: incoming.status ?? 'pending' });
}

function review(incoming: ApprovalRecord): ApprovalRecord {
  const held = findHeld(incoming);
  if (held) {
    selectedId = keyOf(held.record);
    render();
    void openView(held);
    return held.record;
  }
  const record = accept({ ...incoming, status: incoming.status ?? 'pending' });
  void openViewOnly(record);
  return record;
}

function clear(id: string): void {
  const held = byId.get(id);
  if (!held || held.record.status === 'pending') return;
  removeHeld(held);
  persistWork();
  render();
  setStatus(statusEl(), 'Cleared from worklist');
}

function cancel(incoming: ApprovalRecord): ApprovalRecord {
  const held = findHeld(incoming);
  if (!held || held.record.status !== 'pending' || held.settled) {
    throw new Error('Approval cannot be cancelled');
  }
  held.record.status = 'cancelled';
  held.record.updatedAt = new Date().toISOString();
  held.settled = true;
  selectedId = keyOf(held.record);
  work = [held, ...work.filter(item => item !== held)];
  render();
  held.reject(new Error('Approval cancelled'));
  setStatus(statusEl(), 'Cancelled');
  persistWork();
  void notifyViews(held.record);
  return held.record;
}

async function setup(): Promise<void> {
  const session = await mountSession(statusEl, render);
  session.bind();

  const app = await connectAppSession(statusEl());
  fdc3 = app.fdc3;
  try {
    const res = await fetch('/api/approvals');
    const body = (await res.json()) as { entries?: ApprovalRecord[] };
    work = (body.entries ?? []).map(restoreHeld);
  } catch {
    work = [];
  }
  session.render();
  render();

  if (!fdc3) return;

  await fdc3.addIntentListener(INTENTS.GetApproval, async (ctx, metadata) =>
    holdGetApproval(ctx as ApprovalRecord, metadata)
  );
  await fdc3.addIntentListener(INTENTS.UpdateApproval, async ctx => snapshot(ctx as ApprovalRecord));
  await fdc3.addIntentListener(INTENTS.ReviewApproval, async ctx => review(ctx as ApprovalRecord));
  await fdc3.addIntentListener(INTENTS.CancelApproval, async ctx => cancel(ctx as ApprovalRecord));
}

void setup();
