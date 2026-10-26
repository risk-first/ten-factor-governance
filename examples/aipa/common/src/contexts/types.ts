/** Suite context types and intent names for AIPA assisting apps. */

import type { Chart } from '@finos/fdc3-context';

export const INTENTS = {
  GetPortfolio: 'GetPortfolio',
  ViewHoldings: 'ViewHoldings',
  GetPortfolioRisk: 'demo.GetPortfolioRisk',
  RunStressScenario: 'demo.RunStressScenario',
  ViewAnalysis: 'ViewAnalysis',
  GetResearch: 'demo.GetResearch',
  ViewInstrument: 'ViewInstrument',
  ViewNews: 'ViewNews',
  ViewResearch: 'ViewResearch',
  ViewChart: 'ViewChart',
  GetPriceHistory: 'demo.GetPriceHistory',
  CreateOrder: 'demo.CreateOrder',
  ViewOrders: 'ViewOrders',
  SubmitOrder: 'demo.SubmitOrder',
  GetApproval: 'GetApproval',
  UpdateApproval: 'UpdateApproval',
  CancelApproval: 'CancelApproval',
  ViewApproval: 'ViewApproval',
  ReviewApproval: 'ReviewApproval',
  /** fdc3.data — pull one advertised dataset from a data app */
  GetAppData: 'GetAppData',
  /** Standard FDC3 — seed / replace-in-place display context */
  ViewData: 'ViewData',
  /** fdc3.ai — Agent UI → Agent harness; IntentResult is a PrivateChannel */
  AskAgent: 'AskAgent',
} as const;

export const CONTEXT_TYPES = {
  portfolio: 'fdc3.portfolio',
  position: 'fdc3.position',
  instrument: 'fdc3.instrument',
  instrumentList: 'fdc3.instrumentList',
  chart: 'fdc3.chart',
  transactionResult: 'fdc3.transactionResult',
  portfolioRisk: 'demo.portfolioRisk',
  researchBundle: 'demo.researchBundle',
  stressScenarioRequest: 'demo.stressScenarioRequest',
  stressScenarioResult: 'demo.stressScenarioResult',
  demoOrder: 'demo.order',
  demoOrderList: 'demo.orderList',
  approval: 'fdc3.approval',
  priceHistory: 'demo.priceHistory',
  /** fdc3.data extension */
  advertiseDatasets: 'fdc3.data.advertiseDatasets',
  appOffer: 'fdc3.data.appOffer',
  dataRequest: 'fdc3.data.dataRequest',
  tabularData: 'fdc3.data.tabularData',
  markdown: 'fdc3.data.markdown',
  file: 'fdc3.data.file',
  /** fdc3.ai extension — UI ↔ harness PrivateChannel */
  agentQuery: 'fdc3.ai.agentQuery',
  agentDelta: 'fdc3.ai.agentDelta',
  agentAnswer: 'fdc3.ai.agentAnswer',
  agentCancel: 'fdc3.ai.agentCancel',
  /** fdc3.discoverability extension — app channel catalog discovery */
  discoverApps: 'fdc3.discoverability.discoverApps',
  appDirectory: 'fdc3.discoverability.appDirectory',
  discoverIntents: 'fdc3.discoverability.discoverIntents',
  intentList: 'fdc3.discoverability.intentList',
  discoverContextTypes: 'fdc3.discoverability.discoverContextTypes',
  contextTypeList: 'fdc3.discoverability.contextTypeList',
  discoverContextSchema: 'fdc3.discoverability.discoverContextSchema',
  contextSchema: 'fdc3.discoverability.contextSchema',
  discoverAppDirectoryRecord: 'fdc3.discoverability.discoverAppDirectoryRecord',
  appDirectoryRecord: 'fdc3.discoverability.appDirectoryRecord',
} as const;

/** Dedicated app channel for fdc3.discoverability request/reply. */
export const DISCOVERABILITY_CHANNEL = 'fdc3.discoverability';

export type DiscoverabilityAppEntry = {
  appId: string;
  title?: string;
  description?: string;
};

export type DiscoverabilityIntentEntry = {
  name: string;
  /** When / why to raise this intent (from AppD `listensFor.*.purpose`). */
  purpose: string;
  displayName?: string;
  contexts?: string[];
  resultType?: string;
};

