import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import {
  CONTEXT_TYPES,
  INTENTS,
  type Fdc3Portfolio,
  type PortfolioRisk,
  type PriceHistory,
  type StressScenarioRequest,
  type StressScenarioResult,
} from '../../../common/src/contexts/types.ts';
import {
  DEFAULT_LOOKBACK_DAYS,
  MARKET_DATA_ORIGIN,
  fetchPriceHistory,
  tickersFromPortfolio,
} from '../../../common/src/data/priceHistory.ts';
import { toResultContext, type SignedEnvelope } from '../../../common/src/security/envelope.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { DesktopAgent } from '@finos/fdc3';
import * as echarts from 'echarts/core';
import { PieChart, HeatmapChart } from 'echarts/charts';
import {
  TooltipComponent,
  LegendComponent,
  GridComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsType } from 'echarts/core';
import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  themeQuartz,
  type GridApi,
  type ValueFormatterParams,
} from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);
echarts.use([
  PieChart,
  HeatmapChart,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

const SECTOR_COLORS = [
  '#175cd3',
  '#12b76a',
  '#f04438',
  '#7a5af8',
  '#f79009',
  '#0e9384',
  '#ee46bc',
  '#6172f3',
];

type MetricDef = {
  key: keyof PortfolioRisk['metrics'];
  label: string;
  format: 'pct' | 'pctAbs' | 'num';
  /** Higher score = more risk (red). */
  riskScore: (v: number) => number;
  explain: string;
};

const METRIC_DEFS: MetricDef[] = [
  {
    key: 'volatility',
    label: 'Annualised volatility',
    format: 'pct',
    riskScore: v => clamp01((v - 0.08) / 0.32),
    explain:
      'Annualised standard deviation of portfolio returns. Higher volatility means larger day-to-day swings in portfolio value.',
  },
  {
    key: 'var95',
    label: 'VaR (95%)',
    format: 'pctAbs',
    riskScore: v => clamp01((Math.abs(v) - 0.005) / 0.04),
    explain:
      'Value at Risk at 95% confidence: an estimate of the worst daily loss that should not be exceeded on 19 out of 20 days, based on recent returns.',
  },
  {
    key: 'expectedShortfall95',
    label: 'Expected shortfall (95%)',
    format: 'pct',
    riskScore: v => clamp01((Math.abs(v) - 0.005) / 0.05),
    explain:
      'Average loss on days worse than the VaR threshold (tail risk). Captures how bad losses get when VaR is breached.',
  },
  {
    key: 'sharpe',
    label: 'Sharpe ratio',
    format: 'num',
    // Higher Sharpe is better → invert for risk colouring.
    riskScore: v => clamp01(1 - (v + 0.5) / 3),
    explain:
      'Risk-adjusted return: excess return over the risk-free rate per unit of volatility. Higher is better; low or negative Sharpe means poor compensation for risk taken.',
  },
  {
    key: 'maxDrawdown',
    label: 'Max drawdown',
    format: 'pct',
    riskScore: v => clamp01((v - 0.02) / 0.25),
    explain:
      'Largest peak-to-trough decline in portfolio value over the lookback window. Shows the worst historical paper loss from a high-water mark.',
  },
  {
    key: 'herfindahl',
    label: 'Herfindahl (HHI)',
    format: 'num',
    riskScore: v => clamp01((v - 0.1) / 0.4),
    explain:
      'Sum of squared position weights. Near 0 means diversified; near 1 means one name dominates. Higher concentration increases idiosyncratic risk.',
  },
  {
    key: 'energyWeight',
    label: 'Energy weight',
    format: 'pct',
    riskScore: v => clamp01(v / 0.6),
    explain:
      'Portfolio weight in Energy names. Elevated energy exposure increases sensitivity to oil-price shocks in this demo.',
  },
  {
    key: 'largestPositionWeight',
    label: 'Largest position',
    format: 'pct',
    riskScore: v => clamp01((v - 0.08) / 0.35),
    explain:
      'Weight of the single largest holding. A large top weight concentrates risk in one issuer.',
  },
];

let fdc3: DesktopAgent | null = null;
let lastAnalysis: unknown = null;
let currentPortfolio: Fdc3Portfolio | null = null;
let lastPriceSource: 'intent' | 'http' | 'none' = 'none';
let sectorChart: EChartsType | null = null;
let corrChart: EChartsType | null = null;
let contribGrid: GridApi | null = null;

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/** Interpolate green (#12b76a) → amber → red (#f04438) by risk score 0–1. */
function riskColor(score: number): string {
  const t = clamp01(score);
  const stops: Array<[number, number, number]> = [
    [18, 183, 106],
    [247, 144, 9],
    [240, 68, 56],
  ];
  const seg = t < 0.5 ? 0 : 1;
  const local = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const a = stops[seg]!;
  const b = stops[seg + 1]!;
  const r = Math.round(a[0] + (b[0] - a[0]) * local);
  const g = Math.round(a[1] + (b[1] - a[1]) * local);
  const bl = Math.round(a[2] + (b[2] - a[2]) * local);
  return `rgb(${r}, ${g}, ${bl})`;
}

function pct(n: number | undefined, digits = 1): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

function pctAbs(n: number | undefined, digits = 1): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `${(Math.abs(n) * 100).toFixed(digits)}%`;
}

function num(n: number | undefined, digits = 2): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatMetric(def: MetricDef, v: number): string {
  if (def.format === 'pct') return pct(v);
  if (def.format === 'pctAbs') return pctAbs(v);
  return num(v, def.key === 'herfindahl' ? 3 : 2);
}

function showDashboard(show: boolean): void {
  const dash = document.getElementById('risk-dashboard')!;
  const raw = document.getElementById('raw-details')!;
  const placeholder = document.getElementById('placeholder')!;
  dash.hidden = !show;
  raw.hidden = !show;
  placeholder.hidden = show;
}

function renderMetricsTable(risk: PortfolioRisk): void {
  const host = document.getElementById('metrics-table')!;
  host.replaceChildren();

  const table = document.createElement('table');
  table.className = 'risk-metrics';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Metric</th><th>Value</th><th>Risk</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  for (const def of METRIC_DEFS) {
    const v = risk.metrics[def.key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const score = def.riskScore(v);
    const color = riskColor(score);

    const tr = document.createElement('tr');
    tr.title = def.explain;

    const tdLabel = document.createElement('td');
    tdLabel.className = 'risk-metrics__label';
    const tip = document.createElement('span');
    tip.className = 'risk-tip';
    tip.textContent = '?';
    tip.title = def.explain;
    tip.setAttribute('aria-label', def.explain);
    tdLabel.append(document.createTextNode(def.label + ' '), tip);

    const tdValue = document.createElement('td');
    tdValue.className = 'risk-metrics__value';
    tdValue.textContent = formatMetric(def, v);
    tdValue.style.color = color;

    const tdBar = document.createElement('td');
    tdBar.className = 'risk-metrics__bar-cell';
    const track = document.createElement('div');
    track.className = 'risk-metrics__track';
    const fill = document.createElement('div');
    fill.className = 'risk-metrics__fill';
    fill.style.width = `${Math.round(score * 100)}%`;
    fill.style.background = color;
    track.appendChild(fill);
    tdBar.appendChild(track);

    tr.append(tdLabel, tdValue, tdBar);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  host.appendChild(table);
}

function ensureSectorChart(): EChartsType {
  const el = document.getElementById('sector-donut')!;
  if (!sectorChart) {
    sectorChart = echarts.init(el, undefined, { renderer: 'canvas' });
    window.addEventListener('resize', () => sectorChart?.resize());
  }
  return sectorChart;
}

function renderSectorDonut(risk: PortfolioRisk): void {
  const chart = ensureSectorChart();
  const data = [...risk.concentration]
    .filter(c => c.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((c, i) => ({
      name: c.sector,
      value: Number((c.weight * 100).toFixed(2)),
      itemStyle: { color: SECTOR_COLORS[i % SECTOR_COLORS.length] },
    }));

  chart.setOption(
    {
      tooltip: {
        trigger: 'item',
        formatter: (p: { name?: string; value?: number; percent?: number }) =>
          `${p.name}<br/>${p.value?.toFixed(1)}% (${p.percent?.toFixed(1)}% of chart)`,
      },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'middle',
        textStyle: { color: '#344054', fontSize: 12 },
      },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['38%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 600, color: '#101828' },
            scaleSize: 6,
          },
          data,
        },
      ],
    },
    true
  );
  requestAnimationFrame(() => chart.resize());
}

function ensureContribGrid(): GridApi {
  if (contribGrid) return contribGrid;
  const host = document.getElementById('contributors-grid')!;
  contribGrid = createGrid(host, {
    theme: themeQuartz,
    columnDefs: [
      { field: 'rank', headerName: '#', width: 56, flex: 0, sortable: false },
      { field: 'ticker', headerName: 'Ticker', flex: 1, minWidth: 90 },
      {
        field: 'weight',
        headerName: 'Weight',
        type: 'numericColumn',
        flex: 1,
        minWidth: 100,
        valueFormatter: (p: ValueFormatterParams) => pct(p.value as number, 1),
      },
      {
        field: 'riskContribution',
        headerName: 'Risk contrib.',
        type: 'numericColumn',
        flex: 1.2,
        minWidth: 120,
        valueFormatter: (p: ValueFormatterParams) => pct(p.value as number, 2),
        cellStyle: (p: { value?: number }) => {
          const v = typeof p.value === 'number' ? p.value : 0;
          return { color: riskColor(clamp01(v / 0.08)), fontWeight: '650' };
        },
      },
    ],
    defaultColDef: { sortable: true, resizable: true, filter: false },
    rowData: [],
    animateRows: false,
    suppressCellFocus: true,
    domLayout: 'autoHeight',
  });
  return contribGrid;
}

function renderContributors(risk: PortfolioRisk): void {
  const api = ensureContribGrid();
  const rows = risk.topContributors.map((c, i) => ({
    rank: i + 1,
    ticker: c.ticker,
    weight: c.weight,
    riskContribution: c.riskContribution,
  }));
  api.setGridOption('rowData', rows);
}

function ensureCorrChart(): EChartsType {
  const el = document.getElementById('corr-heatmap')!;
  if (!corrChart) {
    corrChart = echarts.init(el, undefined, { renderer: 'canvas' });
    window.addEventListener('resize', () => corrChart?.resize());
  }
  return corrChart;
}

function renderCorrelation(risk: PortfolioRisk): void {
  const chart = ensureCorrChart();
  const tickers = risk.correlation?.tickers ?? [];
  const matrix = risk.correlation?.matrix ?? [];
  if (!tickers.length || !matrix.length) {
    chart.clear();
    chart.setOption({
      title: {
        text: 'No correlation data',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#98a2b3', fontSize: 13, fontWeight: 500 },
      },
    });
    return;
  }

  const data: Array<[number, number, number]> = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < (matrix[i]?.length ?? 0); j++) {
      if (i === j) continue; // leave diagonal empty (self-correlation)
      data.push([j, i, Number((matrix[i]![j] ?? 0).toFixed(3))]);
    }
  }

  chart.setOption(
    {
      tooltip: {
        position: 'top',
        formatter: (p: { data?: [number, number, number] }) => {
          const d = p.data;
          if (!d) return '';
          return `${tickers[d[1]]} × ${tickers[d[0]]}: ${d[2].toFixed(3)}`;
        },
      },
      grid: { left: 56, right: 24, top: 16, bottom: 56 },
      xAxis: {
        type: 'category',
        data: tickers,
        splitArea: { show: true },
        axisLabel: { color: '#475467', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: tickers,
        splitArea: { show: true },
        axisLabel: { color: '#475467', fontSize: 11 },
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: {
          color: ['#175cd3', '#f2f4f7', '#f04438'],
        },
        textStyle: { color: '#667085', fontSize: 11 },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: tickers.length <= 8,
            formatter: (p: { data?: [number, number, number] }) =>
              p.data ? p.data[2].toFixed(2) : '',
            fontSize: 10,
            color: '#101828',
          },
          emphasis: {
            itemStyle: { shadowBlur: 8, shadowColor: 'rgba(16,24,40,0.25)' },
          },
        },
      ],
    },
    true
  );
  requestAnimationFrame(() => chart.resize());
}

