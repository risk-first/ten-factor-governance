import '../../../common/src/ui/styles.css';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import { INTENTS, type Fdc3Instrument, type PriceHistory } from '../../../common/src/contexts/types.ts';
import {
  DEFAULT_LOOKBACK_DAYS,
  fetchPriceHistory,
  lookbackDaysFromContext,
  tickersFromContext,
} from '../../../common/src/data/priceHistory.ts';
import { createBroadcastButton } from '../../../common/src/ui/broadcast-icon.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { DesktopAgent } from '@finos/fdc3';
import {
  setupFdc3DataExtension,
  type PriceSeriesSnapshot,
} from './fdc3Data.ts';
import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  themeQuartz,
  type ColDef,
  type GridApi,
  type ValueFormatterParams,
} from 'ag-grid-community';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type AreaData,
  type LineData,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';

ModuleRegistry.registerModules([AllCommunityModule]);

const LOOKBACK_STEPS = [60, 90, 120, 180, 252, 365, 540, 730];
const COLORS = [
  '#175cd3',
  '#12b76a',
  '#f04438',
  '#7a5af8',
  '#f79009',
  '#0e9384',
  '#ee46bc',
  '#e04f16',
  '#2e90fa',
  '#16b364',
  '#875bf7',
  '#ef6820',
];
const MUTED_COLOR = '#98a2b3';

type Bar = { date: string; open: number; high: number; low: number; close: number };

/** Preserved fdc3.instrument for faithful re-broadcast. */
type InstrumentContext = {
  type: 'fdc3.instrument';
  name?: string;
  id: { ticker: string; [key: string]: string | undefined };
};

type TickerSeries = {
  ticker: string;
  name: string;
  /** Original/merged FDC3 instrument — broadcast this, not a rebuilt stub. */
  instrument: InstrumentContext;
  color: string;
  muted: boolean;
  bars: Bar[];
  quote: number;
  quoteSource: string;
  chartSource: string;
  lineSeries: ISeriesApi<'Line'> | null;
};

function asInstrumentContext(ctx: unknown, fallbackTicker: string): InstrumentContext | null {
  if (!ctx || typeof ctx !== 'object') return null;
  const c = ctx as {
    type?: string;
    name?: string;
    id?: Record<string, string | undefined>;
  };
  const ticker = (c.id?.ticker ?? fallbackTicker).toUpperCase();
  if (!ticker) return null;
  const id: InstrumentContext['id'] = { ...(c.id ?? {}), ticker };
  const instrument: InstrumentContext = { type: 'fdc3.instrument', id };
  if (typeof c.name === 'string' && c.name.trim()) instrument.name = c.name.trim();
  return instrument;
}

function mergeInstrument(
  existing: InstrumentContext | undefined,
  incoming: InstrumentContext | null | undefined,
  yahooName: string | undefined,
  ticker: string
): InstrumentContext {
  const id: InstrumentContext['id'] = {
    ...(existing?.id ?? {}),
    ...(incoming?.id ?? {}),
    ticker,
  };
  // Prefer FDC3-provided name (incoming, then already stored) over Yahoo chart meta.
  const name =
    incoming?.name?.trim() ||
    existing?.name?.trim() ||
    yahooName?.trim() ||
    undefined;
  const instrument: InstrumentContext = { type: 'fdc3.instrument', id };
  if (name) instrument.name = name;
  return instrument;
}

let fdc3: DesktopAgent | null = null;
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<'Candlestick'> | null = null;
let areaSeries: ISeriesApi<'Area'> | null = null;
let gridApi: GridApi | null = null;
let mode: 'candles' | 'area' = 'candles';
let viewMode: 'chart' | 'table' = 'chart';
let magnetOn = false;
let changeOn = false;
/** When set, % change is rebased to this session date (chart click). */
let changeBaselineDate: string | null = null;
/** Preserve zoom after click / rebase instead of fitContent. */
let pendingVisibleRange: { from: number; to: number } | null = null;
let activeTicker = 'SHEL';
let lookbackDays = 60;
let loading = false;
const seriesByTicker = new Map<string, TickerSeries>();

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function nextColor(): string {
  const used = new Set([...seriesByTicker.values()].map(e => e.color));
  const free = COLORS.find(c => !used.has(c));
  if (free) return free;
  for (let i = 0; i < 72; i++) {
    const candidate = hslToHex((i * 47) % 360, 68, 46);
    if (!used.has(candidate) && candidate !== MUTED_COLOR) return candidate;
  }
  return COLORS[0]!;
}

function displayColor(entry: TickerSeries): string {
  return entry.muted ? MUTED_COLOR : entry.color;
}

