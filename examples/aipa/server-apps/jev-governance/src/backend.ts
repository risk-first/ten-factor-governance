import fs from 'fs';
import path from 'path';
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
  jevOutcomeToEvalResult,
  planIdForControl,
  type EvalResult,
} from '../../../common/src/governance/refs.js';
import { decide, parseRules, type Decision, type JevRule } from './decide.ts';

type RulesFile = { rules?: unknown };

const AUTHOR_ID = 'aipa-jev-governance';
const AUTHOR_NAME = 'JEV Governance';
const MAX_LOG = 50;

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
  sent: Decision['request'];
  decision: Decision;
};

const decisionLog: LogEntry[] = [];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function activitySummary(activity: Record<string, unknown>): LogEntry['activity'] {
  const ctx = asRecord(activity.context);
  const targetAppId = activity.targetAppId;
  const contextType = ctx?.type;
  const signature = asRecord(activity.signature);
  const signatureLabel = signature?.trusted
    ? 'trusted'
    : signature?.present
      ? 'signed'
      : 'unsigned';
  return {
    intent: typeof activity.intent === 'string' ? activity.intent : '',
    sourceAppId: typeof activity.sourceAppId === 'string' ? activity.sourceAppId : '',
    ...(typeof targetAppId === 'string' && targetAppId ? { targetAppId } : {}),
    ...(typeof contextType === 'string' && contextType ? { contextType } : {}),
    signature: signatureLabel,
  };
}

function recordDecision(
  source: LogEntry['source'],
  activity: Record<string, unknown>,
  decision: Decision,
  ms: number
): LogEntry {
  const entry: LogEntry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    source,
    ms,
    activity: activitySummary(activity),
    sent: decision.request,
    decision,
  };
  decisionLog.unshift(entry);
  decisionLog.splice(MAX_LOG);
  const scores = decision.rules.map(rule => {
    const short = rule.controlId.replace(/^apa-/, '');
    return `${short}=${rule.score ?? '—'} ${rule.outcome}`;
  });
  console.info(
    {
      app: AUTHOR_ID,
      source,
      outcome: decision.outcome,
      ms,
      model: decision.clef.model,
      status: decision.clef.status,
      message: decision.message,
      activity: entry.activity,
      signature: asRecord(activity.signature),
      scores,
      ...(decision.clef.detail ? { detail: decision.clef.detail } : {}),
    },
    'JEV decision'
  );
  return entry;
}

async function scoreActivity(
  rules: readonly JevRule[],
  activity: Record<string, unknown>,
  source: LogEntry['source']
): Promise<{ scored: Decision; entry: LogEntry }> {
  console.info({ app: AUTHOR_ID, source, rules: rules.length }, 'JEV scoring');
  const started = Date.now();
  const scored = await decide(rules, activity);
  const entry = recordDecision(source, activity, scored, Date.now() - started);
  return { scored, entry };
}

function failSafe(decision: GovernanceDecisionContext, reason: string): GovernanceDecisionContext {
  const log = fillEvaluationLog({
    log: decision.log,
    authorId: AUTHOR_ID,
    authorName: AUTHOR_NAME,
    result: 'Needs Review',
    description: reason,
    evaluations: [
      controlEvaluation({
        controlId: CTL_005,
        requirementId: CTL_005_AR,
        planId: CTL_005_PLAN,
        result: 'Needs Review',
        message: reason,
        description: 'JEV did not return a decision; fail-safe to human review.',
        steps: ['jev-governance.decide', `fail-safe: ${reason}`],
      }),
    ],
  });
  return { ...decision, log };
}

function filledFromDecision(
  decision: GovernanceDecisionContext,
  scored: Decision
): GovernanceDecisionContext {
  const result: EvalResult = jevOutcomeToEvalResult(scored.outcome);
  const clef = scored.clef;
  const clefStep =
    clef.model || clef.status
      ? `clef ${clef.model} ${clef.status}${clef.detail ? `: ${clef.detail}` : ''}`.trim()
      : 'clef.score';
  const evaluations =
    scored.rules.length > 0
      ? scored.rules.map(rule => {
          const ruleResult = jevOutcomeToEvalResult(rule.outcome);
          return controlEvaluation({
            controlId: rule.controlId,
            requirementId: rule.ruleId,
            planId: planIdForControl(rule.controlId),
            result: ruleResult,
            message: scored.message,
            description: `Clef scored ${rule.ruleId} for this raiseIntent.`,
            steps: ['jev-governance.decide', clefStep],
            score: rule.score,
          });
        })
      : [
          controlEvaluation({
            controlId: CTL_005,
            requirementId: CTL_005_AR,
            planId: CTL_005_PLAN,
            result,
            message: scored.message,
            description: 'JEV overall outcome with no per-rule scores.',
            steps: ['jev-governance.decide', clefStep],
          }),
        ];
  const log = fillEvaluationLog({
    log: decision.log,
    authorId: AUTHOR_ID,
    authorName: AUTHOR_NAME,
    result,
    description: scored.message,
    evaluations,
  });
  return { ...decision, log };
}

