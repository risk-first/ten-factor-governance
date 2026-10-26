import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { CONTEXT_TYPES, INTENTS, ordersFromContext } from '../../../common/src/contexts/types.ts';
import { toSignedResult, type SignedEnvelope } from '../../../common/src/security/envelope.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import { PublicClientApplication, type Configuration } from '@azure/msal-browser';
import type { Context, ContextMetadata, ContextWithMetadata, DesktopAgent } from '@finos/fdc3';

type ApprovalRecord = {
  type: 'fdc3.approval';
  id: { requestId?: string; approvalId?: string };
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  subject?: {
    type?: string;
    action?: string;
    intent?: string;
    context?: Context;
    app?: { appId?: string };
  };
  updatedAt?: string;
};

type Held = {
  record: ApprovalRecord;
  resolve: (result: Context | ContextWithMetadata) => void;
  reject: (error: Error) => void;
  settled: boolean;
};

type EntraConfig = {
  clientId: string;
  authority: string;
  redirectUri: string;
};

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;
/** Lookup by requestId and approvalId. */
const byId = new Map<string, Held>();
/** Unique held items, newest first. */
let work: Held[] = [];
let selectedId: string | undefined;
let fdc3: DesktopAgent | null = null;
let msal: PublicClientApplication | null = null;
let sessionUser: { email: string; name: string } | null = null;

function keyOf(approval: { id?: { requestId?: string; approvalId?: string } }): string | undefined {
  return approval.id?.approvalId ?? approval.id?.requestId;
}

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

function summarizeSubject(record: ApprovalRecord): string {
  const intent = record.subject?.intent ?? 'action';
  const context = record.subject?.context;
  const orders = ordersFromContext(context);
  if (orders.length === 1) {
    const o = orders[0];
    const ticker = o.instrument?.id?.ticker ?? '';
    return `${intent} · ${o.side} ${o.quantity} ${ticker}`.trim();
  }
  if (orders.length > 1) {
    return `${intent} · ${orders.length} legs`;
  }
  const type = context && typeof context === 'object' ? (context as { type?: string }).type : undefined;
  return type ? `${intent} · ${type}` : intent;
}

function formatWhen(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusLabel(status: ApprovalRecord['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Denied';
    case 'cancelled':
      return 'Cancelled';
  }
}

function renderSession(): void {
  const session = document.getElementById('session')!;
  const login = document.getElementById('login') as HTMLButtonElement;
  const logout = document.getElementById('logout') as HTMLButtonElement;
  session.textContent = sessionUser
    ? `Signed in as ${sessionUser.name || sessionUser.email}`
    : 'Not signed in';
  session.className = sessionUser ? 'badge' : 'badge warn';
  login.disabled = Boolean(sessionUser);
  logout.disabled = !sessionUser;
}

function renderDetail(): void {
  const detail = document.getElementById('detail')!;
  const held = selectedId ? byId.get(selectedId) : undefined;
  if (!held) {
    detail.hidden = true;
    detail.textContent = '';
    return;
  }
  detail.hidden = false;
  detail.textContent = JSON.stringify(held.record, null, 2);
}

function render(): void {
  renderSession();
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
    statusTd.className =
      held.record.status === 'approved'
        ? 'outcome outcome--ok'
        : held.record.status === 'pending'
          ? 'outcome'
          : 'outcome outcome--fail';
    statusTd.textContent = statusLabel(held.record.status);

    const subjectTd = document.createElement('td');
    subjectTd.textContent = summarizeSubject(held.record);

    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions--multi';
    if (pending) {
      const approveBtn = document.createElement('button');
      approveBtn.type = 'button';
      approveBtn.className = 'primary';
      approveBtn.textContent = 'Approve';
      approveBtn.disabled = !sessionUser;
      approveBtn.title = sessionUser ? 'Approve and submit' : 'Sign in to approve';
      approveBtn.addEventListener('click', event => {
        event.stopPropagation();
        void approve(id);
      });
      const denyBtn = document.createElement('button');
      denyBtn.type = 'button';
      denyBtn.textContent = 'Deny';
      denyBtn.addEventListener('click', event => {
        event.stopPropagation();
        deny(id);
      });
      actionsTd.append(approveBtn, denyBtn);
    } else {
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

  renderDetail();
}

async function refreshSession(): Promise<void> {
  const res = await fetch('/api/session');
  const body = (await res.json()) as { user: { email: string; name: string } | null };
  sessionUser = body.user;
  render();
}

async function login(): Promise<void> {
  if (!msal) return;
  const result = await msal.loginPopup({ scopes: ['User.Read'], prompt: 'select_account' });
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wrappedJwt: result.idToken }),
  });
  if (!res.ok) {
    setStatus(statusEl(), `Entra session rejected: ${res.status}`);
    return;
  }
  await refreshSession();
  setStatus(statusEl(), `Signed in as ${sessionUser?.email ?? 'Entra user'}`);
}

