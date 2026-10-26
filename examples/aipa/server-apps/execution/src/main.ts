import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { INTENTS, ordersFromContext } from '../../../common/src/contexts/types.ts';
import { toSignedResult, type SignedEnvelope } from '../../../common/src/security/envelope.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';

type LogEntry = {
  id: string;
  number?: number;
  at?: string;
  order: unknown;
  result: unknown;
};

type DetailColumn = 'order' | 'result';

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;
let log: LogEntry[] = [];
let selected: { id: string; column: DetailColumn } | null = null;

function summarizeOrder(ctx: unknown): string {
  const orders = ordersFromContext(ctx);
  if (orders.length === 1) {
    const o = orders[0];
    const ticker = o.instrument?.id?.ticker ?? '';
    return `${o.side} ${o.quantity} ${ticker}`.trim();
  }
  if (orders.length > 1) {
    return `demo.orderList (${orders.length})`;
  }
  const type = ctx && typeof ctx === 'object' ? (ctx as { type?: string }).type : undefined;
  return type || 'order';
}

function summarizeResult(ctx: unknown): string {
  if (!ctx || typeof ctx !== 'object') return 'result';
  const r = ctx as { type?: string; status?: string; message?: string };
  if (r.status && r.type) return `${r.type} · ${r.status}`;
  return r.type || r.message || 'result';
}

function isSuccess(entry: LogEntry): boolean {
  const status =
    entry.result && typeof entry.result === 'object'
      ? (entry.result as { status?: string }).status
      : undefined;
  return status === 'Created' || status === 'Updated' || status === 'Deleted';
}

function orderNumber(entry: LogEntry, newestFirstIndex: number): number {
  if (typeof entry.number === 'number') return entry.number;
  return log.length - newestFirstIndex;
}

function showDetail(entry: LogEntry, column: DetailColumn): void {
  selected = { id: entry.id, column };
  const detail = document.getElementById('detail')!;
  detail.hidden = false;
  detail.textContent = JSON.stringify(column === 'order' ? entry.order : entry.result, null, 2);
  renderLog();
}

function renderLog(): void {
  const tbody = document.getElementById('log')!;
  const empty = document.getElementById('log-empty')!;
  tbody.replaceChildren();
  empty.hidden = log.length > 0;
  log.forEach((entry, index) => {
    const tr = document.createElement('tr');
    if (selected?.id === entry.id) tr.classList.add('selected');

    const numTd = document.createElement('td');
    numTd.className = 'num-col';
    numTd.textContent = String(orderNumber(entry, index));

    const orderTd = document.createElement('td');
    orderTd.className = 'context-cell';
    if (selected?.id === entry.id && selected.column === 'order') orderTd.classList.add('selected');
    const orderBtn = document.createElement('button');
    orderBtn.type = 'button';
    orderBtn.className = 'link-btn';
    orderBtn.textContent = summarizeOrder(entry.order);
    orderBtn.addEventListener('click', () => showDetail(entry, 'order'));
    orderTd.appendChild(orderBtn);

    const outcomeTd = document.createElement('td');
    const ok = isSuccess(entry);
    outcomeTd.className = ok ? 'outcome outcome--ok' : 'outcome outcome--fail';
    outcomeTd.textContent = ok ? 'Success' : 'Failed';

    const resultTd = document.createElement('td');
    resultTd.className = 'context-cell';
    if (selected?.id === entry.id && selected.column === 'result') resultTd.classList.add('selected');
    const resultBtn = document.createElement('button');
    resultBtn.type = 'button';
    resultBtn.className = 'link-btn';
    resultBtn.textContent = summarizeResult(entry.result);
    resultBtn.addEventListener('click', () => showDetail(entry, 'result'));
    resultTd.appendChild(resultBtn);

    tr.append(numTd, orderTd, outcomeTd, resultTd);
    tbody.appendChild(tr);
  });
}

async function loadLog(): Promise<void> {
  const res = await fetch('/api/log');
  const body = (await res.json()) as { entries?: LogEntry[] };
  log = Array.isArray(body.entries) ? body.entries : [];
  renderLog();
}

async function submit(order: unknown, meta?: { signature?: unknown }) {
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order, metadata: meta }),
  });
  const body = (await res.json()) as {
    envelope: SignedEnvelope;
    verify: { ok: boolean; warning?: string };
    entry?: LogEntry;
  };
  const signed = toSignedResult(body.envelope);
  await loadLog();
  const entry = body.entry?.id
    ? log.find(e => e.id === body.entry!.id)
    : log[0];
  if (entry) showDetail(entry, 'result');
  setStatus(statusEl(), body.verify.warning ?? `Logged ${summarizeOrder(order)}`);
  return signed;
}

async function setup(): Promise<void> {
  await loadLog();
  const session = await connectAppSession(statusEl());
  if (!session.fdc3) return;
  await session.fdc3.addIntentListener(INTENTS.SubmitOrder, async (ctx, metadata) => {
    return submit(ctx, metadata);
  });
}

void setup();
