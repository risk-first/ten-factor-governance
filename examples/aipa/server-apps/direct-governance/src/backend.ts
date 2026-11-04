import { randomUUID } from 'node:crypto';
import type { Application } from 'express';
import type { Server } from 'http';
import type { Context } from '@finos/fdc3-context';
import { DefaultFDC3Handlers, setupWebsocketServer, type BackendIntentHandler } from '@finos/fdc3-security';
import { INTENTS } from '../../../common/src/contexts/types.js';
import {
  asGovernanceDecision,
  controlEvaluation,
  fillEvaluationLog,
  type GovernanceDecisionContext,
} from '../../../common/src/governance/evaluation.js';
import {
  CTL_005,
  CTL_005_AR,
  CTL_005_PLAN,
  inspectSignature,
  type EvalResult,
  type SignatureCheck,
} from '../../../common/src/governance/refs.js';

const AUTHOR_ID = 'aipa-direct-governance';
const AUTHOR_NAME = 'Direct Governance';
const MAX_LOG = 50;

export type DirectDecision = {
  outcome: EvalResult;
  message: string;
  signature: SignatureCheck;
};

export type LogEntry = {
  id: string;
  at: string;
  source: 'live' | 'test';
  ms: number;
  activity: {
    intent: string;
    sourceAppId: string;
    targetAppId?: string;
    contextType?: string;
    signature?: string;
  };
  sent: Record<string, unknown>;
  decision: DirectDecision;
};

const decisionLog: LogEntry[] = [];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function activityFrom(decision: GovernanceDecisionContext): Record<string, unknown> {
  const subject = decision.subject;
  const targetAppId = subject.app?.appId;
  const sourceAppId =
    typeof decision.log.target?.id === 'string' && decision.log.target.id
      ? decision.log.target.id
      : 'unknown';
  const signature = inspectSignature({
    actorAppId: sourceAppId,
    signatureJku: typeof decision.signatureJku === 'string' ? decision.signatureJku : undefined,
    signaturePresent: decision.signaturePresent,
  });
  return {
    kind: 'raiseIntent',
    intent: typeof subject.intent === 'string' ? subject.intent : 'demo.SubmitOrder',
    ...(targetAppId ? { targetAppId } : {}),
    sourceAppId,
    signature,
    context: subject.context ?? {},
  };
}

function testActivity(): Record<string, unknown> {
  const date = new Date().toISOString();
  const sourceAppId = 'aipa-order-entry';
  return {
    kind: 'raiseIntent',
    intent: 'demo.SubmitOrder',
    targetAppId: 'aipa-execution',
    sourceAppId,
    signature: inspectSignature({ actorAppId: sourceAppId }),
    context: {
      type: 'demo.orderList',
      orders: [
        {
          type: 'demo.order',
          id: { orderId: 'direct-test-shel' },
          instrument: { type: 'fdc3.instrument', id: { ticker: 'SHEL' }, name: 'Shell' },
          side: 'sell',
          quantity: 1000,
          date,
          orderType: 'market',
        },
        {
          type: 'demo.order',
          id: { orderId: 'direct-test-nvda' },
          instrument: { type: 'fdc3.instrument', id: { ticker: 'NVDA' }, name: 'NVIDIA' },
          side: 'buy',
          quantity: 200,
          date,
          orderType: 'market',
        },
      ],
    },
  };
}

function decideActivity(activity: Record<string, unknown>): DirectDecision {
  const signature = (asRecord(activity.signature) as SignatureCheck | undefined) ?? inspectSignature({
    actorAppId: typeof activity.sourceAppId === 'string' ? activity.sourceAppId : undefined,
  });
  const result: EvalResult = signature.trusted ? 'Passed' : 'Needs Review';
  const sourceAppId = typeof activity.sourceAppId === 'string' ? activity.sourceAppId : 'unknown';
  const message = signature.trusted
    ? 'demo.SubmitOrder signed by a trusted approvals provider or raised from that app.'
    : `Unsigned demo.SubmitOrder from ${sourceAppId} requires human approval.`;
  return { outcome: result, message, signature };
}

function activitySummary(activity: Record<string, unknown>): LogEntry['activity'] {
  const ctx = asRecord(activity.context);
  const targetAppId = activity.targetAppId;
  const contextType = ctx?.type;
  const signature = asRecord(activity.signature);
  return {
    intent: typeof activity.intent === 'string' ? activity.intent : '',
    sourceAppId: typeof activity.sourceAppId === 'string' ? activity.sourceAppId : '',
    ...(typeof targetAppId === 'string' && targetAppId ? { targetAppId } : {}),
    ...(typeof contextType === 'string' && contextType ? { contextType } : {}),
    signature: signature?.trusted ? 'trusted' : signature?.present ? 'signed' : 'unsigned',
  };
}

function recordDecision(
  source: LogEntry['source'],
  activity: Record<string, unknown>,
  decision: DirectDecision,
  ms: number
): LogEntry {
  const entry: LogEntry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    source,
    ms,
    activity: activitySummary(activity),
    sent: activity,
    decision,
  };
  decisionLog.unshift(entry);
  decisionLog.splice(MAX_LOG);
  console.info(
    {
      app: AUTHOR_ID,
      source,
      outcome: decision.outcome,
      ms,
      message: decision.message,
      activity: entry.activity,
      signature: decision.signature,
    },
    'Direct decision'
  );
  return entry;
}

function filledFromDecision(
  decision: GovernanceDecisionContext,
  scored: DirectDecision
): GovernanceDecisionContext {
  const actorAppId = scored.signature.actorAppId || 'unknown';
  const log = fillEvaluationLog({
    log: decision.log,
    authorId: AUTHOR_ID,
    authorName: AUTHOR_NAME,
    result: scored.outcome,
    description: `Inspection of demo.SubmitOrder from ${actorAppId}: ${
      scored.signature.trusted ? 'ALLOW' : 'REQUIRE_APPROVAL'
    }`,
    evaluations: [
      controlEvaluation({
        controlId: CTL_005,
        requirementId: CTL_005_AR,
        planId: CTL_005_PLAN,
        result: scored.outcome,
        message: scored.message,
        description: 'Inspect raiseIntent actor, intent, and ContextMetadata.signature.',
        steps: [
          'direct-governance.inspectRaiseIntent',
          `signature: ${scored.signature.reason}`,
          'direct-governance.decideAllowOrRequireApproval',
        ],
      }),
    ],
  });
  return { ...decision, log };
}

class DirectGovernanceHandlers extends DefaultFDC3Handlers {
  async remoteIntentHandler(intent: string): Promise<BackendIntentHandler> {
    if (intent === INTENTS.GetGovernanceDecision) {
      return async (ctx: Context) => {
        const decision = asGovernanceDecision(ctx);
        if (!decision) return undefined;
        const started = Date.now();
        const activity = activityFrom(decision);
        const scored = decideActivity(activity);
        recordDecision('live', activity, scored, Date.now() - started);
        return filledFromDecision(decision, scored);
      };
    }
    return super.remoteIntentHandler(intent);
  }
}

export default function backend(app: Application, server: Server): void {
  setupWebsocketServer(server, () => {}, () => new DirectGovernanceHandlers());
  console.info({ app: AUTHOR_ID }, 'Direct governance ready');

  app.get('/api/log', (_req, res) => {
    res.json({ entries: decisionLog });
  });

  app.post('/api/test', (_req, res) => {
    const started = Date.now();
    const activity = testActivity();
    const scored = decideActivity(activity);
    const entry = recordDecision('test', activity, scored, Date.now() - started);
    res.json({ ...scored, log: entry });
  });
}
