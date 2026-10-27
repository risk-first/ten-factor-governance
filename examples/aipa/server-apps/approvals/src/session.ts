import { PublicClientApplication, type Configuration } from '@azure/msal-browser';
import { setStatus } from '../../../common/src/fdc3/agent.ts';

export type SessionUser = { email: string; name: string };

type EntraConfig = {
  clientId: string;
  authority: string;
  redirectUri: string;
};

const SESSION_TICK = 'aipa-approvals-session';

export type SessionHandle = {
  user: SessionUser | null;
  refresh: () => Promise<SessionUser | null>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  render: () => void;
  bind: () => void;
};

function notifyPeers(): void {
  localStorage.setItem(SESSION_TICK, String(Date.now()));
}

export async function mountSession(
  statusEl: () => HTMLElement,
  onChange?: () => void
): Promise<SessionHandle> {
  const configRes = await fetch('/api/config');
  const entra = (await configRes.json()) as EntraConfig;
  const msalConfig: Configuration = {
    auth: {
      clientId: entra.clientId,
      authority: entra.authority,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
  };
  const msal = new PublicClientApplication(msalConfig);
  await msal.initialize();
  await msal.handleRedirectPromise().catch(() => undefined);
  const accounts = msal.getAllAccounts();
  if (accounts[0]) msal.setActiveAccount(accounts[0]);

  const handle: SessionHandle = {
    user: null,
    async refresh() {
      const res = await fetch('/api/session');
      const body = (await res.json()) as { user: SessionUser | null };
      handle.user = body.user;
      handle.render();
      onChange?.();
      return handle.user;
    },
    async login() {
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
      await handle.refresh();
      notifyPeers();
      setStatus(statusEl(), `Signed in as ${handle.user?.email ?? 'Entra user'}`);
    },
    async logout() {
      const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
      if (account) {
        await msal.logoutPopup({ account, postLogoutRedirectUri: window.location.origin });
      }
      await fetch('/api/logout', { method: 'POST' });
      handle.user = null;
      handle.render();
      onChange?.();
      notifyPeers();
      setStatus(statusEl(), 'Signed out');
    },
    render() {
      const session = document.getElementById('session');
      const login = document.getElementById('login') as HTMLButtonElement | null;
      const logout = document.getElementById('logout') as HTMLButtonElement | null;
      if (session) {
        session.textContent = handle.user
          ? `Signed in as ${handle.user.name || handle.user.email}`
          : 'Not signed in';
        session.className = handle.user ? 'badge' : 'badge warn';
      }
      if (login) login.disabled = Boolean(handle.user);
      if (logout) logout.disabled = !handle.user;
    },
    bind() {
      document.getElementById('login')?.addEventListener('click', () => void handle.login());
      document.getElementById('logout')?.addEventListener('click', () => void handle.logout());
      window.addEventListener('storage', event => {
        if (event.key === SESSION_TICK) void handle.refresh();
      });
    },
  };

  await handle.refresh();
  return handle;
}
