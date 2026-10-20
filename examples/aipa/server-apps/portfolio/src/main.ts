import '../../../common/src/ui/styles.css';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import { CONTEXT_TYPES, INTENTS, type Fdc3Portfolio } from '../../../common/src/contexts/types.ts';
import { createBroadcastButton } from '../../../common/src/ui/broadcast-icon.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { DesktopAgent } from '@finos/fdc3';

type Row = {
  ticker: string;
  name: string;
  holding: number;
  weight: number;
  sector: string;
};

let portfolio: Fdc3Portfolio | null = null;
let rows: Row[] = [];
let selectedTicker: string | null = null;
let fdc3: DesktopAgent | null = null;
let lastSnapshot = '';

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;

async function loadPortfolio(): Promise<void> {
  const res = await fetch('/api/portfolio');
  const body = (await res.json()) as {
    portfolio: Fdc3Portfolio;
    positions: Array<{
      instrument: { name?: string; id: { ticker: string } };
      holding: number;
      weight?: number;
      sector?: string;
    }>;
  };
  const snapshot = JSON.stringify(body.portfolio);
  if (snapshot === lastSnapshot) return;
  lastSnapshot = snapshot;
  portfolio = body.portfolio;
  rows = body.positions.map(p => ({
    ticker: p.instrument.id.ticker,
    name: p.instrument.name ?? p.instrument.id.ticker,
    holding: p.holding,
    weight: p.weight ?? 0,
    sector: p.sector ?? '—',
  }));
  render();
}

async function broadcastInstrument(ticker: string): Promise<void> {
  if (!fdc3 || !portfolio) {
    setStatus(statusEl(), 'No agent — cannot broadcast.');
    return;
  }
  const position = portfolio.positions.find(p => p.instrument.id.ticker === ticker);
  if (!position) return;
  selectedTicker = ticker;
  render();
  await fdc3.broadcast(position.instrument);
  setStatus(statusEl(), `Broadcast fdc3.instrument ${ticker}`);
}

function render(): void {
  const tbody = document.getElementById('holdings')!;
  tbody.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (row.ticker === selectedTicker) tr.classList.add('selected');
    tr.innerHTML = `<td>${row.ticker}</td><td>${row.name}</td><td>${row.holding}</td><td>${(
      row.weight * 100
    ).toFixed(1)}%</td><td>${row.sector}</td><td class="actions"></td>`;
    const actions = tr.querySelector('.actions')!;
    const btn = createBroadcastButton({ title: `Broadcast ${row.ticker}` });
    btn.addEventListener('click', e => {
      e.stopPropagation();
      void broadcastInstrument(row.ticker);
    });
    actions.appendChild(btn);
    tr.addEventListener('click', () => {
      selectedTicker = row.ticker;
      render();
    });
    tbody.appendChild(tr);
  }
}

async function broadcastPortfolio(): Promise<void> {
  if (!fdc3 || !portfolio) {
    setStatus(statusEl(), 'No agent or portfolio loaded.');
    return;
  }
  await fdc3.broadcast(portfolio);
  setStatus(statusEl(), `Broadcast ${CONTEXT_TYPES.portfolio} (${portfolio.id?.portfolioId})`);
}

async function setupIntents(): Promise<void> {
  if (!fdc3) return;
  await fdc3.addIntentListener(INTENTS.GetPortfolio, async () => {
    await loadPortfolio();
    setStatus(statusEl(), 'Handled GetPortfolio');
    return portfolio!;
  });
  await fdc3.addIntentListener(INTENTS.ViewHoldings, async ctx => {
    const ticker =
      ctx && typeof ctx === 'object' && 'id' in ctx
        ? String((ctx as { id?: { ticker?: string } }).id?.ticker ?? '')
        : '';
    if (ticker) {
      selectedTicker = ticker.toUpperCase();
      render();
      setStatus(statusEl(), `ViewHoldings focused ${selectedTicker}`);
    }
  });
}

async function main(): Promise<void> {
  await loadPortfolio();
  window.setInterval(() => void loadPortfolio(), 3000);
  fdc3 = await connectAgent(statusEl());
  await setupIntents();
  document
    .getElementById('broadcast-portfolio')!
    .addEventListener('click', () => void broadcastPortfolio());
}

void main();
