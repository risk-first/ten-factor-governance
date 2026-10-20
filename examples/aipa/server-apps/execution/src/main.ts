import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { CONTEXT_TYPES, INTENTS } from '../../../common/src/contexts/types.ts';
import { toResultContext, type SignedEnvelope } from '../../../common/src/security/envelope.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { DesktopAgent } from '@finos/fdc3';

let fdc3: DesktopAgent | null = null;
const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;

async function submit(order?: unknown, meta?: unknown): Promise<Record<string, unknown>> {
  const payload = order ?? {
    type: CONTEXT_TYPES.demoOrder,
    id: { orderId: crypto.randomUUID() },
    instrument: { type: 'fdc3.instrument', id: { ticker: 'SHEL' } },
    side: 'sell',
    quantity: 1000,
    orderType: 'market',
  };
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: payload, __appMeta: meta }),
  });
  const body = (await res.json()) as {
    envelope: SignedEnvelope;
    verify: { ok: boolean; warning?: string };
  };
  const result = toResultContext(body.envelope);
  document.getElementById('result')!.textContent = JSON.stringify(result, null, 2);
  const verifyEl = document.getElementById('verify')!;
  verifyEl.textContent = body.verify.warning ?? 'Inbound signature checked';
  verifyEl.className = body.verify.ok ? 'badge' : 'badge warn';
  setStatus(statusEl(), `Signed ${CONTEXT_TYPES.transactionResult}`);
  return result;
}

async function setup(): Promise<void> {
  const session = await connectAppSession(statusEl());
  fdc3 = session.fdc3;
  if (!fdc3) return;
  await fdc3.addIntentListener(INTENTS.SubmitOrder, async ctx => {
    const withMeta = ctx as { __appMeta?: unknown };
    return submit(ctx, withMeta.__appMeta);
  });
}

document.getElementById('demo-submit')!.addEventListener('click', () => void submit());
void setup();
