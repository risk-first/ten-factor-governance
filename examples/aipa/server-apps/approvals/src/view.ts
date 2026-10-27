import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { INTENTS } from '../../../common/src/contexts/types.ts';
import { toSignedResult, type SignedEnvelope } from '../../../common/src/security/envelope.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { Context, ContextMetadata, ContextWithMetadata, DesktopAgent } from '@finos/fdc3';
import { accept, keyOf, statusLabel, type ApprovalRecord } from './approval.ts';
import { mountSession, type SessionHandle } from './session.ts';

type Waiter = {
  resolve: (result: Context | ContextWithMetadata) => void;
  reject: (error: Error) => void;
};

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;
let fdc3: DesktopAgent | null = null;
let session: SessionHandle | null = null;
let record: ApprovalRecord | undefined;
const waitersById = new Map<string, Waiter[]>();

function render(): void {
  session?.render();
  const detail = document.getElementById('detail')!;
  const approveBtn = document.getElementById('approve') as HTMLButtonElement;
  const denyBtn = document.getElementById('deny') as HTMLButtonElement;
  if (!record) {
    detail.textContent = 'Waiting for ViewApproval…';
    approveBtn.disabled = true;
    denyBtn.disabled = true;
    return;
  }
  detail.hidden = false;
  detail.textContent = JSON.stringify(record, null, 2);
  const pending = record.status === 'pending';
  approveBtn.disabled = !pending || !session?.user;
  denyBtn.disabled = !pending;
  approveBtn.title = !pending
    ? 'Already decided'
    : session?.user
      ? 'Approve and submit'
      : 'Sign in to approve';
}

function settleWaiters(action: (waiter: Waiter) => void): void {
  const id = record ? keyOf(record) : undefined;
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

async function approve(): Promise<void> {
  if (!session?.user) {
    setStatus(statusEl(), 'Sign in with Microsoft before approving.');
    return;
  }
  if (!record || record.status !== 'pending' || !fdc3) return;
  const subject = record.subject;
  const context = subject?.context;
  if (!context) {
    record.status = 'rejected';
    record.updatedAt = new Date().toISOString();
    render();
    settleWaiters(w => w.reject(new Error('Approval has no subject context')));
    void hideView();
    return;
  }
  try {
    const res = await fetch('/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    });
    if (!res.ok) {
      setStatus(statusEl(), `Sign failed: ${res.status}`);
      return;
    }
    const envelope = (await res.json()) as SignedEnvelope;
    const signed = toSignedResult(envelope);
    const intent = subject.intent ?? INTENTS.SubmitOrder;
    const target = { appId: intent === INTENTS.SubmitOrder ? 'aipa-execution' : (subject.app?.appId ?? 'aipa-execution') };
    setStatus(statusEl(), `Submitting ${intent} → ${target.appId}…`);
    const resolution = await fdc3.raiseIntent(
      intent,
      signed.context as Context,
      target,
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
    record.status = 'approved';
    record.updatedAt = new Date().toISOString();
    render();
    setStatus(statusEl(), 'Approved and submitted');
    const payload: Context | ContextWithMetadata =
      result && typeof result === 'object' && 'type' in result && resultMetadata
        ? { context: result as Context, metadata: resultMetadata }
        : result && typeof result === 'object' && 'type' in result
          ? (result as Context)
          : { type: 'fdc3.nothing' };
    settleWaiters(w => w.resolve(payload));
    void hideView();
  } catch (error) {
    setStatus(statusEl(), `Approve failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function deny(): void {
  if (!record || record.status !== 'pending') return;
  record.status = 'rejected';
  record.updatedAt = new Date().toISOString();
  render();
  setStatus(statusEl(), 'Denied');
  settleWaiters(w => w.reject(new Error('Approval rejected')));
  void hideView();
}

function show(incoming: ApprovalRecord): Promise<Context | ContextWithMetadata> | Context {
  record = accept(incoming);
  document.title = `Approval ${keyOf(record) ?? ''}`.trim();
  render();
  if (record.status !== 'pending') {
    setStatus(statusEl(), statusLabel(record.status));
    return { type: 'fdc3.nothing' };
  }
  setStatus(statusEl(), `Pending approval ${record.id.approvalId}`);
  const id = keyOf(record)!;
  return new Promise<Context | ContextWithMetadata>((resolve, reject) => {
    const pending = waitersById.get(id) ?? [];
    pending.push({ resolve, reject });
    waitersById.set(id, pending);
  });
}

async function setup(): Promise<void> {
  session = await mountSession(statusEl, render);
  session.bind();

  const app = await connectAppSession(statusEl());
  fdc3 = app.fdc3;
  render();

  document.getElementById('approve')!.addEventListener('click', () => void approve());
  document.getElementById('deny')!.addEventListener('click', () => deny());

  if (!fdc3) return;
  await fdc3.addIntentListener(INTENTS.ViewApproval, async ctx => show(ctx as ApprovalRecord));
}

void setup();