function renderPortfolioRisk(risk: PortfolioRisk): void {
  showDashboard(true);
  renderMetricsTable(risk);
  renderSectorDonut(risk);
  renderContributors(risk);
  renderCorrelation(risk);
  document.getElementById('analysis')!.textContent = JSON.stringify(risk, null, 2);
}

function renderStress(result: StressScenarioResult): void {
  showDashboard(false);
  const placeholder = document.getElementById('placeholder')!;
  placeholder.hidden = false;
  placeholder.textContent = JSON.stringify(result, null, 2);
  document.getElementById('raw-details')!.hidden = true;
}

function show(obj: unknown): void {
  lastAnalysis = obj;
  if (obj && typeof obj === 'object' && (obj as { type?: string }).type === CONTEXT_TYPES.portfolioRisk) {
    renderPortfolioRisk(obj as PortfolioRisk);
    return;
  }
  if (
    obj &&
    typeof obj === 'object' &&
    (obj as { type?: string }).type === CONTEXT_TYPES.stressScenarioResult
  ) {
    renderStress(obj as StressScenarioResult);
    return;
  }
  showDashboard(false);
  const placeholder = document.getElementById('placeholder')!;
  placeholder.hidden = false;
  placeholder.textContent = JSON.stringify(obj ?? { message: 'No analysis yet' }, null, 2);
}