function resizeChart(host: HTMLElement): void {
  if (!chart) return;
  chart.applyOptions({
    width: host.clientWidth || 680,
    height: host.clientHeight || 360,
  });
}

function ensureChart(): IChartApi {
  if (chart) return chart;

  const host = document.getElementById('chart')!;
  chart = createChart(host, {
    width: host.clientWidth || 680,
    height: host.clientHeight || 360,
    layout: {
      background: { type: ColorType.Solid, color: '#ffffff' },
      textColor: '#344054',
    },
    grid: {
      vertLines: { color: '#f2f4f7' },
      horzLines: { color: '#f2f4f7' },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#e4e7ec' },
    leftPriceScale: { visible: false, borderColor: '#e4e7ec' },
    timeScale: {
      borderColor: '#e4e7ec',
      timeVisible: false,
      // Keep scroll/pinch zoom inside loaded bars (no empty gutters).
      fixLeftEdge: true,
      fixRightEdge: true,
      lockVisibleTimeRangeOnResize: true,
    },
  });

  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#12b76a',
    downColor: '#f04438',
    borderVisible: false,
    wickUpColor: '#12b76a',
    wickDownColor: '#f04438',
  });
  areaSeries = chart.addSeries(AreaSeries, {
    lineColor: '#175cd3',
    topColor: 'rgba(23, 92, 211, 0.28)',
    bottomColor: 'rgba(23, 92, 211, 0.02)',
    visible: false,
  });

  chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    void onVisibleRangeChange(range);
  });
  chart.subscribeClick(param => {
    onChartClick(param);
  });

  // At full extent, wheel-zoom-out should fetch more history rather than empty gutters.
  host.addEventListener(
    'wheel',
    e => {
      if (!chart || loading || e.deltaY <= 0) return;
      const range = chart.timeScale().getVisibleLogicalRange();
      const n = currentBarCount();
      if (!range || n < 2) return;
      const fullyZoomedOut = range.from <= 0.75 && range.to >= n - 1.75;
      if (!fullyZoomedOut) return;
      if (nextLookback(lookbackDays, 1) === lookbackDays) return;
      e.preventDefault();
      void zoomOutFetchMore();
    },
    { passive: false }
  );

  const ro = new ResizeObserver(() => resizeChart(host));
  ro.observe(host);
  window.addEventListener('resize', () => resizeChart(host));
  requestAnimationFrame(() => resizeChart(host));

  return chart;
}

function currentBarCount(): number {
  let n = 0;
  for (const entry of seriesByTicker.values()) {
    n = Math.max(n, entry.bars.length);
  }
  return n;
}

let rangeClampToken = 0;

async function onVisibleRangeChange(
  range: { from: number; to: number } | null
): Promise<void> {
  if (!chart || !range || loading) return;
  const n = currentBarCount();
  if (n < 2) return;

  const last = n - 1;
  // Wheel-zoom / pan past the first bar → load more history (same as Zoom out).
  if (range.from < -0.5 && nextLookback(lookbackDays, 1) > lookbackDays) {
    await zoomOutFetchMore();
    return;
  }

  // Otherwise clamp so the viewport never sits on empty logical indexes.
  const from = Math.max(0, Math.min(range.from, last - 1));
  const to = Math.max(from + 1, Math.min(range.to, last));
  if (Math.abs(from - range.from) > 0.02 || Math.abs(to - range.to) > 0.02) {
    const token = ++rangeClampToken;
    requestAnimationFrame(() => {
      if (token !== rangeClampToken || !chart) return;
      void chart.timeScale().setVisibleLogicalRange({ from, to });
    });
  }
}

