import type { Application } from 'express';
import type { Server } from 'http';
import { randomUUID } from 'node:crypto';
import { createAppSigner, mountSigningRoutes } from '../../../common/src/security/signing.js';
import { loadPortfolioFixture } from '../../../common/src/data/portfolio.js';
import { getMacroSnapshot } from '../../../common/src/data/fred.js';
import type {
  Fdc3Portfolio,
  PortfolioRisk,
  StressScenarioRequest,
  StressScenarioResult,
} from '../../../common/src/contexts/types.js';

type Pos = { ticker: string; weight: number; sector: string };

function positionsFromPortfolio(portfolio?: Fdc3Portfolio): Pos[] {
  if (portfolio?.positions?.length) {
    return portfolio.positions.map(p => ({
      ticker: p.instrument.id.ticker,
      weight: p.weight ?? 0,
      sector: 'Unknown',
    }));
  }
  const fixture = loadPortfolioFixture();
  return fixture.positions.map(p => ({
    ticker: p.instrument.id.ticker,
    weight: p.weight ?? 0,
    sector: p.sector ?? 'Unknown',
  }));
}

function analyse(portfolio?: Fdc3Portfolio): PortfolioRisk {
  const positions = positionsFromPortfolio(portfolio);
  const herfindahl = positions.reduce((s, p) => s + p.weight * p.weight, 0);
  const bySector = new Map<string, number>();
  for (const p of positions) bySector.set(p.sector, (bySector.get(p.sector) ?? 0) + p.weight);
  const energyWeight = bySector.get('Energy') ?? positions.filter(p => ['SHEL', 'XOM', 'CVX'].includes(p.ticker)).reduce((s, p) => s + p.weight, 0);
  const sorted = [...positions].sort((a, b) => b.weight - a.weight);
  const portfolioId =
    portfolio?.id?.portfolioId ?? loadPortfolioFixture().id?.portfolioId ?? 'unknown';

  return {
    type: 'demo.portfolioRisk',
    portfolioId,
    asOf: new Date().toISOString(),
    concentration: [...bySector.entries()].map(([sector, weight]) => ({ sector, weight })),
    topContributors: sorted.slice(0, 5).map(p => ({
      ticker: p.ticker,
      weight: p.weight,
      riskContribution: Number((p.weight * herfindahl * 10).toFixed(4)),
    })),
    metrics: {
      herfindahl: Number(herfindahl.toFixed(4)),
      energyWeight: Number(energyWeight.toFixed(4)),
      largestPositionWeight: sorted[0]?.weight ?? 0,
    },
    provenance: { analysisId: randomUUID(), source: 'aipa-risk-deterministic' },
  };
}

async function stress(req: StressScenarioRequest): Promise<StressScenarioResult> {
  const macro = await getMacroSnapshot();
  const oilShock = req.scenario.oilPriceShockPct ?? -20;
  const rateShock = req.scenario.rateShockBps ?? 0;
  const oilBeta = 0.55;
  const rateBeta = -0.05;
  const change =
    (oilShock / 100) * oilBeta * (analyse().metrics.energyWeight + 0.2) + (rateShock / 10000) * rateBeta * 100;

  return {
    type: 'demo.stressScenarioResult',
    portfolioId: req.portfolioId,
    scenarioName: req.scenario.name,
    asOf: new Date().toISOString(),
    portfolioValueChangePct: Number((change * 100).toFixed(2)),
    sectorImpacts: [
      { sector: 'Energy', changePct: Number((oilShock * 0.8).toFixed(2)) },
      { sector: 'Technology', changePct: Number((oilShock * 0.05 + rateShock * -0.01).toFixed(2)) },
      { sector: 'Financials', changePct: Number((rateShock * -0.02).toFixed(2)) },
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
    const risk = analyse(req.body?.portfolio as Fdc3Portfolio | undefined);
    const envelope = await signer.signContext(risk as unknown as Record<string, unknown>);
    res.json(envelope);
  });

  app.post('/api/stress', async (req, res) => {
    const body = req.body as StressScenarioRequest;
    if (!body?.portfolioId || !body?.scenario) {
      res.status(400).json({ error: 'stressScenarioRequest required' });
      return;
    }
    const result = await stress(body);
    const envelope = await signer.signContext(result as unknown as Record<string, unknown>);
    res.json(envelope);
  });

  app.get('/api/macro', async (_req, res) => {
    res.json(await getMacroSnapshot());
  });
}