export type DiscoverabilityContextTypeEntry = {
  contextType: string;
  schemaUrl?: string;
  name?: string;
  description?: string;
};

export type DiscoverApps = { type: 'fdc3.discoverability.discoverApps' };
export type DiscoverIntents = { type: 'fdc3.discoverability.discoverIntents' };
export type DiscoverContextTypes = { type: 'fdc3.discoverability.discoverContextTypes' };
export type DiscoverContextSchema = {
  type: 'fdc3.discoverability.discoverContextSchema';
  contextType: string;
};

export type DiscoverAppDirectoryRecord = {
  type: 'fdc3.discoverability.discoverAppDirectoryRecord';
  appId: string;
};

export type AppDirectoryReply = {
  type: 'fdc3.discoverability.appDirectory';
  apps: DiscoverabilityAppEntry[];
};

export type IntentListReply = {
  type: 'fdc3.discoverability.intentList';
  intents: DiscoverabilityIntentEntry[];
};

export type ContextTypeListReply = {
  type: 'fdc3.discoverability.contextTypeList';
  contextTypes: DiscoverabilityContextTypeEntry[];
};

export type ContextSchemaReply = {
  type: 'fdc3.discoverability.contextSchema';
  contextType: string;
  schemaUrl?: string;
  /** JSON Schema document when resolved. */
  schema?: Record<string, unknown>;
  /** Set when no schema is available for `contextType`. */
  error?: string;
};

/** Full FDC3 App Directory `Application` record (see appd.schema.json). */
export type AppDirectoryApplicationRecord = Record<string, unknown> & {
  appId: string;
  title?: string;
  type?: string;
};

export type AppDirectoryRecordReply = {
  type: 'fdc3.discoverability.appDirectoryRecord';
  appId: string;
  /** Full App Directory Application when found. */
  record?: AppDirectoryApplicationRecord;
  /** Set when no record is available for `appId`. */
  error?: string;
};

export type FileFormat = 'pdf' | 'docx' | 'txt' | 'md' | 'html';

/** Shareable file payload — referenced by id from agentQuery.fileIds. */
export type Fdc3DataFile = {
  type: 'fdc3.data.file';
  id: { fileId: string };
  name: string;
  format: FileFormat;
  content_b64?: string;
  url?: string;
};

/** Markdown payload for open / ViewData (distinct from agentAnswer.markdown). */
export type Fdc3DataMarkdown = {
  type: 'fdc3.data.markdown';
  markdown: string;
  title?: string;
  instanceId?: string;
};

export type AgentQuery = {
  type: 'fdc3.ai.agentQuery';
  text?: string | null;
  model?: string;
  /** Refs to fdc3.data.file ids already on the session channel. */
  fileIds?: string[];
};

export type AgentDelta = {
  type: 'fdc3.ai.agentDelta';
  kind: 'text' | 'status' | 'artifact' | 'citation' | 'suggestion';
  payload: Record<string, unknown>;
};

export type AgentAnswer = {
  type: 'fdc3.ai.agentAnswer';
  markdown: string;
  citations?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
  suggestions?: string[];
};

export type AgentCancel = {
  type: 'fdc3.ai.agentCancel';
  reason?: string;
};

export type Fdc3Instrument = {
  type: 'fdc3.instrument';
  name?: string;
  id: { ticker: string; ISIN?: string };
};

/** Tabular payload from `fdc3.data.tabularData`. */
export type TabularData = {
  type: 'fdc3.data.tabularData';
  instanceId?: string;
  title?: string;
  columns: string[];
  rows: unknown[][];
  /** Optional embedded standard FDC3 chart context for chart presentation. */
  chart?: Chart;
};

/** Metadata-only advertisement from `fdc3.data.appOffer`. */
export type AppOffer = {
  type: 'fdc3.data.appOffer';
  id: { dataId: string };
  source: { appId: string; instanceId: string };
  contextType: string;
  schemaUrl: string;
  displayMetadata: { name: string; color?: string; glyph?: string };
  metadata?: Record<string, string>;
};

export type Fdc3Position = {
  type: 'fdc3.position';
  instrument: Fdc3Instrument;
  holding: number;
  /** Weight as fraction of portfolio MV (0–1). */
  weight?: number;
};

export type Fdc3Portfolio = {
  type: 'fdc3.portfolio';
  id?: { portfolioId?: string };
  name?: string;
  positions: Fdc3Position[];
};

