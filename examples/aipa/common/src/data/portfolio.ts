import fs from 'node:fs';
import { fixturePath, livePortfolioPath, LIVE_PORTFOLIO_DIR } from './paths.js';
import type { Fdc3Portfolio } from '../contexts/types.js';

export type FixturePosition = Fdc3Portfolio['positions'][number] & { sector?: string };

export type FixturePortfolio = Omit<Fdc3Portfolio, 'positions'> & {
  positions: FixturePosition[];
};

export type PortfolioFill = {
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  name?: string;
};

export function loadPortfolioFixture(): FixturePortfolio {
  return JSON.parse(fs.readFileSync(fixturePath('portfolio.json'), 'utf-8')) as FixturePortfolio;
}

/** Live book on disk. Seeds from the fixture the first time the file is missing. */
export function loadLivePortfolio(): FixturePortfolio {
  const dest = livePortfolioPath();
  if (!fs.existsSync(dest)) {
    const seeded = loadPortfolioFixture();
    saveLivePortfolio(seeded);
    return seeded;
  }
  return JSON.parse(fs.readFileSync(dest, 'utf-8')) as FixturePortfolio;
}

export function saveLivePortfolio(portfolio: FixturePortfolio): void {
  fs.mkdirSync(LIVE_PORTFOLIO_DIR, { recursive: true });
  fs.writeFileSync(livePortfolioPath(), `${JSON.stringify(portfolio, null, 2)}\n`, 'utf-8');
}

export function fillsFromOrderList(orderList: unknown): PortfolioFill[] {
  const orders = (orderList as { orders?: unknown } | null)?.orders;
  if (!Array.isArray(orders)) return [];
  const fills: PortfolioFill[] = [];
  for (const raw of orders) {
    if (!raw || typeof raw !== 'object') continue;
    const order = raw as {
      instrument?: { name?: string; id?: { ticker?: string } };
      side?: string;
      quantity?: unknown;
    };
    const ticker = order.instrument?.id?.ticker?.trim().toUpperCase();
    const side = order.side === 'buy' || order.side === 'sell' ? order.side : null;
    const quantity = Number(order.quantity);
    if (!ticker || !side || !Number.isFinite(quantity) || quantity <= 0) continue;
    fills.push({
      ticker,
      side,
      quantity,
      name: order.instrument?.name,
    });
  }
  return fills;
}

function tickerOf(pos: FixturePosition): string {
  return pos.instrument.id.ticker.toUpperCase();
}

function impliedPrice(pos: FixturePosition): number {
  if (pos.holding > 0 && typeof pos.weight === 'number' && pos.weight > 0) {
    return pos.weight / pos.holding;
  }
  return 0;
}

function reweight(positions: FixturePosition[], priceByTicker: Map<string, number>): FixturePosition[] {
  const notionals = positions.map(p => {
    const px = priceByTicker.get(tickerOf(p)) ?? 0;
    return px > 0 ? p.holding * px : 0;
  });
  let total = notionals.reduce((s, n) => s + n, 0);
  if (total <= 0) {
    total = positions.reduce((s, p) => s + Math.max(0, p.holding), 0);
    if (total <= 0) return positions.map(p => ({ ...p, weight: 0 }));
    return positions.map(p => ({
      ...p,
      weight: Math.round((Math.max(0, p.holding) / total) * 1e6) / 1e6,
    }));
  }
  return positions.map((p, i) => ({
    ...p,
    weight: Math.round((notionals[i] / total) * 1e6) / 1e6,
  }));
}

export function applyFillsToPortfolio(
  portfolio: FixturePortfolio,
  fills: PortfolioFill[]
): { portfolio: FixturePortfolio; applied: PortfolioFill[] } {
  const positions = portfolio.positions.map(p => ({
    ...p,
    instrument: { ...p.instrument, id: { ...p.instrument.id } },
  }));
  const priceByTicker = new Map(positions.map(p => [tickerOf(p), impliedPrice(p)]));
  const knownPrices = [...priceByTicker.values()].filter(px => px > 0);
  const fallbackPrice =
    knownPrices.length > 0 ? knownPrices.reduce((s, px) => s + px, 0) / knownPrices.length : 0;

  const applied: PortfolioFill[] = [];
  for (const fill of fills) {
    const idx = positions.findIndex(p => tickerOf(p) === fill.ticker);
    if (idx === -1) {
      if (fill.side !== 'buy') continue;
      if (!priceByTicker.has(fill.ticker)) priceByTicker.set(fill.ticker, fallbackPrice);
      positions.push({
        type: 'fdc3.position',
        instrument: {
          type: 'fdc3.instrument',
          name: fill.name ?? fill.ticker,
          id: { ticker: fill.ticker },
        },
        holding: Math.round(fill.quantity),
        weight: 0,
        sector: '—',
      });
      applied.push(fill);
      continue;
    }
    const current = positions[idx];
    const filledQty =
      fill.side === 'buy' ? fill.quantity : Math.min(fill.quantity, current.holding);
    if (filledQty <= 0) continue;
    current.holding = Math.max(
      0,
      Math.round(current.holding + (fill.side === 'buy' ? filledQty : -filledQty))
    );
    applied.push({ ...fill, quantity: filledQty });
    if (current.holding <= 0) positions.splice(idx, 1);
  }

  return {
    applied,
    portfolio: {
      ...portfolio,
      positions: reweight(positions, priceByTicker),
    },
  };
}

export function toFdc3Portfolio(p: FixturePortfolio): Fdc3Portfolio {
  return {
    type: 'fdc3.portfolio',
    id: p.id,
    name: p.name,
    positions: p.positions.map(pos => ({
      type: 'fdc3.position',
      instrument: pos.instrument,
      holding: pos.holding,
      weight: pos.weight,
    })),
  };
}