async function resolvePortfolio(portfolio?: Fdc3Portfolio | null): Promise<Fdc3Portfolio> {
  if (portfolio?.positions?.length) return portfolio;
  if (currentPortfolio?.positions?.length) return currentPortfolio;
  const res = await fetch('/api/portfolio');
  const body = (await res.json()) as { portfolio: Fdc3Portfolio };
  currentPortfolio = body.portfolio;
  return body.portfolio;
}

async function obtainPriceHistory(portfolio: Fdc3Portfolio): Promise<PriceHistory> {
  const tickers = tickersFromPortfolio(portfolio);
  if (!tickers.length) throw new Error('Portfolio has no tickers');

  if (fdc3) {
    try {
      const resolution = await fdc3.raiseIntent(
        INTENTS.GetPriceHistory,
        portfolio as Parameters<DesktopAgent['raiseIntent']>[1],
        { appId: 'aipa-market-data' }
      );
      const result = await resolution.getResult();
      if (result && typeof result === 'object' && (result as PriceHistory).type === CONTEXT_TYPES.priceHistory) {
        lastPriceSource = 'intent';
        return result as PriceHistory;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(statusEl(), `GetPriceHistory intent failed (${msg}); falling back to HTTP…`);
    }
  }

  lastPriceSource = 'http';
  return fetchPriceHistory(tickers, {
    days: DEFAULT_LOOKBACK_DAYS,
    baseUrl: MARKET_DATA_ORIGIN,
  });
}

async function analyseApi(portfolio?: Fdc3Portfolio): Promise<Record<string, unknown>> {
  const pf = await resolvePortfolio(portfolio);
  setStatus(statusEl(), 'Fetching price history from Market Data…');
  const priceHistory = await obtainPriceHistory(pf);
  setStatus(
    statusEl(),
    `Price history via ${lastPriceSource} (${priceHistory.series.length} series, ~${priceHistory.lookbackDays}d). Analysing…`
  );

  const res = await fetch('/api/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolio: pf, priceHistory }),
  });
  const body = await res.json();
  if (!res.ok) {
    const err = (body as { error?: string }).error ?? res.statusText;
    setStatus(statusEl(), `Analyse failed: ${err}`);
    throw new Error(err);
  }
  const envelope = body as SignedEnvelope;
  const result = toResultContext(envelope);
  show(result);
  setStatus(
    statusEl(),
    `Signed ${CONTEXT_TYPES.portfolioRisk} (prices=${lastPriceSource}, jku=${envelope.jku})`
  );
  return result;
}

