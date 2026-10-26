import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { CONTEXT_TYPES, INTENTS } from '../../../common/src/contexts/types.ts';
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
};

type EntraConfig = {
  clientId: string;
  authority: string;
  redirectUri: string;
};

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;
const store = new Map<string, Held>();
let currentId: string | undefined;
let fdc3: DesktopAgent | null = null;
let msal: PublicClientApplication | null = null;
let sessionUser: { email: string; name: string } | null = null;

function keyOf(approval: { id?: { requestId?: string; approvalId?: string } }): string | undefined {
  return approval.id?.approvalId ?? approval.id?.requestId;
}

function findHeld(approval: { id?: { requestId?: string; approvalId?: string } }): Held | undefined {
  const approvalId = approval.id?.approvalId;
  const requestId = approval.id?.requestId;
  if (approvalId && store.has(approvalId)) return store.get(approvalId);
  if (requestId && store.has(requestId)) return store.get(requestId);
  return undefined;
}

function render(): void {
  const session = document.getElementById('session')!;
  const empty = document.getElementById('empty')!;
  const subject = document.getElementById('subject')!;
  const approve = document.getElementById('approve') as HTMLButtonElement;
  const reject = document.getElementById('reject') as HTMLButtonElement;
  session.textContent = sessionUser
    ? `Signed in as ${sessionUser.name || sessionUser.email}`
    : 'Not signed in';
  session.className = sessionUser ? 'badge' : 'badge warn';
  const held = currentId ? store.get(currentId) : undefined;
  if (!held) {
    empty.hidden = false;
    subject.hidden = true;
    approve.disabled = true;
    reject.disabled = true;
    return;
  }
  empty.hidden = true;
  subject.hidden = false;
  subject.textContent = JSON.stringify(held.record, null, 2);
  const pending = held.record.status === 'pending';
  approve.disabled = !pending || !sessionUser;
  reject.disabled = !pending;
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
  currentId = id;
  const promise = new Promise<Context | ContextWithMetadata>((resolve, reject) => {
    store.set(record.id.requestId!, { record, resolve, reject });
    store.set(record.id.approvalId!, { record, resolve, reject });
  });
  render();
  setStatus(statusEl(), `Pending approval ${record.id.approvalId}`);
  return promise;
}

function snapshot(incoming: ApprovalRecord): ApprovalRecord {
  const held = findHeld(incoming);
  if (held) {
    currentId = keyOf(held.record);
    render();
    return held.record;
  }
  return accept({ ...incoming, status: incoming.status ?? 'pending' });
}

async function approve(): Promise<void> {
  if (!sessionUser) {
    setStatus(statusEl(), 'Sign in with Microsoft before approving.');
    return;
  }
  const held = currentId ? store.get(currentId) : undefined;
  if (!held || !fdc3) return;
  const subject = held.record.subject;
  const context = subject?.context;
  if (!context) {
    held.reject(new Error('Approval has no subject context'));
    return;
  }
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
  render();
  setStatus(statusEl(), 'Approved and submitted');
  if (result && typeof result === 'object' && 'type' in result && resultMetadata) {
    held.resolve({ context: result as Context, metadata: resultMetadata });
  } else if (result && typeof result === 'object' && 'type' in result) {
    held.resolve(result as Context);
  } else {
    held.resolve({ type: 'fdc3.nothing' });
  }
}

function reject(): void {
  const held = currentId ? store.get(currentId) : undefined;
  if (!held) return;
  held.record.status = 'rejected';
  held.record.updatedAt = new Date().toISOString();
  render();
  setStatus(statusEl(), 'Rejected');
  held.reject(new Error('Approval rejected'));
}

function cancel(incoming: ApprovalRecord): ApprovalRecord {
  const held = findHeld(incoming);
  if (!held || held.record.status !== 'pending') {
    throw new Error('Approval cannot be cancelled');
  }
  held.record.status = 'cancelled';
  held.record.updatedAt = new Date().toISOString();
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
  document.getElementById('approve')!.addEventListener('click', () => void approve());
  document.getElementById('reject')!.addEventListener('click', () => reject());

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
