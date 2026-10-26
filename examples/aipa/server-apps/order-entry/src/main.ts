import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import {
  INTENTS,
  asOrderOrList,
  ordersFromContext,
  type DemoOrder,
  type DemoOrderOrList,
} from '../../../common/src/contexts/types.ts';
import { toSignedResult, type SignedEnvelope } from '../../../common/src/security/envelope.ts';
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

function toOrders(): DemoOrder[] {
  return blotter
    .filter(r => r.ticker.trim())
    .map(r => ({
      type: 'demo.order' as const,
      id: { orderId: r.id },
      instrument: { type: 'fdc3.instrument' as const, id: { ticker: r.ticker.toUpperCase() } },
      side: r.side,
      quantity: r.qty,
      orderType: 'market' as const,
    }));
}

function addEmptyRow(): void {
  blotter.push({
    id: rowId(),
    side: 'buy',
    ticker: '',
    qty: 100,
    status: 'draft',
  });
  renderBlotter();
  setStatus(statusEl(), 'Added empty order row');
}

function removeRow(id: string): void {
  const next = blotter.filter(r => r.id !== id);
  if (next.length === blotter.length) return;
  blotter = next;
  renderBlotter();
  setStatus(statusEl(), blotter.length ? 'Removed order row' : 'Blotter empty');
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
    });
    qtyTd.appendChild(qtyInput);

    const statusTd = document.createElement('td');
    statusTd.textContent = row.status;

    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions actions--multi';
    const bcast = createBroadcastButton({ title: `Broadcast ${row.ticker || 'instrument'}` });
    bcast.addEventListener('click', () => void broadcastInstrument(row.ticker));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-btn';
    remove.title = 'Remove row';
    remove.setAttribute('aria-label', `Remove ${row.ticker || 'row'}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => removeRow(row.id));
    actionsTd.append(bcast, remove);

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

function showOrders(orders: DemoOrder[]): void {
  for (const order of orders) {
    blotter.push({
      id: order.id?.orderId ?? rowId(),
      side: order.side,
      ticker: order.instrument.id.ticker,
      qty: order.quantity,
      status: 'draft',
    });
  }
  renderBlotter();
}

async function createOrder(incoming?: DemoOrderOrList, meta?: { signature?: unknown }) {
  const res = await fetch('/api/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: incoming, metadata: meta }),
  });
  const body = (await res.json()) as {
    envelope: SignedEnvelope;
    verify: { ok: boolean; warning?: string };
  };
  const signed = toSignedResult(body.envelope);
  const result = signed.context as DemoOrderOrList;
  showOrders(ordersFromContext(result));
  const verifyEl = document.getElementById('verify')!;
  verifyEl.textContent = body.verify.warning ?? 'Inbound signature ok / not required';
  verifyEl.className = body.verify.ok ? 'badge' : 'badge warn';
  setStatus(statusEl(), `Signed ${result.type}`);
  return signed;
}

async function approve(): Promise<void> {
  const orders = toOrders();
  if (orders.length === 0) {
    setStatus(statusEl(), 'No complete orders to approve (need ticker on each row).');
    return;
  }
  blotter = blotter.filter(r => r.ticker.trim()).map(b => ({ ...b, status: 'approved' }));
  renderBlotter();
  const payload = asOrderOrList(orders);
  if (!fdc3) {
    setStatus(statusEl(), 'Approved locally (no agent to raise demo.SubmitOrder).');
    return;
  }
  const resolution = await fdc3.raiseIntent(
    INTENTS.SubmitOrder,
    payload as Parameters<DesktopAgent['raiseIntent']>[1],
    { appId: 'aipa-execution' }
  );
  const result = await resolution.getResult();
  const resultType =
    result && typeof result === 'object' ? (result as { type?: string }).type : undefined;
  setStatus(
    statusEl(),
    resultType
      ? `demo.SubmitOrder → ${resultType}`
      : `Raised demo.SubmitOrder (${payload.type})`
  );
}

async function setup(): Promise<void> {
  syncEmptyState();
  const session = await connectAppSession(statusEl());
  fdc3 = session.fdc3;
  if (!fdc3) return;

  await fdc3.addIntentListener(INTENTS.CreateOrder, async (ctx, metadata) => {
    return createOrder(ctx as DemoOrderOrList, metadata);
  });

  await fdc3.addIntentListener(INTENTS.ViewOrders, async ctx => {
    filterTicker = (ctx as { id?: { ticker?: string } })?.id?.ticker?.toUpperCase();
    renderBlotter();
    setStatus(statusEl(), `ViewOrders ${filterTicker ?? '(all)'}`);
  });
}

document.getElementById('demo-create')!.addEventListener('click', () => void createOrder());
document.getElementById('add-row')!.addEventListener('click', () => addEmptyRow());
document.getElementById('approve')!.addEventListener('click', () => void approve());
void setup();
