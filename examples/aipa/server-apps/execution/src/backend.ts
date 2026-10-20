import type { Application } from 'express';
import type { Server } from 'http';
import { randomUUID } from 'node:crypto';
import { createAppSigner, mountSigningRoutes } from '../../../common/src/security/signing.js';
import {
  applyFillsToPortfolio,
  fillsFromOrderList,
  loadLivePortfolio,
  saveLivePortfolio,
} from '../../../common/src/data/portfolio.js';

export default async function backend(
  app: Application,
  server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): Promise<void> {
  const signer = await createAppSigner('aipa-execution', `http://localhost:${opts.port}`);
  mountSigningRoutes(app, signer, server);

  app.post('/api/submit', async (req, res) => {
    const orderList = req.body?.orderList ?? req.body;
    const meta = req.body?.__appMeta as { signature?: string } | undefined;
    let verify: { ok: boolean; warning?: string } = { ok: true };
    if (!meta?.signature) {
      verify = {
        ok: false,
        warning: 'Inbound SubmitOrders raise unsigned (acceptable until AI Assistant signs).',
      };
    } else {
      verify = {
        ok: false,
        warning: 'Inbound signature present; cross-app JWKS trust allowlist not yet configured.',
      };
    }

    const fills = fillsFromOrderList(orderList);
    const { portfolio, applied } = applyFillsToPortfolio(loadLivePortfolio(), fills);
    saveLivePortfolio(portfolio);
    const summary = applied
      .map(f => `${f.side} ${f.quantity} ${f.ticker}`)
      .join(', ');

    const result = {
      type: 'fdc3.transactionResult',
      status: 'Created',
      context: orderList,
      message: applied.length
        ? `Filled ${applied.length} order(s); live portfolio updated (${summary}).`
        : 'No fillable orders; live portfolio unchanged.',
      id: { transactionId: randomUUID() },
    };

    const envelope = await signer.signContext(result as unknown as Record<string, unknown>);
    res.json({ envelope, verify });
  });
}
