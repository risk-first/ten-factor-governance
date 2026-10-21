/**
 * fdc3.data extension wiring for Market Data:
 * advertiseDatasets → appOffer, GetAppData → tabularData, ViewData ← tabularData.
 */
import type { DesktopAgent } from '@finos/fdc3';
import type { Chart } from '@finos/fdc3-context';
import {
  CONTEXT_TYPES,
  INTENTS,
  type AppOffer,
  type Fdc3Instrument,
  type TabularData,
} from '../../../common/src/contexts/types.ts';
import { setStatus } from '../../../common/src/fdc3/agent.ts';

export const MARKET_DATA_APP_ID = 'aipa-market-data';
export const MARKET_DATA_DATA_ID = 'market-data-prices';
export const TABULAR_DATA_SCHEMA_URL =
  'https://fdc3.finos.org/schemas/next/context/data.tabularData.schema.json';

export type PriceBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type PriceSeriesSnapshot = {
  ticker: string;
  name: string;
  instrument: Fdc3Instrument;
  bars: PriceBar[];
};

export function buildTabularData(
  series: PriceSeriesSnapshot[],
  opts?: { instanceId?: string; title?: string }
): TabularData {
  const entries = series.filter(s => s.bars.length > 0);
  const tickers = entries.map(s => s.ticker);
  const columns = ['date', ...tickers];
  const dates = new Set<string>();
  const byTicker = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    const map = new Map<string, number>();
    for (const bar of entry.bars) {
      if (!bar.date || !Number.isFinite(bar.close)) continue;
      map.set(bar.date, bar.close);
      dates.add(bar.date);
    }
    byTicker.set(entry.ticker, map);
  }
  const sortedDates = [...dates].sort();
  const rows: unknown[][] = sortedDates.map(date => [
    date,
    ...tickers.map(t => byTicker.get(t)?.get(date) ?? null),
  ]);

  const tabular: TabularData = {
    type: CONTEXT_TYPES.tabularData,
    title: opts?.title ?? (tickers.length ? `Closing prices · ${tickers.join(', ')}` : 'Closing prices'),
    columns,
    rows,
  };
  if (opts?.instanceId) tabular.instanceId = opts.instanceId;

  if (entries.length > 0 && sortedDates.length > 0) {
    // Wire format is ISO-8601 strings; generated Chart.range types incorrectly use Date.
    tabular.chart = {
      type: 'fdc3.chart',
      instruments: entries.map(e => ({
        type: 'fdc3.instrument' as const,
        id: { ...e.instrument.id },
        ...(e.instrument.name ? { name: e.instrument.name } : {}),
      })),
      range: {
        type: 'fdc3.timeRange',
        startTime: `${sortedDates[0]}T00:00:00.000Z`,
        endTime: `${sortedDates[sortedDates.length - 1]}T23:59:59.000Z`,
      },
      style: 'line',
    } as unknown as Chart;
  }
  return tabular;
}

export function buildAppOffer(opts: {
  appId: string;
  instanceId: string;
  series: PriceSeriesSnapshot[];
}): AppOffer {
  const tickers = opts.series.map(s => s.ticker);
  const name =
    tickers.length === 0
      ? 'Market prices'
      : tickers.length === 1
        ? `${tickers[0]} price`
        : `Closing prices · ${tickers.join(', ')}`;
  return {
    type: CONTEXT_TYPES.appOffer,
    id: { dataId: MARKET_DATA_DATA_ID },
    source: { appId: opts.appId, instanceId: opts.instanceId },
    contextType: CONTEXT_TYPES.tabularData,
    schemaUrl: TABULAR_DATA_SCHEMA_URL,
    displayMetadata: { name },
    metadata: {
      title: name,
      description: 'Daily closing prices for instruments loaded in Market Data',
      subject: 'price;equity;ohlc',
      type: 'Dataset',
      format: 'application/json',
      language: 'en',
      date: new Date().toISOString(),
      ...(tickers.length ? { identifier: tickers.map(t => `ticker:${t}`).join(';') } : {}),
    },
  };
}

