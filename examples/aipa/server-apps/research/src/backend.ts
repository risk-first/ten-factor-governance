import type { Application } from 'express';
import type { Server } from 'http';
import { randomUUID } from 'node:crypto';
import { createAppSigner, mountSigningRoutes } from '../../../common/src/security/signing.js';
import { getCompanyNews } from '../../../common/src/data/finnhub.js';
import { getRecentFilings } from '../../../common/src/data/edgar.js';
import { RESEARCH_BUNDLE_TTL_MS, researchDataCache } from '../../../common/src/data/ttlCache.js';
import type { ResearchBundle, ResearchFinding } from '../../../common/src/contexts/types.js';

function tickersFromBody(body: unknown): string[] {
  if (!body || typeof body !== 'object') return ['SHEL'];
  const ctx = body as Record<string, unknown>;
  if (typeof ctx.tickers === 'string') {
    return String(ctx.tickers)
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
  }
  if (Array.isArray(ctx.tickers)) return (ctx.tickers as string[]).map(t => t.toUpperCase());
  if (ctx.type === 'fdc3.instrument') {
    return [String((ctx.id as { ticker?: string })?.ticker ?? 'SHEL').toUpperCase()];
  }
  if (ctx.type === 'fdc3.instrumentList' && Array.isArray(ctx.instruments)) {
    return (ctx.instruments as Array<{ id?: { ticker?: string } }>)
      .map(i => String(i.id?.ticker ?? '').toUpperCase())
      .filter(Boolean);
  }
  if (ctx.type === 'fdc3.portfolio' && Array.isArray(ctx.positions)) {
    return (ctx.positions as Array<{ instrument?: { id?: { ticker?: string } } }>)
      .map(p => String(p.instrument?.id?.ticker ?? '').toUpperCase())
      .filter(Boolean)
      .slice(0, 5);
  }
  return ['SHEL', 'XOM', 'NVDA'];
}

async function buildBundle(tickers: string[], portfolioId?: string): Promise<ResearchBundle> {
  const findings: ResearchFinding[] = [];
  const sources = new Set<string>();
  const to = new Date();
  const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  for (const ticker of tickers.slice(0, 4)) {
    const filings = await getRecentFilings(ticker);
    for (const f of filings) {
      sources.add(f.source);
      findings.push({
        title: `${ticker} ${f.form} (${f.filingDate})`,
        summary: `SEC ${f.form} filing for ${ticker}.`,
        sourceUrl: f.url,
        sourceType: f.source === 'edgar' ? 'filing' : 'fixture',
        publishedAt: `${f.filingDate}T00:00:00.000Z`,
        tickers: [ticker],
      });
    }
    const news = await getCompanyNews(ticker, fromStr, toStr);
    sources.add(news.source);
    for (const n of news.items.slice(0, 3)) {
      findings.push({
        title: n.headline,
        summary: n.summary || n.headline,
        sourceUrl: n.url,
        sourceType: news.source === 'finnhub' ? 'news' : 'fixture',
        publishedAt: new Date((n.datetime || Date.now() / 1000) * 1000).toISOString(),
        tickers: [ticker],
      });
    }
  }

  return {
    type: 'demo.researchBundle',
    subject: { portfolioId, tickers },
    asOf: new Date().toISOString(),
    findings,
    provenance: { bundleId: randomUUID(), sources: [...sources] },
  };
}

function bundleCacheKey(tickers: string[], portfolioId?: string): string {
  return `bundle:${tickers.join(',')}:${portfolioId ?? ''}`;
}

export default async function backend(
  app: Application,
  server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): Promise<void> {
  const signer = await createAppSigner('aipa-research', `http://localhost:${opts.port}`);
  mountSigningRoutes(app, signer, server);

  app.post('/api/research', async (req, res) => {
    const tickers = tickersFromBody(req.body?.context ?? req.body);
    const portfolioId =
      req.body?.context?.id?.portfolioId ?? req.body?.portfolioId ?? undefined;
    const key = bundleCacheKey(tickers, portfolioId);
    const bundle = await researchDataCache.getOrLoad(
      key,
      () => buildBundle(tickers, portfolioId),
      RESEARCH_BUNDLE_TTL_MS
    );
    // Sign per response so envelope timestamps stay fresh while findings stay cached.
    const envelope = await signer.signContext(bundle as unknown as Record<string, unknown>);
    res.json(envelope);
  });
}