async function stressApi(req: StressScenarioRequest): Promise<Record<string, unknown>> {
  const pf = await resolvePortfolio(req.portfolio ?? currentPortfolio);
  setStatus(statusEl(), 'Fetching price history for stress…');
  const priceHistory = await obtainPriceHistory(pf);

  const res = await fetch('/api/stress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, portfolio: pf, priceHistory }),
  });
  const body = await res.json();
  if (!res.ok) {
    const err = (body as { error?: string }).error ?? res.statusText;
    setStatus(statusEl(), `Stress failed: ${err}`);
    throw new Error(err);
  }
  const envelope = body as SignedEnvelope;
  const result = toResultContext(envelope);
  show(result);
  setStatus(statusEl(), `Signed ${CONTEXT_TYPES.stressScenarioResult} (prices=${lastPriceSource})`);
  return result;
}

async function setup(): Promise<void> {
  const session = await connectAppSession(statusEl());
  fdc3 = session.fdc3;
  if (!fdc3) {
    setStatus(
      statusEl(),
      'No Desktop Agent — Analyse will pull charts via HTTP from Market Data (localhost:4103).'
    );
    return;
  }

  await fdc3.addContextListener(CONTEXT_TYPES.portfolio, async ctx => {
    currentPortfolio = ctx as Fdc3Portfolio;
    setStatus(statusEl(), `Received portfolio ${currentPortfolio.id?.portfolioId ?? ''}`);
  });

  await fdc3.addIntentListener(INTENTS.GetPortfolioRisk, async ctx => {
    const portfolio = (ctx as Fdc3Portfolio) ?? currentPortfolio ?? undefined;
    return analyseApi(portfolio);
  });

  await fdc3.addIntentListener(INTENTS.RunStressScenario, async ctx => {
    return stressApi(ctx as StressScenarioRequest);
  });

  await fdc3.addIntentListener(INTENTS.ViewAnalysis, async () => {
    show(lastAnalysis ?? { message: 'No analysis yet' });
    setStatus(statusEl(), 'ViewAnalysis focused latest analysis');
  });
}

document.getElementById('run-local')!.addEventListener('click', () => {
  void analyseApi(currentPortfolio ?? undefined).catch(() => undefined);
});
document.getElementById('stress-local')!.addEventListener('click', () =>
  void stressApi({
    type: 'demo.stressScenarioRequest',
    portfolioId: currentPortfolio?.id?.portfolioId ?? 'aipa-energy-demo-1',
    scenario: { name: 'Oil price −20%', oilPriceShockPct: -20 },
  }).catch(() => undefined)
);

void setup();
