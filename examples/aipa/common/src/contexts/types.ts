/** Suite context types and intent names for AIPA assisting apps. */

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
  CreateOrderProposal: 'demo.CreateOrderProposal',
  ViewOrders: 'ViewOrders',
  SubmitOrders: 'demo.SubmitOrders',
} as const;

export const CONTEXT_TYPES = {
  portfolio: 'fdc3.portfolio',
  position: 'fdc3.position',
  instrument: 'fdc3.instrument',
  instrumentList: 'fdc3.instrumentList',
  order: 'fdc3.order',
  orderList: 'fdc3.orderList',
  transactionResult: 'fdc3.transactionResult',
  portfolioRisk: 'demo.portfolioRisk',
  researchBundle: 'demo.researchBundle',
  stressScenarioRequest: 'demo.stressScenarioRequest',
  stressScenarioResult: 'demo.stressScenarioResult',
  portfolioRecommendation: 'demo.portfolioRecommendation',
  orderProposal: 'demo.orderProposal',
} as const;

export type Fdc3Instrument = {
  type: 'fdc3.instrument';
  name?: string;
  id: { ticker: string; ISIN?: string };
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

export type PortfolioRisk = {
  type: 'demo.portfolioRisk';
  portfolioId: string;
  asOf: string;
  concentration: { sector: string; weight: number }[];
  topContributors: { ticker: string; weight: number; riskContribution: number }[];
  metrics: { herfindahl: number; energyWeight: number; largestPositionWeight: number };
  provenance: { analysisId: string; source: string };
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

export type PortfolioRecommendation = {
  type: 'demo.portfolioRecommendation';
  portfolioId: string;
  rationale: string;
  targetChanges: { ticker: string; targetWeight: number; action: 'buy' | 'sell' | 'hold' }[];
  evidenceRefs?: string[];
};

export type OrderProposal = {
  type: 'demo.orderProposal';
  proposalId: string;
  portfolioId: string;
  orders: {
    instrument: Fdc3Instrument;
    side: 'buy' | 'sell';
    quantity: number;
    orderType: 'market';
  }[];
  asOf: string;
};

/** Contexts that MUST carry FDC3 Security signatures when produced. */
export const MUST_SIGN_CONTEXT_TYPES: string[] = [
  CONTEXT_TYPES.portfolioRisk,
  CONTEXT_TYPES.researchBundle,
  CONTEXT_TYPES.stressScenarioResult,
  CONTEXT_TYPES.portfolioRecommendation,
  CONTEXT_TYPES.orderProposal,
];