/** Parse `fdc3.data.tabularData` into per-ticker close series (OHLC collapsed to close). */
export function parseTabularData(data: TabularData): PriceSeriesSnapshot[] {
  const dateIdx = data.columns.findIndex(c => c.toLowerCase() === 'date');
  if (dateIdx < 0) {
    throw new Error('fdc3.data.tabularData must include a date column');
  }
  const tickerCols = data.columns
    .map((name, index) => ({ name, index }))
    .filter(c => c.index !== dateIdx && c.name.trim());

  const chartInstruments = new Map<string, Fdc3Instrument>();
  for (const inst of data.chart?.instruments ?? []) {
    const ticker = String(inst.id?.ticker ?? '').toUpperCase();
    if (!ticker) continue;
    chartInstruments.set(ticker, {
      type: 'fdc3.instrument',
      id: { ticker, ...(typeof inst.id?.ISIN === 'string' ? { ISIN: inst.id.ISIN } : {}) },
      ...(typeof inst.name === 'string' && inst.name.trim() ? { name: inst.name.trim() } : {}),
    });
  }

  return tickerCols.map(({ name, index }) => {
    const ticker = name.toUpperCase();
    const bars: PriceBar[] = [];
    for (const row of data.rows) {
      const date = String(row[dateIdx] ?? '');
      const close = Number(row[index]);
      if (!date || !Number.isFinite(close)) continue;
      bars.push({ date, open: close, high: close, low: close, close });
    }
    bars.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const instrument =
      chartInstruments.get(ticker) ??
      ({ type: CONTEXT_TYPES.instrument, id: { ticker } } satisfies Fdc3Instrument);
    return {
      ticker,
      name: instrument.name ?? ticker,
      instrument,
      bars,
    };
  });
}

async function resolveAppIdentity(
  fdc3: DesktopAgent
): Promise<{ appId: string; instanceId: string }> {
  try {
    const info = await fdc3.getInfo();
    const meta = info.appMetadata as { appId?: string; instanceId?: string } | undefined;
    return {
      appId: meta?.appId || MARKET_DATA_APP_ID,
      instanceId: meta?.instanceId || `inst-${MARKET_DATA_APP_ID}`,
    };
  } catch {
    return {
      appId: MARKET_DATA_APP_ID,
      instanceId: `inst-${MARKET_DATA_APP_ID}`,
    };
  }
}

async function ensureUserChannel(fdc3: DesktopAgent): Promise<void> {
  try {
    const current = await fdc3.getCurrentChannel();
    if (current) return;
    const channels = await fdc3.getUserChannels();
    if (channels[0]) await fdc3.joinUserChannel(channels[0].id);
  } catch {
    // Host may already place the app on a channel; discovery still works when it does.
  }
}

export type Fdc3DataExtensionOpts = {
  fdc3: DesktopAgent;
  statusEl: HTMLElement | null;
  getSeries: () => PriceSeriesSnapshot[];
  applySeries: (series: PriceSeriesSnapshot[], title?: string) => Promise<void> | void;
};

export async function setupFdc3DataExtension(opts: Fdc3DataExtensionOpts): Promise<{
  appId: string;
  instanceId: string;
  dataId: string;
}> {
  const { fdc3, statusEl } = opts;
  const identity = await resolveAppIdentity(fdc3);
  await ensureUserChannel(fdc3);

  await fdc3.addContextListener(CONTEXT_TYPES.advertiseDatasets, async () => {
    const offer = buildAppOffer({
      ...identity,
      series: opts.getSeries(),
    });
    await fdc3.broadcast(offer as Parameters<DesktopAgent['broadcast']>[0]);
    setStatus(statusEl, `Advertised dataset ${MARKET_DATA_DATA_ID} (${offer.displayMetadata.name})`);
  });

  await fdc3.addIntentListener(INTENTS.GetAppData, async ctx => {
    const dataId =
      ctx && typeof ctx === 'object' && 'id' in ctx
        ? (ctx as { id?: { dataId?: string } }).id?.dataId
        : undefined;
    if (dataId && dataId !== MARKET_DATA_DATA_ID) {
      throw new Error(`Unknown dataId: ${dataId}`);
    }
    const tabular = buildTabularData(opts.getSeries(), {
      instanceId: identity.instanceId,
    });
    setStatus(
      statusEl,
      `GetAppData → tabularData (${tabular.columns.length - 1} series, ${tabular.rows.length} rows)`
    );
    return tabular;
  });

  await fdc3.addIntentListener(INTENTS.ViewData, async ctx => {
    if (!ctx || typeof ctx !== 'object' || (ctx as { type?: string }).type !== CONTEXT_TYPES.tabularData) {
      setStatus(statusEl, 'ViewData ignored — expected fdc3.data.tabularData');
      return;
    }
    const tabular = ctx as TabularData;
    const parsed = parseTabularData(tabular);
    await opts.applySeries(parsed, tabular.title);
    setStatus(
      statusEl,
      `ViewData applied (${parsed.map(s => s.ticker).join(', ') || 'empty'} · ${tabular.rows.length} rows)`
    );
  });

  setStatus(statusEl, `fdc3.data ready (dataId=${MARKET_DATA_DATA_ID})`);
  return { ...identity, dataId: MARKET_DATA_DATA_ID };
}