function toCandleData(bars: Bar[]): CandlestickData<Time>[] {
  return bars
    .filter(b => b.date && Number.isFinite(b.close))
    .map(b => ({
      time: b.date as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
}

function toAreaData(bars: Bar[]): AreaData<Time>[] {
  return bars
    .filter(b => b.date && Number.isFinite(b.close))
    .map(b => ({ time: b.date as Time, value: b.close }));
}

function toCloseLine(bars: Bar[]): LineData<Time>[] {
  return bars
    .filter(b => b.date && Number.isFinite(b.close))
    .map(b => ({ time: b.date as Time, value: b.close }));
}

function resolveBaselineClose(bars: Bar[]): number | undefined {
  const usable = bars.filter(b => b.date && Number.isFinite(b.close));
  if (usable.length === 0) return undefined;
  if (changeBaselineDate) {
    const exact = usable.find(b => b.date === changeBaselineDate);
    if (exact) return exact.close;
    // Nearest session on/after the click date if this ticker missed that day.
    const after = usable.find(b => b.date >= changeBaselineDate!);
    if (after) return after.close;
  }
  return usable[0]!.close;
}

function toChangeLine(bars: Bar[]): LineData<Time>[] {
  const usable = bars.filter(b => b.date && Number.isFinite(b.close));
  const base = resolveBaselineClose(bars);
  if (!base) return [];
  return usable.map(b => ({
    time: b.date as Time,
    value: ((b.close / base) - 1) * 100,
  }));
}

function latestBarDate(): string | null {
  let latest: string | null = null;
  for (const entry of seriesByTicker.values()) {
    const d = entry.bars.at(-1)?.date;
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
}

function applyPendingOrFit(): void {
  if (!chart) return;
  if (pendingVisibleRange) {
    const range = pendingVisibleRange;
    pendingVisibleRange = null;
    requestAnimationFrame(() => {
      void chart?.timeScale().setVisibleLogicalRange(range);
    });
    return;
  }
  chart.timeScale().fitContent();
}

function onChartClick(param: MouseEventParams<Time>): void {
  if (!chart || viewMode !== 'chart' || loading) return;
  if (param.time == null) return;

  const fromIdx = chart.timeScale().timeToIndex(param.time, true);
  const endDate = latestBarDate();
  if (fromIdx == null || fromIdx < 0 || !endDate) return;
  const toIdx = chart.timeScale().timeToIndex(endDate as Time, true);
  if (toIdx == null || toIdx <= fromIdx) return;

  const clickDate = String(param.time);
  pendingVisibleRange = { from: fromIdx, to: toIdx };

  if (changeOn) {
    changeBaselineDate = clickDate;
    redrawAll();
    setStatus(statusEl(), `Rebased to ${clickDate} → today (${endDate})`);
  } else {
    applyPendingOrFit();
    setStatus(statusEl(), `Zoom ${clickDate} → today (${endDate})`);
  }
}

function priceFormatter(value: number): string {
  if (changeOn) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
  return value.toFixed(2);
}

function applyViewMode(): void {
  const chartEl = document.getElementById('chart')!;
  const tableEl = document.getElementById('table-view')!;
  const isChart = viewMode === 'chart';
  chartEl.hidden = !isChart;
  tableEl.hidden = isChart;
  rebuildControls();
  if (isChart) {
    requestAnimationFrame(() => resizeChart(chartEl));
  } else {
    renderTable();
  }
}

function formatPx(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '—';
}

function formatChg(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function pxFormatter(p: ValueFormatterParams): string {
  return formatPx(p.value as number | null | undefined);
}

function chgFormatter(p: ValueFormatterParams): string {
  return formatChg(p.value as number | null | undefined);
}

function chgCellClass(p: { value?: number | null }): string | string[] | undefined {
  const v = p.value;
  if (typeof v !== 'number' || !Number.isFinite(v) || v === 0) return undefined;
  return v > 0 ? 'chg-pos' : 'chg-neg';
}

function ensureGrid(): GridApi {
  if (gridApi) return gridApi;
  const host = document.getElementById('bars-grid')!;
  gridApi = createGrid(host, {
    theme: themeQuartz,
    columnDefs: [],
    rowData: [],
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 96,
      filterParams: { buttons: ['reset', 'apply'], closeOnApply: true },
    },
    animateRows: false,
    suppressCellFocus: true,
    getRowId: p => {
      const d = (p.data as { date?: Date | string }).date;
      if (d instanceof Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return String(d ?? '');
    },
  });
  return gridApi;
}

function renderTable(): void {
  const api = ensureGrid();
  const entries = [...seriesByTicker.values()].filter(e => !e.muted);

  /** Parse YYYY-MM-DD as local midnight for agDateColumnFilter. */
  const parseSessionDate = (iso: string): Date => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1);
  };

  const formatSessionDate = (value: unknown): string => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '—';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  if (entries.length === 0) {
    api.setGridOption('columnDefs', [
      {
        field: 'date',
        headerName: 'Date',
        filter: 'agDateColumnFilter',
        valueFormatter: p => formatSessionDate(p.value),
      },
    ]);
    api.setGridOption('rowData', []);
    return;
  }

  const byTicker = new Map<string, Map<string, Bar>>();
  const bases = new Map<string, number>();
  const dates = new Set<string>();
  for (const entry of entries) {
    const map = new Map<string, Bar>();
    for (const bar of entry.bars) {
      if (!bar.date) continue;
      map.set(bar.date, bar);
      dates.add(bar.date);
    }
    byTicker.set(entry.ticker, map);
    const base = resolveBaselineClose(entry.bars);
    if (base != null) bases.set(entry.ticker, base);
  }

  const sortedDates = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const single = entries.length === 1;

  const columnDefs: ColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      filter: 'agDateColumnFilter',
      minWidth: 140,
      pinned: 'left',
      flex: 0,
      valueFormatter: p => formatSessionDate(p.value),
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true,
        browserDatePicker: true,
        // Equals / Before / After / In range (from–to).
        filterOptions: [
          'equals',
          'notEqual',
          'lessThan',
          'greaterThan',
          'inRange',
          'blank',
          'notBlank',
        ],
        defaultOption: 'inRange',
        maxNumConditions: 1,
        comparator: (filterLocalDateAtMidnight: Date, cellValue: Date) => {
          if (!(cellValue instanceof Date)) return -1;
          const cell = new Date(
            cellValue.getFullYear(),
            cellValue.getMonth(),
            cellValue.getDate()
          ).getTime();
          const filter = filterLocalDateAtMidnight.getTime();
          if (cell < filter) return -1;
          if (cell > filter) return 1;
          return 0;
        },
      },
    },
  ];

  if (single) {
    const ticker = entries[0]!.ticker;
    for (const field of ['open', 'high', 'low', 'close'] as const) {
      columnDefs.push({
        field,
        headerName: field[0]!.toUpperCase() + field.slice(1),
        type: 'numericColumn',
        filter: 'agNumberColumnFilter',
        valueFormatter: pxFormatter,
      });
    }
    if (changeOn) {
      columnDefs.push({
        field: 'change',
        headerName: `${ticker} %`,
        type: 'numericColumn',
        filter: 'agNumberColumnFilter',
        valueFormatter: chgFormatter,
        cellClass: chgCellClass,
      });
    }
  } else {
    for (const entry of entries) {
      const field = changeOn ? `chg_${entry.ticker}` : `px_${entry.ticker}`;
      columnDefs.push({
        field,
        headerName: changeOn ? `${entry.ticker} %` : entry.ticker,
        headerStyle: { color: entry.color },
        type: 'numericColumn',
        filter: 'agNumberColumnFilter',
        valueFormatter: changeOn ? chgFormatter : pxFormatter,
        cellClass: changeOn ? chgCellClass : undefined,
      });
    }
  }

  const rowData: Record<string, string | number | Date | null>[] = sortedDates.map(date => {
    const row: Record<string, string | number | Date | null> = {
      date: parseSessionDate(date),
    };
    if (single) {
      const entry = entries[0]!;
      const bar = byTicker.get(entry.ticker)?.get(date);
      row.open = bar?.open ?? null;
      row.high = bar?.high ?? null;
      row.low = bar?.low ?? null;
      row.close = bar?.close ?? null;
      if (changeOn) {
        const base = bases.get(entry.ticker);
        row.change = bar && base ? ((bar.close / base) - 1) * 100 : null;
      }
    } else {
      for (const entry of entries) {
        const bar = byTicker.get(entry.ticker)?.get(date);
        if (changeOn) {
          const base = bases.get(entry.ticker);
          row[`chg_${entry.ticker}`] = bar && base ? ((bar.close / base) - 1) * 100 : null;
        } else {
          row[`px_${entry.ticker}`] = bar?.close ?? null;
        }
      }
    }
    return row;
  });

  api.setGridOption('columnDefs', columnDefs);
  api.setGridOption('rowData', rowData);
  requestAnimationFrame(() => api.sizeColumnsToFit());
}