function loadRules(appRoot: string): JevRule[] {
  const raw = JSON.parse(fs.readFileSync(path.join(appRoot, 'rules.json'), 'utf-8')) as RulesFile;
  return parseRules(Array.isArray(raw.rules) ? raw.rules : []);
}

function activityFrom(decision: GovernanceDecisionContext): Record<string, unknown> {
  const subject = decision.subject;
  const targetAppId = subject.app?.appId;
  const sourceAppId =
    typeof decision.log.target?.id === 'string' && decision.log.target.id
      ? decision.log.target.id
      : 'unknown';
  const correlationId =
    typeof decision.id?.requestId === 'string' && decision.id.requestId
      ? decision.id.requestId
      : `jev-${Date.now()}`;
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
    correlationId,
  };
}

/** Unsigned two-leg blotter, same shape as Order Entry's demo create. */
function testActivity(): Record<string, unknown> {
  const date = new Date().toISOString();
  return {
    kind: 'raiseIntent',
    intent: 'demo.SubmitOrder',
    targetAppId: 'aipa-execution',
    sourceAppId: 'aipa-order-entry',
    signature: inspectSignature({ actorAppId: 'aipa-order-entry' }),
    context: {
      type: 'demo.orderList',
      orders: [
        {
          type: 'demo.order',
          id: { orderId: 'jev-test-shel' },
          instrument: { type: 'fdc3.instrument', id: { ticker: 'SHEL' }, name: 'Shell' },
          side: 'sell',
          quantity: 1000,
          date,
          orderType: 'market',
        },
        {
          type: 'demo.order',
          id: { orderId: 'jev-test-nvda' },
          instrument: { type: 'fdc3.instrument', id: { ticker: 'NVDA' }, name: 'NVIDIA' },
          side: 'buy',
          quantity: 200,
          date,
          orderType: 'market',
        },
      ],
    },
    correlationId: `jev-test-${Date.now()}`,
  };
}

class JevGovernanceHandlers extends DefaultFDC3Handlers {
  constructor(private readonly rules: JevRule[]) {
    super();
  }

  async remoteIntentHandler(intent: string): Promise<BackendIntentHandler> {
    if (intent === INTENTS.GetGovernanceDecision) {
      return async (ctx: Context) => {
        const decision = asGovernanceDecision(ctx);
        if (!decision) return undefined;
        if (this.rules.length === 0) {
          return failSafe(decision, 'JEV rules.json has no rules; fail-safe to human review.');
        }
        const activity = activityFrom(decision);
        const { scored } = await scoreActivity(this.rules, activity, 'live');
        return filledFromDecision(decision, scored);
      };
    }
    return super.remoteIntentHandler(intent);
  }
}

export default function backend(
  app: Application,
  server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): void {
  const rules = loadRules(opts.appRoot);
  setupWebsocketServer(server, () => {}, () => new JevGovernanceHandlers(rules));
  console.info({ app: AUTHOR_ID, rules: rules.length }, 'JEV rules loaded');

  app.get('/api/log', (_req, res) => {
    res.json({ entries: decisionLog });
  });

  app.post('/api/test', async (_req, res) => {
    if (rules.length === 0) {
      res.status(500).json({
        outcome: 'Review',
        message: 'JEV rules.json has no rules; fail-safe to human review.',
        rules: [],
        clef: { model: '', status: 'unavailable', detail: 'no rules' },
        request: { model: '', state: {}, questions: {} },
      } satisfies Decision);
      return;
    }
    const { scored, entry } = await scoreActivity(rules, testActivity(), 'test');
    res.json({ ...scored, log: entry });
  });
}
