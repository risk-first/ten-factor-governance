import type { Application } from 'express';
import type { Server } from 'http';
import { randomUUID } from 'node:crypto';
import { createAppSigner, mountSigningRoutes } from '../../../common/src/security/signing.js';
import {
  CONTEXT_TYPES,
  isDemoOrderList,
  ordersFromContext,
  type DemoOrder,
  type DemoOrderList,
  type DemoOrderOrList,
} from '../../../common/src/contexts/types.js';

function defaultOrders(): DemoOrder[] {
  return [
    {
      type: 'demo.order',
      id: { orderId: randomUUID() },
      instrument: { type: 'fdc3.instrument', id: { ticker: 'SHEL' }, name: 'Shell' },
      side: 'sell',
      quantity: 1000,
      orderType: 'market',
    },
    {
      type: 'demo.order',
      id: { orderId: randomUUID() },
      instrument: { type: 'fdc3.instrument', id: { ticker: 'NVDA' }, name: 'NVIDIA' },
      side: 'buy',
      quantity: 200,
      orderType: 'market',
    },
  ];
}

function normalizeOrder(incoming: Partial<DemoOrder> | undefined): DemoOrder {
  const ticker = incoming?.instrument?.id?.ticker?.trim().toUpperCase();
  const qty = Number(incoming?.quantity);
  return {
    type: 'demo.order',
    id: incoming?.id?.orderId ? incoming.id : { orderId: randomUUID() },
    name: incoming?.name ?? incoming?.instrument?.name,
    instrument: {
      type: 'fdc3.instrument',
      id: { ticker: ticker || 'NVDA' },
      name: incoming?.instrument?.name,
    },
    side: incoming?.side === 'sell' ? 'sell' : 'buy',
    quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 200,
    orderType: incoming?.orderType ?? 'market',
  };
}

function inboundVerify(meta: { signature?: string } | undefined): { ok: boolean; warning?: string } {
  if (meta?.signature) {
    return {
      ok: false,
      warning:
        'Inbound signature present but not verifiable with local JWKS (expected until the raiser JWKS is trusted).',
    };
  }
  return { ok: true };
}

function incomingContext(body: { order?: unknown; metadata?: unknown }): unknown {
  const wrapped = body?.order;
  if (wrapped && typeof wrapped === 'object') return wrapped;
  const { order: _order, metadata: _meta, ...rest } = body ?? {};
  return rest;
}

export default async function backend(
  app: Application,
  server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): Promise<void> {
  const signer = await createAppSigner('aipa-order-entry', `http://localhost:${opts.port}`);
  mountSigningRoutes(app, signer, server);

  app.post('/api/create', async (req, res) => {
    const incoming = incomingContext(req.body ?? {});
    const meta = req.body?.metadata as { signature?: string } | undefined;
    const listIn = isDemoOrderList(incoming) ? incoming : undefined;
    const legs = ordersFromContext(incoming).map(normalizeOrder);
    const orders = legs.length > 0 ? legs : defaultOrders();
    const result: DemoOrderOrList =
      listIn || orders.length !== 1
        ? ({
            type: CONTEXT_TYPES.demoOrderList,
            id: listIn?.id ?? { listId: randomUUID() },
            name: listIn?.name,
            orders,
          } satisfies DemoOrderList)
        : orders[0];
    const envelope = await signer.signContext(result as unknown as Record<string, unknown>);
    res.json({ envelope, verify: inboundVerify(meta) });
  });
}
