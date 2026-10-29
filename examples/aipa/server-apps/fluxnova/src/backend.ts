import type { Application } from 'express';
import type { Server } from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { createAppSigner, mountSigningRoutes } from '../../../common/src/security/signing.js';
import { ordersFromContext } from '../../../common/src/contexts/types.js';
import { loadEntraConfig } from './config.js';
import { JWTValidator } from './jwt-validator.js';
import { resolveRequester, sessionMatchesAssignee, supervisorOf } from './org.js';
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
  getTaskDecision,
  getTaskSnapshot,
  listCompletedSnapshots,
  listOpenSnapshots,
  pingEngine,
  startCreateTask,
  startOrderApproval,
} from './engine.js';

type SessionUser = { email: string; name: string };

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
  dotenv.config({ path: path.join(opts.appRoot, '.env') });
  const entraConfig = loadEntraConfig(opts.appRoot);
  const validator = new JWTValidator(entraConfig);
  const signer = await createAppSigner(BRIDGE_APP_ID, `http://localhost:${opts.port}`);
  mountSigningRoutes(app, signer, server);

  let user: SessionUser | null = null;

  app.get('/api/config', (_req, res) => {
    res.json(entraConfig);
  });

  app.get('/api/session', (_req, res) => {
    res.json({ user });
  });

  app.post('/api/session', async (req, res) => {
    const jwt = typeof req.body?.wrappedJwt === 'string' ? req.body.wrappedJwt : '';
    const { valid, claims, error } = await validator.validateToken(jwt);
    if (!valid || !claims) {
      res.status(401).json({ error: error ?? 'Invalid Entra token' });
      return;
    }
    user = {
      email: (claims.email as string) || (claims.preferred_username as string) || '',
      name: (claims.name as string) || (claims.given_name as string) || '',
    };
    res.json({ user });
  });

  app.post('/api/logout', (_req, res) => {
    user = null;
    res.json({ user: null });
  });

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
      const historic = req.query.historic === 'true';
      if (historic) {
        const finishedAfter =
          typeof req.query.finishedAfter === 'string' ? req.query.finishedAfter : undefined;
        const maxResults =
          typeof req.query.maxResults === 'string' ? Number(req.query.maxResults) : undefined;
        res.json({
          tasks: await listCompletedSnapshots({
            finishedAfter,
            maxResults: Number.isFinite(maxResults) ? maxResults : 20,
          }),
        });
        return;
      }
      res.json({ tasks: await listOpenSnapshots() });
    } catch (error) {
      engineError(res, error);
    }
  });

  app.get('/api/tasks/:id', async (req, res) => {
    try {
      const task = await getTaskSnapshot(req.params.id);
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
      const started = await startCreateTask({ name, description, assignee });
      const task = started.taskId ? await getTaskSnapshot(started.taskId) : undefined;
      res.json({ ...started, task: task ?? null });
    } catch (error) {
      engineError(res, error);
    }
  });

  app.post('/api/tasks/:id/complete', async (req, res) => {
    if (!user) {
      res.status(401).json({ error: 'Sign in with Microsoft before completing a task' });
      return;
    }
    try {
      const decision = req.body?.decision;
      if (decision != null && decision !== 'approved' && decision !== 'rejected') {
        res.status(400).json({ error: 'decision must be approved or rejected' });
        return;
      }
      const existing = await getTaskSnapshot(req.params.id);
      const assignee = existing?.approver ?? existing?.assignee;
      if (!sessionMatchesAssignee(user, assignee)) {
        res.status(403).json({
          error: `Signed in as ${user.email}; task is assigned to ${assignee ?? 'nobody'}`,
        });
        return;
      }
      await completeTask(req.params.id, decision);
      const snapshot = await getTaskSnapshot(req.params.id);
      res.json({ ok: true, task: snapshot ?? null });
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
        tasks: await listCompletedSnapshots({
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
      const configured =
        typeof incoming.approver === 'string' && incoming.approver.trim()
          ? incoming.approver.trim()
          : undefined;
      const approver = configured ?? supervisorOf(requester);
      const subjectContext = incoming.subject?.context;
      const summary = summarizeOrders(subjectContext);
      const name =
        (typeof incoming.name === 'string' && incoming.name.trim()) ||
        `Approve ${summary.orderSummary}`;
      const description =
        typeof incoming.reason === 'string' && incoming.reason.trim()
          ? incoming.reason.trim()
          : `Requester ${requester}; approver ${approver}`;

      const approval: ApprovalRecord = {
        ...incoming,
        type: CONTEXT_TYPES.approval,
        id: { ...incoming.id },
        requester,
        approver,
        status: incoming.status ?? 'pending',
        updatedAt: incoming.updatedAt ?? new Date().toISOString(),
      };

      const started = await startOrderApproval({
        name,
        description,
        requester,
        approver,
        orderSummary: summary.orderSummary,
        ticker: summary.ticker,
        side: summary.side,
        quantity: summary.quantity,
        approvalJson: JSON.stringify(approval),
      });

      approval.id = {
        ...approval.id,
        processInstanceId: started.processInstanceId,
      };

      const task = started.taskId ? await getTaskSnapshot(started.taskId) : undefined;
      res.json({
        processInstanceId: started.processInstanceId,
        taskId: started.taskId,
        approval,
        requester,
        approver,
        task: task ?? null,
      });
    } catch (error) {
      engineError(res, error);
    }
  });
}
