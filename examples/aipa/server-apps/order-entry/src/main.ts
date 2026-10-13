import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { CONTEXT_TYPES, INTENTS, type OrderProposal, type PortfolioRecommendation } from '../../../common/src/contexts/types.ts';
import { toResultContext, type SignedEnvelope } from '../../../common/src/security/envelope.ts';
import { createBroadcastButton } from '../../../common/src/ui/broadcast-icon.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { DesktopAgent } from '@finos/fdc3';

type BlotterRow = {
  id: string;
  side: 'buy' | 'sell';
  ticker: string;
  qty: number;
  status: string;
};

let fdc3: DesktopAgent | null = null;
let currentProposal: OrderProposal | null = null;
let blotter: BlotterRow[] = [];
let filterTicker: string | undefined;

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;

function rowId(): string {
  return crypto.randomUUID();
}

function syncEmptyState(): void {
  const empty = document.getElementById('blotter-empty');
  if (empty) empty.hidden = blotter.length > 0;
}

function syncProposalFromBlotter(): void {
  if (!currentProposal) return;
  currentProposal = {
    ...currentProposal,
    orders: blotter.map(r => ({
      instrument: { type: 'fdc3.instrument' as const, id: { ticker: r.ticker.toUpperCase() } },
      side: r.side,
      quantity: r.qty,
      orderType: 'market' as const,
    })),
  };
}

function renderBlotter(): void {
  const tbody = document.getElementById('blotter')!;
  tbody.replaceChildren();
  for (const row of blotter) {
    if (filterTicker && row.ticker.toUpperCase() !== filterTicker) continue;
    const tr = document.createElement('tr');
    tr.dataset.id = row.id;

    const sideTd = document.createElement('td');
    const sideSel = document.createElement('select');
    sideSel.setAttribute('aria-label', 'Side');
    for (const s of ['buy', 'sell'] as const) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (row.side === s) opt.selected = true;
      sideSel.appendChild(opt);
    }
    sideSel.addEventListener('change', () => {
      row.side = sideSel.value as 'buy' | 'sell';
      syncProposalFromBlotter();
    });
    sideTd.appendChild(sideSel);

    const tickerTd = document.createElement('td');
    const tickerInput = document.createElement('input');
    tickerInput.type = 'text';
    tickerInput.value = row.ticker;
    tickerInput.setAttribute('aria-label', 'Ticker');
    tickerInput.size = 6;
    tickerInput.addEventListener('change', () => {
      row.ticker = tickerInput.value.trim().toUpperCase() || row.ticker;
      tickerInput.value = row.ticker;
      syncProposalFromBlotter();
    });
    tickerTd.appendChild(tickerInput);

    const qtyTd = document.createElement('td');
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.step = '1';
    qtyInput.value = String(row.qty);
    qtyInput.setAttribute('aria-label', 'Quantity');
    qtyInput.style.width = '6rem';
    qtyInput.addEventListener('change', () => {
      const n = Number(qtyInput.value);
      row.qty = Number.isFinite(n) && n > 0 ? Math.round(n) : row.qty;
      qtyInput.value = String(row.qty);
      syncProposalFromBlotter();
    });
    qtyTd.appendChild(qtyInput);

    const statusTd = document.createElement('td');
    statusTd.textContent = row.status;

    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions';
    const bcast = createBroadcastButton({ title: `Broadcast ${row.ticker}` });
    bcast.addEventListener('click', () => void broadcastInstrument(row.ticker));
    actionsTd.appendChild(bcast);

    tr.append(sideTd, tickerTd, qtyTd, statusTd, actionsTd);
    tbody.appendChild(tr);
  }
  syncEmptyState();
}

async function broadcastInstrument(ticker: string): Promise<void> {
  const t = ticker.trim().toUpperCase();
  if (!t) return;
  if (!fdc3) {
    setStatus(statusEl(), 'No agent — cannot broadcast.');
    return;
  }
  await fdc3.broadcast({ type: 'fdc3.instrument', id: { ticker: t } });
  setStatus(statusEl(), `Broadcast fdc3.instrument ${t}`);
}

function showProposal(p: OrderProposal): void {
  currentProposal = p;
  blotter = p.orders.map(o => ({
    id: rowId(),
    side: o.side,
    ticker: o.instrument.id.ticker,
    qty: o.quantity,
    status: 'draft',
  }));
  renderBlotter();
}

async function createProposal(
  recommendation?: PortfolioRecommendation,
  meta?: unknown
): Promise<Record<string, unknown>> {
  const res = await fetch('/api/propose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recommendation, __appMeta: meta }),
  });
  const body = (await res.json()) as {
    envelope: SignedEnvelope;
    verify: { ok: boolean; warning?: string };
  };
  const result = toResultContext(body.envelope) as OrderProposal;
  showProposal(result);
  const verifyEl = document.getElementById('verify')!;
  verifyEl.textContent = body.verify.warning ?? 'Inbound signature ok / not required';
  verifyEl.className = body.verify.ok ? 'badge' : 'badge warn';
  setStatus(statusEl(), `Signed ${CONTEXT_TYPES.orderProposal}`);
  return result as unknown as Record<string, unknown>;
}

async function approve(): Promise<void> {
  if (!currentProposal || blotter.length === 0) {
    setStatus(statusEl(), 'No proposal to approve.');
    return;
  }
  syncProposalFromBlotter();
  blotter = blotter.map(b => ({ ...b, status: 'approved' }));
  renderBlotter();
  const orderList = {
    type: CONTEXT_TYPES.orderList,
    orders: blotter.map(r => ({
      type: CONTEXT_TYPES.order,
      instrument: { type: 'fdc3.instrument', id: { ticker: r.ticker } },
      side: r.side,
      quantity: r.qty,
    })),
  };
  if (fdc3) {
    await fdc3.broadcast(orderList);
    setStatus(statusEl(), 'Broadcast fdc3.orderList');
  } else {
    setStatus(statusEl(), 'Approved locally (no agent to broadcast).');
  }
}

async function setup(): Promise<void> {
  syncEmptyState();
  const session = await connectAppSession(statusEl());
  fdc3 = session.fdc3;
  if (!fdc3) return;

  await fdc3.addIntentListener(INTENTS.CreateOrderProposal, async ctx => {
    const rec = ctx as PortfolioRecommendation & { __appMeta?: unknown };
    return createProposal(rec, rec.__appMeta);
  });

  await fdc3.addIntentListener(INTENTS.ViewOrders, async ctx => {
    filterTicker = (ctx as { id?: { ticker?: string } })?.id?.ticker?.toUpperCase();
    renderBlotter();
    setStatus(statusEl(), `ViewOrders ${filterTicker ?? '(all)'}`);
  });
}

document.getElementById('demo-propose')!.addEventListener('click', () => void createProposal());
document.getElementById('approve')!.addEventListener('click', () => void approve());
void setup();
