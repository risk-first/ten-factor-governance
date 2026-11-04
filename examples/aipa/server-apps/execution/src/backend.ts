import type { Application } from 'express';
import type { Server } from 'http';
import { randomUUID } from 'node:crypto';
import { createAppSigner, mountSigningRoutes } from '../../../common/src/security/signing.js';
import {
  applyFillsToPortfolio,
  fillsFromOrders,
  loadLivePortfolio,
  saveLivePortfolio,
} from '../../../common/src/data/portfolio.js';
import { appendExecutionLog, loadExecutionLog } from '../../../common/src/data/execution-log.js';
import { toSignedResult } from '../../../common/src/security/envelope.js';

export default async function backend(
  app: Application,
  server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): Promise<void> {
  const signer = await createAppSigner('aipa-execution', `http://localhost:${opts.port}`);
  mountSigningRoutes(app, signer, server);

  app.get('/api/log', (_req, res) => {
    res.json(loadExecutionLog());
  });

  app.post('/api/submit', async (req, res) => {
    const order = req.body?.order ?? req.body;
    const meta = req.body?.metadata as { signature?: string } | undefined;
    let verify: { ok: boolean; warning?: string } = { ok: true };
    if (!meta?.signature) {
      verify = {
        ok: false,
        warning: 'Inbound SubmitOrder raise unsigned (acceptable until AI Assistant signs).',
      };
    } else {
      verify = {
        ok: false,
        warning: 'Inbound signature present; cross-app JWKS trust allowlist not yet configured.',
      };
    }

    const fills = fillsFromOrders(order);
    const { portfolio, applied } = applyFillsToPortfolio(loadLivePortfolio(), fills);
    saveLivePortfolio(portfolio);
    const summary = applied
      .map(f => `${f.side} ${f.quantity} ${f.ticker}`)
      .join(', ');

    const ok = applied.length > 0;
    const result = {
      type: 'fdc3.transactionResult',
      status: ok ? 'Created' : 'Failed',
      context: order,
      message: ok
        ? `Filled ${applied.length} order(s); live portfolio updated (${summary}).`
        : 'No fillable orders; live portfolio unchanged.',
      id: { transactionId: randomUUID() },
    };

    const envelope = await signer.signContext(result as unknown as Record<string, unknown>);
    const entry = {
      id: result.id.transactionId,
      at: new Date().toISOString(),
      order,
      result: toSignedResult(envelope).context,
    };
    appendExecutionLog(entry);
    res.json({ envelope, verify, entry });
  });
}
