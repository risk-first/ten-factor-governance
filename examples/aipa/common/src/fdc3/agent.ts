import { getAgent, type DesktopAgent } from '@finos/fdc3';
import {
  connectRemoteHandlers,
  type ExchangeDataMessage,
  type FDC3Handlers,
} from '@finos/fdc3-security';

export type AppSession = {
  fdc3: DesktopAgent | null;
  /** Secure-boundary handlers from `@finos/fdc3-security` (requires Desktop Agent). */
  boundary: (FDC3Handlers & { disconnect(): Promise<void> }) | null;
};

function wsUrlForPage(): string {
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
}

export async function connectAgent(statusEl: HTMLElement | null): Promise<DesktopAgent | null> {
  try {
    const fdc3 = await getAgent({ logLevels: { proxy: 'WARN' } });
    statusEl && (statusEl.textContent = 'FDC3 agent connected.');
    return fdc3;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (statusEl) {
      statusEl.textContent = `No Desktop Agent (${msg}). UI works; intents need an FDC3 host.`;
    }
    return null;
  }
}

/**
 * Signing apps: Desktop Agent + `@finos/fdc3-security` `connectRemoteHandlers`.
 *
 * Same flow as encrypted-channel-receiver: agent first, then WebSocket so the
 * browser can call `boundary.exchangeData('sign-context', { context })` while
 * private keys stay in Node. Without an agent, HTTP signed APIs still work.
 */
export async function connectAppSession(
  statusEl: HTMLElement | null,
  onExchange?: (message: ExchangeDataMessage) => Promise<ExchangeDataMessage | void>
): Promise<AppSession> {
  const fdc3 = await connectAgent(statusEl);
  if (!fdc3) {
    return { fdc3: null, boundary: null };
  }

  try {
    statusEl && (statusEl.textContent = 'FDC3 agent connected. Connecting secure backend…');
    const boundary = await connectRemoteHandlers(wsUrlForPage(), fdc3, onExchange ?? (async () => {}));
    statusEl && (statusEl.textContent = 'FDC3 agent + secure backend connected.');
    return { fdc3, boundary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    statusEl && (statusEl.textContent = `FDC3 connected; secure backend unavailable (${msg}).`);
    return { fdc3, boundary: null };
  }
}

export function setStatus(el: HTMLElement | null, msg: string): void {
  if (!el) return;
  el.textContent = msg;
  const summary = el
    .closest('.status-drawer')
    ?.querySelector<HTMLElement>('.status-drawer__summary');
  if (summary) {
    const line = msg.trim().split('\n').filter(Boolean).at(-1) ?? msg;
    summary.textContent = line;
  }
}