async function logout(): Promise<void> {
  if (msal) {
    const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
    if (account) {
      await msal.logoutPopup({ account, postLogoutRedirectUri: window.location.origin });
    }
  }
  await fetch('/api/logout', { method: 'POST' });
  sessionUser = null;
  render();
  setStatus(statusEl(), 'Signed out');
}

function accept(incoming: ApprovalRecord): ApprovalRecord {
  const requestId = incoming.id?.requestId ?? crypto.randomUUID();
  const approvalId = incoming.id?.approvalId ?? crypto.randomUUID();
  return {
    ...incoming,
    type: CONTEXT_TYPES.approval,
    id: { requestId, approvalId },
    status: incoming.status ?? 'pending',
    updatedAt: new Date().toISOString(),
  };
}

function holdGetApproval(incoming: ApprovalRecord): Promise<Context | ContextWithMetadata> {
  const record = accept(incoming);
  const id = keyOf(record)!;
  selectedId = id;
  const promise = new Promise<Context | ContextWithMetadata>((resolve, reject) => {
    const held: Held = { record, resolve, reject, settled: false };
    indexHeld(held);
    work = [held, ...work.filter(item => item !== held)];
  });
  render();
  setStatus(statusEl(), `Pending approval ${record.id.approvalId}`);
  return promise;
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

async function approve(id: string): Promise<void> {
  if (!sessionUser) {
    setStatus(statusEl(), 'Sign in with Microsoft before approving.');
    return;
  }
  const held = byId.get(id);
  if (!held || held.settled || !fdc3) return;
  const subject = held.record.subject;
  const context = subject?.context;
  if (!context) {
    held.settled = true;
    held.reject(new Error('Approval has no subject context'));
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
    const target = subject.app?.appId ? { appId: subject.app.appId } : { appId: 'aipa-execution' };
    setStatus(statusEl(), `Submitting ${subject.intent ?? INTENTS.SubmitOrder}…`);
    const resolution = await fdc3.raiseIntent(
      subject.intent ?? INTENTS.SubmitOrder,
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
    held.record.status = 'approved';
    held.record.updatedAt = new Date().toISOString();
    held.settled = true;
    selectedId = keyOf(held.record);
    work = [held, ...work.filter(item => item !== held)];
    render();
    setStatus(statusEl(), 'Approved and submitted');
    if (result && typeof result === 'object' && 'type' in result && resultMetadata) {
      held.resolve({ context: result as Context, metadata: resultMetadata });
    } else if (result && typeof result === 'object' && 'type' in result) {
      held.resolve(result as Context);
    } else {
      held.resolve({ type: 'fdc3.nothing' });
    }
  } catch (error) {
    setStatus(statusEl(), `Approve failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function deny(id: string): void {
  const held = byId.get(id);
  if (!held || held.settled) return;
  held.record.status = 'rejected';
  held.record.updatedAt = new Date().toISOString();
  held.settled = true;
  selectedId = keyOf(held.record);
  work = [held, ...work.filter(item => item !== held)];
  render();
  setStatus(statusEl(), 'Denied');
  held.reject(new Error('Approval rejected'));
}

function clear(id: string): void {
  const held = byId.get(id);
  if (!held || held.record.status === 'pending') return;
  removeHeld(held);
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
  return held.record;
}

async function setup(): Promise<void> {
  const configRes = await fetch('/api/config');
  const entra = (await configRes.json()) as EntraConfig;
  const msalConfig: Configuration = {
    auth: {
      clientId: entra.clientId,
      authority: entra.authority,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
  };
  msal = new PublicClientApplication(msalConfig);
  await msal.initialize();
  const accounts = msal.getAllAccounts();
  if (accounts[0]) msal.setActiveAccount(accounts[0]);

  const session = await connectAppSession(statusEl());
  fdc3 = session.fdc3;
  await refreshSession();

  document.getElementById('login')!.addEventListener('click', () => void login());
  document.getElementById('logout')!.addEventListener('click', () => void logout());

  if (!fdc3) return;

  await fdc3.addIntentListener(INTENTS.GetApproval, async ctx => {
    return holdGetApproval(ctx as ApprovalRecord);
  });
  await fdc3.addIntentListener(INTENTS.UpdateApproval, async ctx => snapshot(ctx as ApprovalRecord));
  await fdc3.addIntentListener(INTENTS.ViewApproval, async ctx => {
    snapshot(ctx as ApprovalRecord);
  });
  await fdc3.addIntentListener(INTENTS.ReviewApproval, async ctx => {
    snapshot(ctx as ApprovalRecord);
  });
  await fdc3.addIntentListener(INTENTS.CancelApproval, async ctx => cancel(ctx as ApprovalRecord));
}

void setup();