export type OhlcBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

/** Multi-ticker OHLC history returned by Market Data for Risk analytics. */
export type PriceHistory = {
  type: 'demo.priceHistory';
  asOf: string;
  lookbackDays: number;
  series: Array<{
    instrument: Fdc3Instrument;
    bars: OhlcBar[];
    source: string;
  }>;
};

export type PortfolioRisk = {
  type: 'demo.portfolioRisk';
  portfolioId: string;
  asOf: string;
  concentration: { sector: string; weight: number }[];
  topContributors: { ticker: string; weight: number; riskContribution: number }[];
  metrics: {
    herfindahl: number;
    energyWeight: number;
    largestPositionWeight: number;
    volatility: number;
    var95: number;
    expectedShortfall95: number;
    sharpe: number;
    maxDrawdown: number;
  };
  correlation?: { tickers: string[]; matrix: number[][] };
  provenance: {
    analysisId: string;
    source: string;
    marketDataSource?: string;
    lookbackDays?: number;
    riskFreeRate?: number;
  };
};

export type ResearchFinding = {
  title: string;
  summary: string;
  sourceUrl: string;
  sourceType: 'filing' | 'news' | 'fixture';
  publishedAt: string;
  tickers?: string[];
};

export type ResearchBundle = {
  type: 'demo.researchBundle';
  subject: { portfolioId?: string; tickers: string[] };
  asOf: string;
  findings: ResearchFinding[];
  provenance: { bundleId: string; sources: string[] };
};

export type StressScenarioRequest = {
  type: 'demo.stressScenarioRequest';
  portfolioId: string;
  scenario: {
    name: string;
    oilPriceShockPct?: number;
    rateShockBps?: number;
  };
  /** Optional price history so stress can scale by historical vols. */
  priceHistory?: PriceHistory;
  portfolio?: Fdc3Portfolio;
};

export type StressScenarioResult = {
  type: 'demo.stressScenarioResult';
  portfolioId: string;
  scenarioName: string;
  asOf: string;
  portfolioValueChangePct: number;
  sectorImpacts: { sector: string; changePct: number }[];
  provenance: { resultId: string; macroSource: string };
};

export type DemoOrder = {
  type: 'demo.order';
  id: Record<string, string>;
  name?: string;
  instrument: Fdc3Instrument;
  side: 'buy' | 'sell';
  quantity: number;
  orderType?: 'market';
};

export type DemoOrderList = {
  type: 'demo.orderList';
  id?: Record<string, string>;
  name?: string;
  orders: DemoOrder[];
};

export type DemoOrderOrList = DemoOrder | DemoOrderList;

export function isDemoOrderList(ctx: unknown): ctx is DemoOrderList {
  return Boolean(ctx && typeof ctx === 'object' && (ctx as DemoOrderList).type === CONTEXT_TYPES.demoOrderList);
}

export function isDemoOrder(ctx: unknown): ctx is DemoOrder {
  return Boolean(ctx && typeof ctx === 'object' && (ctx as DemoOrder).type === CONTEXT_TYPES.demoOrder);
}

/** Expand a `demo.order` or `demo.orderList` (or `{ orders }`) into legs. */
export function ordersFromContext(ctx: unknown): DemoOrder[] {
  if (!ctx || typeof ctx !== 'object') return [];
  const raw = ctx as { type?: string; orders?: unknown };
  if (raw.type === CONTEXT_TYPES.demoOrderList || Array.isArray(raw.orders)) {
    return Array.isArray(raw.orders) ? (raw.orders as DemoOrder[]) : [];
  }
  if (raw.type === CONTEXT_TYPES.demoOrder) return [raw as DemoOrder];
  return [];
}

/** One leg stays `demo.order`; two or more become `demo.orderList`. */
export function asOrderOrList(orders: DemoOrder[]): DemoOrderOrList {
  if (orders.length === 1) return orders[0];
  return { type: 'demo.orderList', orders };
}

/** Contexts that MUST carry FDC3 Security signatures when produced. */
export const MUST_SIGN_CONTEXT_TYPES: string[] = [
  CONTEXT_TYPES.portfolioRisk,
  CONTEXT_TYPES.researchBundle,
  CONTEXT_TYPES.stressScenarioResult,
  CONTEXT_TYPES.demoOrder,
  CONTEXT_TYPES.demoOrderList,
];
