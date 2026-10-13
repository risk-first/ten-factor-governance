import type { Application } from 'express';
import type { Server } from 'http';
import { randomUUID } from 'node:crypto';
import { createAppSigner, mountSigningRoutes } from '../../../common/src/security/signing.js';
import type { OrderProposal, PortfolioRecommendation } from '../../../common/src/contexts/types.js';

function proposalFromRecommendation(rec: PortfolioRecommendation): OrderProposal {
  const orders = (rec.targetChanges ?? [])
    .filter(c => c.action !== 'hold')
    .map(c => ({
      instrument: { type: 'fdc3.instrument' as const, id: { ticker: c.ticker } },
      side: c.action === 'buy' ? ('buy' as const) : ('sell' as const),
      quantity: Math.max(1, Math.round(Math.abs(c.targetWeight) * 10000)),
      orderType: 'market' as const,
    }));

  return {
    type: 'demo.orderProposal',
    proposalId: randomUUID(),
    portfolioId: rec.portfolioId,
    orders:
      orders.length > 0
        ? orders
        : [
            {
              instrument: { type: 'fdc3.instrument', id: { ticker: 'SHEL' } },
              side: 'sell',
              quantity: 1000,
              orderType: 'market',
            },
            {
              instrument: { type: 'fdc3.instrument', id: { ticker: 'NVDA' } },
              side: 'buy',
              quantity: 200,
              orderType: 'market',
            },
          ],
    asOf: new Date().toISOString(),
  };
}

export default async function backend(
  app: Application,
  server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): Promise<void> {
  const signer = await createAppSigner('aipa-order-entry', `http://localhost:${opts.port}`);
  mountSigningRoutes(app, signer, server);

  app.post('/api/propose', async (req, res) => {
    const incoming = (req.body?.recommendation ?? req.body ?? {}) as Partial<PortfolioRecommendation>;
    const meta = req.body?.__appMeta as { signature?: string } | undefined;
    let verify: { ok: boolean; warning?: string };
    if (meta?.signature) {
      verify = {
        ok: false,
        warning:
          'Inbound signature present but not verifiable with local JWKS (expected until Assistant JWKS is trusted).',
      };
    } else {
      verify = {
        ok: false,
        warning: 'Inbound recommendation unsigned (acceptable until AI Assistant signs raises).',
      };
    }

    const rec: PortfolioRecommendation = {
      type: 'demo.portfolioRecommendation',
      portfolioId: incoming.portfolioId ?? 'aipa-energy-demo-1',
      rationale: incoming.rationale ?? 'Reduce energy concentration toward 15%.',
      targetChanges: incoming.targetChanges ?? [
        { ticker: 'SHEL', targetWeight: 0.1, action: 'sell' },
        { ticker: 'XOM', targetWeight: 0.05, action: 'sell' },
        { ticker: 'NVDA', targetWeight: 0.2, action: 'buy' },
      ],
      evidenceRefs: incoming.evidenceRefs,
    };

    const proposal = proposalFromRecommendation(rec);
    const envelope = await signer.signContext(proposal as unknown as Record<string, unknown>);
    res.json({ envelope, verify });
  });
}
