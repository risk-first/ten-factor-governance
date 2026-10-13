import type { Fdc3Instrument, Fdc3Portfolio, OhlcBar, PriceHistory } from '../contexts/types.js';

export const DEFAULT_LOOKBACK_DAYS = 60;
export const MARKET_DATA_ORIGIN = 'http://localhost:4103';

type ChartApiBody = {
  symbol: string;
  quote?: { quote?: { c?: number }; source?: string };
  chart: { bars: OhlcBar[]; source: string; days?: number; name?: string };
};

/** Extract tickers from instrument / instrumentList / portfolio / chart contexts. */
export function tickersFromContext(ctx: unknown): { tickers: string[]; instruments: Map<string, Fdc3Instrument> } {
  const instruments = new Map<string, Fdc3Instrument>();
  const add = (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return;
    const c = raw as { type?: string; name?: string; id?: { ticker?: string; ISIN?: string } };
    const ticker = c.id?.ticker?.trim().toUpperCase();
    if (!ticker) return;
    const instrument: Fdc3Instrument = { type: 'fdc3.instrument', id: { ticker } };
    if (c.id?.ISIN) instrument.id.ISIN = c.id.ISIN;
    if (typeof c.name === 'string' && c.name.trim()) instrument.name = c.name.trim();
    instruments.set(ticker, instrument);
  };

  if (!ctx || typeof ctx !== 'object') return { tickers: [], instruments };
  const c = ctx as {
    type?: string;
    id?: { ticker?: string };
    instruments?: unknown[];
    positions?: Array<{ instrument?: unknown }>;
  };

  if (c.type === 'fdc3.instrument' || c.id?.ticker) add(c);
  if (Array.isArray(c.instruments)) for (const inst of c.instruments) add(inst);
  if (Array.isArray(c.positions)) for (const p of c.positions) add(p.instrument);

  return { tickers: [...instruments.keys()], instruments };
}

/** Lookback days from fdc3.chart.range when present, else default. */
export function lookbackDaysFromContext(ctx: unknown, fallback = DEFAULT_LOOKBACK_DAYS): number {
  if (!ctx || typeof ctx !== 'object') return fallback;
  const range = (ctx as { range?: { startTime?: string; endTime?: string } }).range;
  if (!range?.startTime || !range?.endTime) return fallback;
  const start = Date.parse(range.startTime);
  const end = Date.parse(range.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return fallback;
  const days = Math.round((end - start) / (24 * 60 * 60 * 1000));
  return Math.min(730, Math.max(15, days));
}

export function tickersFromPortfolio(portfolio?: Fdc3Portfolio | null): string[] {
  if (!portfolio?.positions?.length) return [];
  return portfolio.positions
    .map(p => p.instrument.id.ticker?.toUpperCase())
    .filter((t): t is string => Boolean(t));
}

/**
 * Fetch OHLC for each ticker via Market Data `/api/chart/:symbol` and assemble demo.priceHistory.
 * `baseUrl` defaults to same-origin (Market Data app) or pass MARKET_DATA_ORIGIN from Risk.
 */
export async function fetchPriceHistory(
  tickers: string[],
  opts?: {
    days?: number;
    baseUrl?: string;
    instruments?: Map<string, Fdc3Instrument>;
  }
): Promise<PriceHistory> {
  const days = opts?.days ?? DEFAULT_LOOKBACK_DAYS;
  const base = (opts?.baseUrl ?? '').replace(/\/$/, '');
  const unique = [...new Set(tickers.map(t => t.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) {
    return {
      type: 'demo.priceHistory',
      asOf: new Date().toISOString(),
      lookbackDays: days,
      series: [],
    };
  }

  const results = await Promise.all(
    unique.map(async ticker => {
      const url = `${base}/api/chart/${encodeURIComponent(ticker)}?days=${encodeURIComponent(String(days))}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`chart ${ticker}: HTTP ${res.status}`);
      const body = (await res.json()) as ChartApiBody;
      const fromCtx = opts?.instruments?.get(ticker);
      const instrument: Fdc3Instrument = {
        type: 'fdc3.instrument',
        id: { ticker, ...(fromCtx?.id?.ISIN ? { ISIN: fromCtx.id.ISIN } : {}) },
      };
      const name = fromCtx?.name?.trim() || body.chart.name?.trim();
      if (name) instrument.name = name;
      return {
        instrument,
        bars: body.chart.bars ?? [],
        source: body.chart.source ?? 'unknown',
        days: typeof body.chart.days === 'number' ? body.chart.days : days,
      };
    })
  );

  const lookbackDays = results.reduce((m, r) => Math.max(m, r.days), days);
  return {
    type: 'demo.priceHistory',
    asOf: new Date().toISOString(),
    lookbackDays,
    series: results.map(({ instrument, bars, source }) => ({ instrument, bars, source })),
  };
}
