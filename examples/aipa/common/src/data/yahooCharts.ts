import fs from 'node:fs';
import { fixturePath } from './paths.js';
import { OHLC_TTL_MS, marketDataCache } from './ttlCache.js';

export type OhlcBar = { date: string; open: number; high: number; low: number; close: number };

type OhlcResult = {
  bars: OhlcBar[];
  source: 'yahoo' | 'fixture';
  days: number;
  name?: string;
};

const DEFAULT_DAYS = 60;
const MAX_DAYS = 730;
const OHLC_PREFIX = 'ohlc:';

function clampDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(15, Math.round(days)));
}

/** YYYY-MM-DD in America/New_York — avoids UTC day-shift on Yahoo session timestamps. */
function sessionDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function fixtureSeries(symbol: string, days: number): OhlcBar[] {
  const quotes = JSON.parse(fs.readFileSync(fixturePath('quotes.json'), 'utf-8')) as Record<
    string,
    { c: number; h: number; l: number; o: number }
  >;
  const q = quotes[symbol.toUpperCase()] ?? { c: 100, h: 101, l: 99, o: 100 };
  const bars: OhlcBar[] = [];
  let price = q.o;
  const n = clampDays(days);
  const start = Date.now() - n * 24 * 60 * 60 * 1000;
  for (let i = 0; i < n; i++) {
    const drift = (Math.sin(i / 3) + (i % 5) * 0.02) * (q.c * 0.005);
    const open = price;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    bars.push({
      date: sessionDate(new Date(start + i * 24 * 60 * 60 * 1000)),
      open,
      high,
      low,
      close,
    });
    price = close;
  }
  return bars;
}

let yahooClient: InstanceType<typeof import('yahoo-finance2').default> | null = null;

async function getYahoo() {
  if (!yahooClient) {
    const YahooFinance = (await import('yahoo-finance2')).default;
    yahooClient = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }
  return yahooClient;
}

function ohlcKey(symbol: string, days: number): string {
  return `${OHLC_PREFIX}${symbol.toUpperCase()}:${days}`;
}

/** Reuse a longer cached series when zooming in (fewer days). */
function sliceFromLongerCache(symbol: string, lookback: number): OhlcResult | undefined {
  const prefix = `${OHLC_PREFIX}${symbol.toUpperCase()}:`;
  let best: OhlcResult | undefined;
  for (const days of [730, 540, 365, 252, 180, 120, 90, 60, 15]) {
    if (days < lookback) continue;
    const hit = marketDataCache.get<OhlcResult>(`${prefix}${days}`);
    if (!hit || hit.bars.length < lookback) continue;
    if (!best || hit.days < best.days) {
      best = hit;
    }
  }
  if (!best) return undefined;
  return {
    bars: best.bars.slice(-lookback),
    source: best.source,
    days: lookback,
    name: best.name,
  };
}

async function fetchDailyOhlc(symbol: string, lookback: number): Promise<OhlcResult> {
  const calendarPad = Math.ceil(lookback * 1.75) + 14;
  const period1 = new Date(Date.now() - calendarPad * 24 * 60 * 60 * 1000);
  const period2 = new Date();
  try {
    const yahooFinance = await getYahoo();
    const result = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: '1d',
    });
    const quotes = result?.quotes ?? [];
    const usable = quotes.filter(
      q => q.date && typeof q.close === 'number' && Number.isFinite(q.close)
    );
    const name =
      result?.meta?.longName?.trim() ||
      result?.meta?.shortName?.trim() ||
      undefined;
    if (usable.length > 0) {
      const bars: OhlcBar[] = usable.slice(-lookback).map(r => ({
        date: sessionDate(new Date(r.date)),
        open: r.open ?? r.close ?? 0,
        high: r.high ?? r.close ?? 0,
        low: r.low ?? r.close ?? 0,
        close: r.close ?? 0,
      }));
      return { bars, source: 'yahoo', days: lookback, name };
    }
  } catch {
    /* fall through */
  }
  return { bars: fixtureSeries(symbol, lookback), source: 'fixture', days: lookback, name: symbol };
}

export async function getDailyOhlc(
  symbol: string,
  days: number = DEFAULT_DAYS
): Promise<OhlcResult> {
  const ticker = symbol.toUpperCase();
  const lookback = clampDays(days);
  const key = ohlcKey(ticker, lookback);

  const exact = marketDataCache.get<OhlcResult>(key);
  if (exact) return exact;

  const fromLonger = sliceFromLongerCache(ticker, lookback);
  if (fromLonger) {
    marketDataCache.set(key, fromLonger, OHLC_TTL_MS);
    return fromLonger;
  }

  return marketDataCache.getOrLoad(key, () => fetchDailyOhlc(ticker, lookback), OHLC_TTL_MS);
}
