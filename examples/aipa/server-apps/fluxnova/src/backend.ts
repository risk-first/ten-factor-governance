import type { Application } from 'express';
import type { Server } from 'http';
import { createAppSigner, mountSigningRoutes } from '../../../common/src/security/signing.js';
import { ordersFromContext } from '../../../common/src/contexts/types.js';
import { resolveRequester, supervisorOf } from './org.js';
import {
  BRIDGE_APP_ID,
  CONTEXT_TYPES,
  ORDER_APPROVAL_PROCESS_KEY,
  PROCESS_KEY,
  type ApprovalRecord,
} from './types.js';
import {
  ENGINE_UNREACHABLE,
  EngineUnreachableError,
  completeTask,
  ensureProcessDeployed,
  getTask,
  getTaskDecision,
  listCompletedTasks,
  listTasks,
  pingEngine,
  startCreateTask,
  startOrderApproval,
} from './engine.js';

function engineError(res: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof EngineUnreachableError ? 503 : 502;
  res.status(code).json({ error: message });
}

function summarizeOrders(ctx: unknown): {
  orderSummary: string;
  ticker?: string;
  side?: string;
  quantity?: string;
} {
  const orders = ordersFromContext(ctx);
  if (orders.length === 1) {
    const order = orders[0];
    const ticker = order.instrument?.id?.ticker;
    const side = order.side;
    const quantity = order.quantity != null ? String(order.quantity) : undefined;
    return {
      orderSummary: `${side ?? ''} ${quantity ?? ''} ${ticker ?? ''}`.trim() || 'Order',
      ticker,
      side,
      quantity,
    };
  }
  if (orders.length > 1) {
    return { orderSummary: `${orders.length} order legs` };
  }
  const type = ctx && typeof ctx === 'object' ? (ctx as { type?: string }).type : undefined;
  return { orderSummary: type || 'Approval subject' };
}

export default async function backend(
  app: Application,
  server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): Promise<void> {
  const signer = await createAppSigner(BRIDGE_APP_ID, `http://localhost:${opts.port}`);
  mountSigningRoutes(app, signer, server);

  void ensureProcessDeployed(opts.appRoot).catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Fluxnova process deploy skipped: ${message}`);
  });

  app.get('/api/engine', async (_req, res) => {
    const ok = await pingEngine();
    if (!ok) {
      res.status(503).json({ ok: false, error: ENGINE_UNREACHABLE });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/tasks', async (req, res) => {
    try {
      await ensureProcessDeployed(opts.appRoot);
      const processInstanceId =
        typeof req.query.processInstanceId === 'string' ? req.query.processInstanceId : undefined;
      const processDefinitionKey =
        typeof req.query.processDefinitionKey === 'string' ? req.query.processDefinitionKey : undefined;
      res.json({ tasks: await listTasks({ processInstanceId, processDefinitionKey }) });
    } catch (error) {
      engineError(res, error);
    }
  });

  app.get('/api/tasks/:id', async (req, res) => {
    try {
      const task = await getTask(req.params.id);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.json(task);
    } catch (error) {
      engineError(res, error);
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      await ensureProcessDeployed(opts.appRoot, PROCESS_KEY);
      const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
      const description = typeof req.body?.description === 'string' ? req.body.description : undefined;
      const assignee = typeof req.body?.assignee === 'string' ? req.body.assignee : undefined;
      res.json(await startCreateTask({ name, description, assignee }));
    } catch (error) {
      engineError(res, error);
    }
  });

  app.post('/api/tasks/:id/complete', async (req, res) => {
    try {
      await completeTask(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      engineError(res, error);
    }
  });

  app.get('/api/history/tasks', async (req, res) => {
    try {
      const finishedAfter =
        typeof req.query.finishedAfter === 'string' ? req.query.finishedAfter : undefined;
      const maxResults =
        typeof req.query.maxResults === 'string' ? Number(req.query.maxResults) : undefined;
      const processDefinitionKey =
        typeof req.query.processDefinitionKey === 'string' ? req.query.processDefinitionKey : undefined;
      res.json({
        tasks: await listCompletedTasks({
          finishedAfter,
          processDefinitionKey,
          maxResults: Number.isFinite(maxResults) ? maxResults : undefined,
        }),
      });
    } catch (error) {
      engineError(res, error);
    }
  });

  app.get('/api/history/tasks/:processInstanceId/decision', async (req, res) => {
    try {
      const decision = await getTaskDecision(req.params.processInstanceId);
      res.json({ decision: decision ?? null });
    } catch (error) {
      engineError(res, error);
    }
  });

  app.post('/api/approvals/start', async (req, res) => {
    try {
      await ensureProcessDeployed(opts.appRoot, ORDER_APPROVAL_PROCESS_KEY);
      const incoming = req.body?.approval as ApprovalRecord | undefined;
      if (!incoming || typeof incoming !== 'object') {
        res.status(400).json({ error: 'body.approval required' });
        return;
      }
      const raiserAppId = typeof req.body?.raiserAppId === 'string' ? req.body.raiserAppId : undefined;
      const requester = resolveRequester({
        requester: typeof incoming.requester === 'string' ? incoming.requester : undefined,
        raiserAppId,
      });
      const approver = supervisorOf(requester);
      const subjectContext = incoming.subject?.context;
      const summary = summarizeOrders(subjectContext);
      const name =
        (typeof incoming.name === 'string' && incoming.name.trim()) ||
        `Approve ${summary.orderSummary}`;
      const description =
        typeof incoming.reason === 'string' && incoming.reason.trim()
          ? incoming.reason.trim()
          : `Requester ${requester}; approver ${approver}`;

      const started = await startOrderApproval({
        name,
        description,
        requester,
        approver,
        orderSummary: summary.orderSummary,
        ticker: summary.ticker,
        side: summary.side,
        quantity: summary.quantity,
        approvalJson: JSON.stringify(incoming),
      });

      const approval: ApprovalRecord = {
        ...incoming,
        type: CONTEXT_TYPES.approval,
        id: {
          ...incoming.id,
          processInstanceId: started.processInstanceId,
        },
        requester,
        status: incoming.status ?? 'pending',
        updatedAt: incoming.updatedAt ?? new Date().toISOString(),
      };

      res.json({
        processInstanceId: started.processInstanceId,
        taskId: started.taskId,
        approval,
        requester,
        approver,
      });
    } catch (error) {
      engineError(res, error);
    }
  });
}
