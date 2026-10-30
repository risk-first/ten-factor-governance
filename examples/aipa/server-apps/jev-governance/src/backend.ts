import fs from 'fs';
import path from 'path';
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
  jevOutcomeToEvalResult,
  planIdForControl,
  type EvalResult,
} from '../../../common/src/governance/refs.js';

type JevRuleResult = {
  ruleId: string;
  controlId: string;
  score: number | null;
  outcome: string;
};

type JevDecision = {
  outcome: string;
  message: string;
  rules?: JevRuleResult[];
  clef?: { model?: string; status?: string; detail?: string };
};

type RulesFile = { rules?: unknown };

const AUTHOR_ID = 'aipa-jev-governance';
const AUTHOR_NAME = 'JEV Governance';
const DECIDE_TIMEOUT_MS = 35_000;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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
        description: 'JEV engine did not return a decision; fail-safe to human review.',
        steps: ['jev-governance.postDecide', `fail-safe: ${reason}`],
      }),
    ],
  });
  return { ...decision, log };
}

function filledFromEngine(decision: GovernanceDecisionContext, engine: JevDecision): GovernanceDecisionContext {
  const result: EvalResult = jevOutcomeToEvalResult(engine.outcome);
  const clef = engine.clef;
  const clefStep =
    clef && (clef.model || clef.status)
      ? `clef ${clef.model ?? ''} ${clef.status ?? ''}${clef.detail ? `: ${clef.detail}` : ''}`.trim()
      : 'clef.score';
  const rules = Array.isArray(engine.rules) ? engine.rules : [];
  const evaluations =
    rules.length > 0
      ? rules.map(rule => {
          const ruleResult = jevOutcomeToEvalResult(rule.outcome);
          return controlEvaluation({
            controlId: rule.controlId,
            requirementId: rule.ruleId,
            planId: planIdForControl(rule.controlId),
            result: ruleResult,
            message: engine.message,
            description: `Clef scored ${rule.ruleId} for this raiseIntent.`,
            steps: ['jev-governance.postDecide', clefStep],
            score: rule.score,
          });
        })
      : [
          controlEvaluation({
            controlId: CTL_005,
            requirementId: CTL_005_AR,
            planId: CTL_005_PLAN,
            result,
            message: engine.message,
            description: 'JEV overall outcome with no per-rule scores.',
            steps: ['jev-governance.postDecide', clefStep],
          }),
        ];
  const log = fillEvaluationLog({
    log: decision.log,
    authorId: AUTHOR_ID,
    authorName: AUTHOR_NAME,
    result,
    description: engine.message,
    evaluations,
  });
  return { ...decision, log };
}

function loadRules(appRoot: string): unknown[] {
  const raw = JSON.parse(fs.readFileSync(path.join(appRoot, 'rules.json'), 'utf-8')) as RulesFile;
  return Array.isArray(raw.rules) ? raw.rules : [];
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
  return {
    kind: 'raiseIntent',
    intent: typeof subject.intent === 'string' ? subject.intent : 'demo.SubmitOrder',
    ...(targetAppId ? { targetAppId } : {}),
    sourceAppId,
    context: subject.context ?? {},
    correlationId,
  };
}

async function askEngine(rules: unknown[], activity: Record<string, unknown>): Promise<JevDecision | { error: string }> {
  const base = (process.env.JEV_ENGINE_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '');
  const apiKey = process.env.ENGINE_API_KEY?.trim();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  try {
    const res = await fetch(`${base}/decide`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rules, activity }),
      signal: AbortSignal.timeout(DECIDE_TIMEOUT_MS),
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = asRecord(body)?.error;
      const why = typeof err === 'string' ? err : `HTTP ${res.status}`;
      return { error: `Engine error: ${why}` };
    }
    const rec = asRecord(body);
    if (!rec || typeof rec.outcome !== 'string' || typeof rec.message !== 'string') {
      return { error: 'Engine reply was not a decision.' };
    }
    return rec as unknown as JevDecision;
  } catch (error) {
    return { error: `Engine unreachable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

class JevGovernanceHandlers extends DefaultFDC3Handlers {
  constructor(private readonly rules: unknown[]) {
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
        const engine = await askEngine(this.rules, activityFrom(decision));
        if ('error' in engine) return failSafe(decision, engine.error);
        return filledFromEngine(decision, engine);
      };
    }
    return super.remoteIntentHandler(intent);
  }
}

export default function backend(
  _app: Application,
  server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): void {
  const rules = loadRules(opts.appRoot);
  setupWebsocketServer(server, () => {}, () => new JevGovernanceHandlers(rules));
}
