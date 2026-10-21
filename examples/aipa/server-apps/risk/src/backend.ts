import type { Application } from 'express';
import type { Server } from 'http';
import { randomUUID } from 'node:crypto';
import {
  calculateCorrelationMatrix,
  calculatePortfolioMetrics,
  calculatePortfolioVolatility,
  calculateReturns,
} from '@railpath/finance-toolkit';
import { createAppSigner, mountSigningRoutes } from '../../../common/src/security/signing.js';
import { loadPortfolioFixture, toFdc3Portfolio } from '../../../common/src/data/portfolio.js';
import { getMacroSnapshot } from '../../../common/src/data/fred.js';
import type {
  Fdc3Portfolio,
  PortfolioRisk,
  PriceHistory,
  StressScenarioRequest,
  StressScenarioResult,
} from '../../../common/src/contexts/types.js';

const ANNUALIZATION = 252;

type Pos = { ticker: string; holding: number; weight: number; sector: string };

function positionsFromPortfolio(portfolio?: Fdc3Portfolio): Pos[] {
  const fixture = loadPortfolioFixture();
  const sectorByTicker = new Map(
    fixture.positions.map(p => [p.instrument.id.ticker.toUpperCase(), p.sector ?? 'Unknown'])
  );

  if (portfolio?.positions?.length) {
    return portfolio.positions.map(p => {
      const ticker = p.instrument.id.ticker.toUpperCase();
      return {
        ticker,
        holding: p.holding,
        weight: p.weight ?? 0,
        sector:
          (p as { sector?: string }).sector ??
          sectorByTicker.get(ticker) ??
          (['SHEL', 'XOM', 'CVX'].includes(ticker) ? 'Energy' : 'Unknown'),
      };
    });
  }

  return fixture.positions.map(p => ({
    ticker: p.instrument.id.ticker.toUpperCase(),
    holding: p.holding,
    weight: p.weight ?? 0,
    sector: p.sector ?? 'Unknown',
  }));
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/** Align series on common session dates; build holdings-weighted portfolio values + per-asset returns. */
function buildAlignedSeries(
  positions: Pos[],
  priceHistory: PriceHistory
): {
  tickers: string[];
  weights: number[];
  portfolioValues: number[];
  assetReturns: number[][];
  assetVols: number[];
  marketDataSource: string;
} {
  const byTicker = new Map(
    priceHistory.series.map(s => [s.instrument.id.ticker.toUpperCase(), s])
  );
  const usable = positions.filter(p => {
    const s = byTicker.get(p.ticker);
    return s && s.bars.length >= 2;
  });
  if (usable.length === 0) {
    throw new Error('priceHistory has no usable series for portfolio tickers');
  }

  // Common dates present in every series.
  let dates: string[] | null = null;
  for (const p of usable) {
    const set = new Set(byTicker.get(p.ticker)!.bars.map(b => b.date).filter(Boolean));
    dates = dates ? dates.filter(d => set.has(d)) : [...set].sort();
  }
  const commonDates = (dates ?? []).sort();
  if (commonDates.length < 3) {
    throw new Error(`Insufficient overlapping sessions (${commonDates.length}) for risk metrics`);
  }

  const closeMaps = new Map<string, Map<string, number>>();
  for (const p of usable) {
    const map = new Map<string, number>();
    for (const b of byTicker.get(p.ticker)!.bars) {
      if (b.date && Number.isFinite(b.close)) map.set(b.date, b.close);
    }
    closeMaps.set(p.ticker, map);
  }

  const portfolioValues: number[] = [];
  for (const date of commonDates) {
    let mv = 0;
    for (const p of usable) {
      const close = closeMaps.get(p.ticker)!.get(date)!;
      mv += p.holding * close;
    }
    portfolioValues.push(mv);
  }

  const assetReturns: number[][] = [];
  const assetVols: number[] = [];
  const tickers: string[] = [];
  const weights: number[] = [];
  const weightSum = usable.reduce((s, p) => s + p.weight, 0) || 1;

  for (const p of usable) {
    const prices = commonDates.map(d => closeMaps.get(p.ticker)!.get(d)!);
    const ret = calculateReturns({
      prices,
      method: 'simple',
      annualize: false,
      annualizationFactor: ANNUALIZATION,
    });
    assetReturns.push(ret.returns);
    const vol = calculateReturns({
      prices,
      method: 'log',
      annualize: true,
      annualizationFactor: ANNUALIZATION,
    });
    assetVols.push(vol.standardDeviationAnnualized ?? 0);
    tickers.push(p.ticker);
    weights.push(p.weight / weightSum);
  }

  const sources = [
    ...new Set(usable.map(p => byTicker.get(p.ticker)!.source).filter(Boolean)),
  ];
  return {
    tickers,
    weights,
    portfolioValues,
    assetReturns,
    assetVols,
    marketDataSource: sources.join(',') || 'unknown',
  };
}

async function analyseWithToolkit(
  portfolio: Fdc3Portfolio | undefined,
  priceHistory: PriceHistory
): Promise<PortfolioRisk> {
  const positions = positionsFromPortfolio(portfolio);
  const herfindahl = positions.reduce((s, p) => s + p.weight * p.weight, 0);
  const bySector = new Map<string, number>();
  for (const p of positions) bySector.set(p.sector, (bySector.get(p.sector) ?? 0) + p.weight);
  const energyWeight =
    bySector.get('Energy') ??
    positions
      .filter(p => ['SHEL', 'XOM', 'CVX'].includes(p.ticker))
      .reduce((s, p) => s + p.weight, 0);
  const sorted = [...positions].sort((a, b) => b.weight - a.weight);
  const portfolioId =
    portfolio?.id?.portfolioId ?? loadPortfolioFixture().id?.portfolioId ?? 'unknown';

  const aligned = buildAlignedSeries(positions, priceHistory);
  const macro = await getMacroSnapshot();
  // Fed funds is percent (e.g. 5.33) → decimal annual rf.
  const riskFreeRate = macro.fedFunds.value / 100;

  const pm = calculatePortfolioMetrics({
    portfolioValues: aligned.portfolioValues,
    riskFreeRate,
    annualizationFactor: ANNUALIZATION,
    confidenceLevel: 0.95,
  });

  const corr = calculateCorrelationMatrix({
    returns: aligned.assetReturns,
    labels: aligned.tickers,
  });

  const portVol = calculatePortfolioVolatility({
    weights: aligned.weights,
    returns: aligned.assetReturns,
    annualizationFactor: ANNUALIZATION,
  });

  // Marginal risk ≈ weight × asset vol (simple contribution ranking).
  const contrib = aligned.tickers.map((ticker, i) => {
    const pos = positions.find(p => p.ticker === ticker);
    const weight = pos?.weight ?? aligned.weights[i]!;
    const riskContribution = weight * (aligned.assetVols[i] ?? 0);
    return { ticker, weight, riskContribution: round4(riskContribution) };
  });
  contrib.sort((a, b) => b.riskContribution - a.riskContribution);

  return {
    type: 'demo.portfolioRisk',
    portfolioId,
    asOf: new Date().toISOString(),
    concentration: [...bySector.entries()].map(([sector, weight]) => ({
      sector,
      weight: round4(weight),
    })),
    topContributors: contrib.slice(0, 5),
    metrics: {
      herfindahl: round4(herfindahl),
      energyWeight: round4(energyWeight),
      largestPositionWeight: sorted[0]?.weight ?? 0,
      volatility: round4(portVol.annualizedVolatility || pm.volatility),
      var95: round4(pm.valueAtRisk),
      expectedShortfall95: round4(pm.expectedShortfall),
      sharpe: round4(pm.sharpeRatio),
      maxDrawdown: round4(pm.maxDrawdownPercent),
    },
    correlation: {
      tickers: corr.labels.length ? corr.labels : aligned.tickers,
      matrix: corr.matrix.map(row => row.map(round4)),
    },
    provenance: {
      analysisId: randomUUID(),
      source: 'aipa-risk-finance-toolkit',
      marketDataSource: aligned.marketDataSource,
      lookbackDays: priceHistory.lookbackDays,
      riskFreeRate: round4(riskFreeRate),
    },
  };
}

async function stress(
  req: StressScenarioRequest,
  portfolio?: Fdc3Portfolio,
  priceHistory?: PriceHistory
): Promise<StressScenarioResult> {
  const macro = await getMacroSnapshot();
  const oilShock = req.scenario.oilPriceShockPct ?? -20;
  const rateShock = req.scenario.rateShockBps ?? 0;
  const positions = positionsFromPortfolio(portfolio ?? req.portfolio);
  const bySector = new Map<string, number>();
  for (const p of positions) bySector.set(p.sector, (bySector.get(p.sector) ?? 0) + p.weight);
  const energyWeight = bySector.get('Energy') ?? 0;
  const techWeight = bySector.get('Technology') ?? 0;
  const finWeight = bySector.get('Financials') ?? 0;

  // Default betas; scale with historical vols when price history is present.
  let oilBeta = 0.55;
  let rateBeta = -0.05;
  let energyVolScale = 1;
  let techVolScale = 1;
  let finVolScale = 1;

  const history = priceHistory ?? req.priceHistory;
  if (history?.series?.length) {
    try {
      const aligned = buildAlignedSeries(positions, history);
      const volByTicker = new Map(aligned.tickers.map((t, i) => [t, aligned.assetVols[i] ?? 0]));
      const avgVol =
        aligned.assetVols.reduce((s, v) => s + v, 0) / (aligned.assetVols.length || 1) || 0.2;
      const sectorVol = (sector: string) => {
        const tickers = positions.filter(p => p.sector === sector).map(p => p.ticker);
        if (!tickers.length) return avgVol;
        const vols = tickers.map(t => volByTicker.get(t) ?? avgVol);
        return vols.reduce((s, v) => s + v, 0) / vols.length;
      };
      energyVolScale = sectorVol('Energy') / avgVol;
      techVolScale = sectorVol('Technology') / avgVol;
      finVolScale = sectorVol('Financials') / avgVol;
      oilBeta = 0.4 + 0.35 * energyVolScale;
    } catch {
      /* keep defaults */
    }
  }

  const change =
    (oilShock / 100) * oilBeta * (energyWeight + 0.15) +
    (rateShock / 10000) * rateBeta * 100 * (finWeight + techWeight + 0.3);

  return {
    type: 'demo.stressScenarioResult',
    portfolioId: req.portfolioId,
    scenarioName: req.scenario.name,
    asOf: new Date().toISOString(),
    portfolioValueChangePct: round2(change * 100),
    sectorImpacts: [
      {
        sector: 'Energy',
        changePct: round2(oilShock * 0.8 * energyVolScale),
      },
      {
        sector: 'Technology',
        changePct: round2((oilShock * 0.05 + rateShock * -0.01) * techVolScale),
      },
      {
        sector: 'Financials',
        changePct: round2(rateShock * -0.02 * finVolScale),
      },
    ],
    provenance: {
      resultId: randomUUID(),
      macroSource: `${macro.oil.source}:${macro.oil.seriesId}=${macro.oil.value}`,
    },
  };
}

export default async function backend(
  app: Application,
  server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): Promise<void> {
  const signer = await createAppSigner('aipa-risk', `http://localhost:${opts.port}`);
  mountSigningRoutes(app, signer, server);

  app.post('/api/analyse', async (req, res) => {
    try {
      const portfolio = req.body?.portfolio as Fdc3Portfolio | undefined;
      const priceHistory = req.body?.priceHistory as PriceHistory | undefined;
      if (!priceHistory?.series?.length) {
        res.status(400).json({
          error: 'priceHistory required (raise demo.GetPriceHistory on Market Data first)',
        });
        return;
      }
      const risk = await analyseWithToolkit(portfolio, priceHistory);
      const envelope = await signer.signContext(risk as unknown as Record<string, unknown>);
      res.json(envelope);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/stress', async (req, res) => {
    try {
      const body = req.body as StressScenarioRequest & {
        portfolio?: Fdc3Portfolio;
        priceHistory?: PriceHistory;
      };
      if (!body?.portfolioId || !body?.scenario) {
        res.status(400).json({ error: 'stressScenarioRequest required' });
        return;
      }
      const result = await stress(body, body.portfolio, body.priceHistory);
      const envelope = await signer.signContext(result as unknown as Record<string, unknown>);
      res.json(envelope);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/macro', async (_req, res) => {
    res.json(await getMacroSnapshot());
  });

  app.get('/api/portfolio', (_req, res) => {
    const fixture = loadPortfolioFixture();
    res.json({ portfolio: toFdc3Portfolio(fixture), positions: fixture.positions });
  });
}