function updateMeta(): void {
  const entry = seriesByTicker.get(activeTicker) ?? [...seriesByTicker.values()][0];
  const input = document.getElementById('ticker') as HTMLInputElement;
  if (entry) input.value = entry.ticker;
}

function renderChips(): void {
  const host = document.getElementById('ticker-chips')!;
  host.replaceChildren();
  for (const entry of seriesByTicker.values()) {
    const chip = document.createElement('div');
    chip.className = 'ticker-chip';
    chip.style.color = displayColor(entry);
    chip.dataset.active = entry.ticker === activeTicker ? 'true' : 'false';
    chip.dataset.muted = entry.muted ? 'true' : 'false';

    const focus = document.createElement('button');
    focus.type = 'button';
    focus.className = 'ticker-chip__focus';
    focus.title = entry.muted ? `Show ${entry.ticker}` : `Mute ${entry.ticker}`;
    focus.setAttribute('aria-pressed', entry.muted ? 'true' : 'false');
    focus.addEventListener('click', () => {
      entry.muted = !entry.muted;
      activeTicker = entry.ticker;
      updateMeta();
      renderChips();
      redrawAll();
    });

    const swatch = document.createElement('span');
    swatch.className = 'ticker-chip__swatch';
    focus.appendChild(swatch);

    const label = document.createElement('span');
    label.textContent = entry.ticker;
    focus.appendChild(label);
    if (entry.name && entry.name !== entry.ticker) {
      const nameEl = document.createElement('span');
      nameEl.className = 'ticker-chip__name';
      nameEl.textContent = entry.name;
      focus.appendChild(nameEl);
    }
    chip.title = entry.name ? `${entry.ticker} — ${entry.name}` : entry.ticker;
    chip.appendChild(focus);

    const bcast = createBroadcastButton({
      title: `Broadcast ${entry.name || entry.ticker}`,
      className: 'ticker-chip__broadcast',
    });
    bcast.addEventListener('click', ev => {
      ev.stopPropagation();
      void broadcastTicker(entry.ticker);
    });
    chip.appendChild(bcast);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ticker-chip__remove';
    remove.setAttribute('aria-label', `Remove ${entry.ticker}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      void removeTicker(entry.ticker);
    });
    chip.appendChild(remove);

    host.appendChild(chip);
  }
}

function ensureOverlaySeries(entry: TickerSeries): ISeriesApi<'Line'> {
  ensureChart();
  if (entry.lineSeries) return entry.lineSeries;
  entry.lineSeries = chart!.addSeries(LineSeries, {
    color: entry.color,
    lineWidth: 2,
    priceScaleId: 'right',
  });
  return entry.lineSeries;
}

function clearPrimarySeries(): void {
  candleSeries?.setData([]);
  areaSeries?.setData([]);
  candleSeries?.applyOptions({ visible: false });
  areaSeries?.applyOptions({ visible: false });
}

function redrawAll(): void {
  ensureChart();
  const entries = [...seriesByTicker.values()];
  const multi = entries.length > 1;
  // % change (and multi-ticker) always uses line overlays for a fair comparison.
  const useLines = multi || changeOn;

  chart!.applyOptions({
    leftPriceScale: { visible: false },
    rightPriceScale: { borderColor: '#e4e7ec' },
    localization: { priceFormatter },
    crosshair: { mode: magnetOn ? CrosshairMode.Magnet : CrosshairMode.Normal },
  });

  if (entries.length === 0) {
    clearPrimarySeries();
    applyPendingOrFit();
    applyViewMode();
    return;
  }

  if (useLines) {
    clearPrimarySeries();
    for (const entry of entries) {
      const line = ensureOverlaySeries(entry);
      const color = displayColor(entry);
      line.applyOptions({
        color,
        lineWidth: entry.muted ? 1 : 2,
        visible: true,
        priceScaleId: 'right',
        title: entry.name || entry.ticker,
        priceFormat: {
          type: 'custom',
          formatter: priceFormatter,
          minMove: changeOn ? 0.01 : 0.01,
        },
      });
      line.setData(changeOn ? toChangeLine(entry.bars) : toCloseLine(entry.bars));
    }
  } else {
    const only = entries[0]!;
    if (only.lineSeries) {
      chart!.removeSeries(only.lineSeries);
      only.lineSeries = null;
    }
    const color = displayColor(only);
    if (only.muted) {
      candleSeries!.applyOptions({ visible: false });
      areaSeries!.applyOptions({
        lineColor: color,
        topColor: hexAlpha(color, 0.2),
        bottomColor: hexAlpha(color, 0.02),
        visible: true,
        priceFormat: { type: 'custom', formatter: priceFormatter, minMove: 0.01 },
      });
      areaSeries!.setData(toAreaData(only.bars));
      candleSeries!.setData([]);
    } else {
      areaSeries!.applyOptions({
        lineColor: color,
        topColor: hexAlpha(color, 0.28),
        bottomColor: hexAlpha(color, 0.02),
        visible: mode === 'area',
        priceFormat: { type: 'custom', formatter: priceFormatter, minMove: 0.01 },
      });
      candleSeries!.applyOptions({
        visible: mode === 'candles',
        priceFormat: { type: 'custom', formatter: priceFormatter, minMove: 0.01 },
      });
      candleSeries!.setData(toCandleData(only.bars));
      areaSeries!.setData(toAreaData(only.bars));
    }
  }

  if (viewMode === 'chart') {
    applyPendingOrFit();
  }
  applyViewMode();
}

function hexAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(23, 92, 211, ${alpha})`;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function nextLookback(current: number, direction: 1 | -1): number {
  if (direction > 0) {
    const larger = LOOKBACK_STEPS.find(d => d > current);
    return larger ?? LOOKBACK_STEPS[LOOKBACK_STEPS.length - 1]!;
  }
  const smaller = [...LOOKBACK_STEPS].reverse().find(d => d < current);
  return smaller ?? LOOKBACK_STEPS[0]!;
}

function rebuildControls(): void {
  const host = document.getElementById('chart-controls')!;
  host.replaceChildren();

  const multi = seriesByTicker.size > 1;
  const single = seriesByTicker.size === 1;

  const mk = (label: string, onClick: () => void, attrs?: Record<string, string>) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
    }
    b.addEventListener('click', onClick);
    host.appendChild(b);
    return b;
  };

  mk(
    'Chart',
    () => {
      viewMode = 'chart';
      applyViewMode();
      setStatus(statusEl(), 'Chart view');
    },
    { 'data-view-mode': 'chart' }
  ).classList.toggle('primary', viewMode === 'chart');

  mk(
    'Table',
    () => {
      viewMode = 'table';
      applyViewMode();
      setStatus(statusEl(), 'Table view');
    },
    { 'data-view-mode': 'table' }
  ).classList.toggle('primary', viewMode === 'table');

  if (viewMode === 'chart') {
    if (single && !changeOn) {
      mk(
        'Candles',
        () => {
          mode = 'candles';
          redrawAll();
        },
        { 'data-chart-mode': 'candles' }
      ).classList.toggle('primary', mode === 'candles');

      mk(
        'Area',
        () => {
          mode = 'area';
          redrawAll();
        },
        { 'data-chart-mode': 'area' }
      ).classList.toggle('primary', mode === 'area');
    }

    mk('Fit', () => chart?.timeScale().fitContent());
    mk('Reset zoom', () => {
      changeBaselineDate = null;
      pendingVisibleRange = null;
      lookbackDays = LOOKBACK_STEPS[0]!;
      void reloadAll(lookbackDays);
    });
    mk('Zoom in', () => {
      const ts = chart?.timeScale();
      if (!ts) return;
      const range = ts.getVisibleLogicalRange();
      if (!range) return;
      const mid = (range.from + range.to) / 2;
      const span = Math.max(2, (range.to - range.from) * 0.35);
      void ts.setVisibleLogicalRange({ from: mid - span, to: mid + span });
    });
    mk('Zoom out', () => {
      void zoomOutFetchMore();
    });
    mk(
      magnetOn ? 'Magnet on' : 'Magnet off',
      () => {
        magnetOn = !magnetOn;
        chart?.applyOptions({
          crosshair: { mode: magnetOn ? CrosshairMode.Magnet : CrosshairMode.Normal },
        });
        rebuildControls();
        setStatus(statusEl(), magnetOn ? 'Crosshair: magnet' : 'Crosshair: normal');
      },
      { 'aria-pressed': magnetOn ? 'true' : 'false' }
    ).classList.toggle('primary', magnetOn);
  }

  // Price vs % change — useful for multi overlays and table comparison.
  if (multi || viewMode === 'table' || seriesByTicker.size > 0) {
    mk(
      changeOn ? 'Change %' : 'Price',
      () => {
        changeOn = !changeOn;
        if (!changeOn) changeBaselineDate = null;
        redrawAll();
        const start =
          changeBaselineDate ?? [...seriesByTicker.values()][0]?.bars[0]?.date;
        setStatus(
          statusEl(),
          changeOn
            ? `Change % since ${start ?? 'first bar'}`
            : 'Absolute prices'
        );
      },
      {
        'aria-pressed': changeOn ? 'true' : 'false',
        title: changeOn
          ? '% change since baseline (click chart to rebase)'
          : 'Absolute price levels',
      }
    ).classList.toggle('primary', changeOn);
  }
}

async function zoomOutFetchMore(): Promise<void> {
  const next = nextLookback(lookbackDays, 1);
  if (next === lookbackDays) {
    chart?.timeScale().fitContent();
    setStatus(statusEl(), `Zoom out — already at max history (~${lookbackDays}d)`);
    return;
  }
  setStatus(statusEl(), `Zoom out — loading ~${next} days…`);
  await reloadAll(next);
}

async function broadcastTicker(symbol: string): Promise<void> {
  if (!fdc3) {
    setStatus(statusEl(), 'No agent — cannot broadcast.');
    return;
  }
  const ticker = symbol.toUpperCase();
  const entry = seriesByTicker.get(ticker);
  if (!entry) return;
  await fdc3.broadcast(entry.instrument as Parameters<DesktopAgent['broadcast']>[0]);
  const name = entry.instrument.name ?? entry.name;
  setStatus(
    statusEl(),
    name ? `Broadcast ${ticker} (${name})` : `Broadcast fdc3.instrument ${ticker}`
  );
}

async function fetchTicker(
  symbol: string,
  days: number
): Promise<{
  ticker: string;
  name: string;
  bars: Bar[];
  quote: number;
  quoteSource: string;
  chartSource: string;
  days: number;
}> {
  const ticker = symbol.toUpperCase();
  const res = await fetch(
    `/api/chart/${encodeURIComponent(ticker)}?days=${encodeURIComponent(String(days))}`
  );
  const body = (await res.json()) as {
    quote: { quote: { c: number }; source: string };
    chart: { bars: Bar[]; source: string; days?: number; name?: string };
  };
  return {
    ticker,
    name: body.chart.name?.trim() || ticker,
    bars: body.chart.bars,
    quote: body.quote.quote.c,
    quoteSource: body.quote.source,
    chartSource: body.chart.source,
    days: typeof body.chart.days === 'number' ? body.chart.days : days,
  };
}

async function addTicker(
  symbol: string,
  days: number = lookbackDays,
  incomingInstrument?: InstrumentContext | null
): Promise<void> {
  const ticker = symbol.trim().toUpperCase();
  if (!ticker) return;
  if (loading) return;
  loading = true;
  try {
    const data = await fetchTicker(ticker, days);
    lookbackDays = data.days;
    const existing = seriesByTicker.get(ticker);
    const instrument = mergeInstrument(
      existing?.instrument,
      incomingInstrument ?? null,
      data.name,
      ticker
    );
    const displayName = instrument.name ?? data.name ?? ticker;
    if (existing) {
      existing.bars = data.bars;
      existing.name = displayName;
      existing.instrument = instrument;
      existing.quote = data.quote;
      existing.quoteSource = data.quoteSource;
      existing.chartSource = data.chartSource;
    } else {
      seriesByTicker.set(ticker, {
        ticker,
        name: displayName,
        instrument,
        color: nextColor(),
        muted: false,
        bars: data.bars,
        quote: data.quote,
        quoteSource: data.quoteSource,
        chartSource: data.chartSource,
        lineSeries: null,
      });
    }
    activeTicker = ticker;
    updateMeta();
    renderChips();
    redrawAll();
    const overlayNote = changeOn
      ? ' · % change from start'
      : seriesByTicker.size > 1
        ? ' · overlay absolute closes'
        : '';
    setStatus(
      statusEl(),
      `Loaded ${displayName} [${ticker}] (${data.bars.length} bars ≈ ${lookbackDays}d, ${data.chartSource})${overlayNote}`
    );
  } finally {
    loading = false;
  }
}

async function reloadAll(days: number): Promise<void> {
  const tickers = [...seriesByTicker.keys()];
  if (tickers.length === 0) return;
  if (loading) return;
  loading = true;
  try {
    lookbackDays = days;
    const results = await Promise.all(tickers.map(t => fetchTicker(t, days)));
    for (const data of results) {
      lookbackDays = data.days;
      const entry = seriesByTicker.get(data.ticker);
      if (!entry) continue;
      entry.bars = data.bars;
      // Keep FDC3 name/ids; only fill name from Yahoo if we never had one.
      entry.instrument = mergeInstrument(entry.instrument, null, data.name, data.ticker);
      entry.name = entry.instrument.name ?? data.name ?? data.ticker;
      entry.quote = data.quote;
      entry.quoteSource = data.quoteSource;
      entry.chartSource = data.chartSource;
    }
    updateMeta();
    renderChips();
    redrawAll();
    setStatus(
      statusEl(),
      `Reloaded ${tickers.join(', ')} ≈ ${lookbackDays}d`
    );
  } finally {
    loading = false;
  }
}

async function removeTicker(ticker: string): Promise<void> {
  const entry = seriesByTicker.get(ticker);
  if (!entry) return;
  if (entry.lineSeries && chart) {
    chart.removeSeries(entry.lineSeries);
    entry.lineSeries = null;
  }
  seriesByTicker.delete(ticker);
  if (activeTicker === ticker) {
    activeTicker = [...seriesByTicker.keys()][0] ?? '';
  }
  updateMeta();
  renderChips();
  redrawAll();
  setStatus(
    statusEl(),
    seriesByTicker.size
      ? `Removed ${ticker}. Showing ${[...seriesByTicker.keys()].join(', ')}`
      : `Removed ${ticker}. Chart empty — Add a ticker.`
  );
}

async function handleGetPriceHistory(ctx: unknown): Promise<PriceHistory> {
  const { tickers, instruments } = tickersFromContext(ctx);
  const days = lookbackDaysFromContext(ctx, lookbackDays || DEFAULT_LOOKBACK_DAYS);
  const list = tickers.length ? tickers : [activeTicker || 'SHEL'];
  setStatus(statusEl(), `GetPriceHistory for ${list.join(', ')} (~${days}d)…`);
  const history = await fetchPriceHistory(list, { days, instruments });
  lookbackDays = history.lookbackDays;
  // Mirror into the chart UI so the user sees what Risk requested.
  for (const s of history.series) {
    const inst = asInstrumentContext(s.instrument, s.instrument.id.ticker);
    await addTicker(s.instrument.id.ticker, history.lookbackDays, inst);
  }
  setStatus(
    statusEl(),
    `Returned demo.priceHistory (${history.series.length} series, ~${history.lookbackDays}d)`
  );
  return history;
}

function snapshotSeries(): PriceSeriesSnapshot[] {
  return [...seriesByTicker.values()].map(entry => ({
    ticker: entry.ticker,
    name: entry.name,
    instrument: entry.instrument as Fdc3Instrument,
    bars: entry.bars,
  }));
}

async function applyExternalSeries(
  series: PriceSeriesSnapshot[],
  title?: string
): Promise<void> {
  // Replace in place from ViewData — drop existing overlays first.
  for (const entry of seriesByTicker.values()) {
    if (entry.lineSeries && chart) {
      chart.removeSeries(entry.lineSeries);
      entry.lineSeries = null;
    }
  }
  seriesByTicker.clear();
  changeBaselineDate = null;
  pendingVisibleRange = null;

  for (const s of series) {
    const instrument = asInstrumentContext(s.instrument, s.ticker) ?? {
      type: 'fdc3.instrument' as const,
      id: { ticker: s.ticker },
      ...(s.name ? { name: s.name } : {}),
    };
    seriesByTicker.set(s.ticker, {
      ticker: s.ticker,
      name: s.name || s.ticker,
      instrument,
      color: nextColor(),
      muted: false,
      bars: s.bars,
      quote: s.bars.at(-1)?.close ?? 0,
      quoteSource: 'ViewData',
      chartSource: 'fdc3.data.tabularData',
      lineSeries: null,
    });
  }

  activeTicker = [...seriesByTicker.keys()][0] ?? '';
  viewMode = 'table';
  updateMeta();
  renderChips();
  rebuildControls();
  redrawAll();
  setStatus(
    statusEl(),
    title
      ? `Loaded ViewData “${title}” (${series.map(s => s.ticker).join(', ') || 'empty'})`
      : `Loaded ViewData (${series.map(s => s.ticker).join(', ') || 'empty'})`
  );
}

async function setup(): Promise<void> {
  rebuildControls();
  await addTicker((document.getElementById('ticker') as HTMLInputElement).value);
  fdc3 = await connectAgent(statusEl());

  if (!fdc3) return;
  await fdc3.addIntentListener(INTENTS.ViewChart, async ctx => {
    const { tickers, instruments } = tickersFromContext(ctx);
    const list = tickers.length ? tickers : ['SHEL'];
    setStatus(statusEl(), `ViewChart for ${list.join(', ')}…`);
    for (const ticker of list) {
      const instrument =
        instruments.get(ticker) ??
        asInstrumentContext({ type: 'fdc3.instrument', id: { ticker } }, ticker);
      (document.getElementById('ticker') as HTMLInputElement).value = ticker;
      await addTicker(ticker, lookbackDays, instrument);
    }
    setStatus(statusEl(), `ViewChart loaded (${list.join(', ')})`);
  });

  await fdc3.addIntentListener(INTENTS.GetPriceHistory, async ctx => handleGetPriceHistory(ctx));

  await fdc3.addContextListener('fdc3.instrument', async ctx => {
    const instrument = asInstrumentContext(ctx, '');
    const ticker = instrument?.id.ticker;
    if (ticker) {
      (document.getElementById('ticker') as HTMLInputElement).value = ticker;
      await addTicker(ticker, lookbackDays, instrument);
    }
  });

  await setupFdc3DataExtension({
    fdc3,
    statusEl: statusEl(),
    getSeries: snapshotSeries,
    applySeries: applyExternalSeries,
  });
}

document.getElementById('load')!.addEventListener('click', () => {
  void addTicker((document.getElementById('ticker') as HTMLInputElement).value);
});

void setup();
