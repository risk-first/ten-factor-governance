import type { DesktopAgent } from '@finos/fdc3';
import { CONTEXT_TYPES, INTENTS } from '../contexts/types.ts';
import { raiseLogEnforcement } from './enforcement.ts';
import {
  CONSOLE_APP_ID,
  CONTROLS_REF,
  POLICY_REF,
  asRecord,
  evalResultToEnforcement,
  isoNow,
  mappingReferences,
  type EvalResult,
} from './refs.ts';

export type Fdc3Action = {
  type: 'fdc3.action';
  action?: 'raiseIntent' | 'broadcast';
  title?: string;
  intent?: string;
  context?: Record<string, unknown>;
  app?: { appId: string; instanceId?: string };
};

export type EvaluationLog = {
  metadata: Record<string, unknown> & {
    id?: string;
    type: 'EvaluationLog';
    description?: string;
    author?: { id: string; name: string; type: string; version?: string };
  };
  result?: EvalResult;
  target?: { id: string; name: string; type: string };
  evaluations?: unknown[];
  [key: string]: unknown;
};

export type GovernanceDecisionContext = {
  type: 'demo.governanceDecision';
  id?: { requestId?: string; [k: string]: string | undefined };
  name?: string;
  subject: Fdc3Action;
  signatureJku?: string;
  log: EvaluationLog;
};

export function asGovernanceDecision(ctx: unknown): GovernanceDecisionContext | undefined {
  const rec = asRecord(ctx);
  if (!rec || rec.type !== CONTEXT_TYPES.governanceDecision) return undefined;
  const subject = asRecord(rec.subject);
  const log = asRecord(rec.log);
  if (!subject || !log) return undefined;
  const meta = asRecord(log.metadata);
  if (!meta || meta.type !== 'EvaluationLog') return undefined;
  return rec as unknown as GovernanceDecisionContext;
}

export function buildSkeletonLog(input: {
  id: string;
  actorAppId: string;
  intent: string;
}): EvaluationLog {
  const start = isoNow();
  return {
    metadata: {
      id: `sail-eval-${input.id}`,
      type: 'EvaluationLog',
      version: '0.1.0',
      'gemara-version': '1.2.0',
      date: start,
      description: `Inspection of ${input.intent} from ${input.actorAppId}`,
      'mapping-references': mappingReferences(),
    },
    target: {
      id: input.actorAppId,
      name: input.actorAppId,
      type: 'Software',
    },
  };
}

export function fillEvaluationLog(input: {
  log: EvaluationLog;
  authorId: string;
  authorName: string;
  result: EvalResult;
  evaluations: unknown[];
  description?: string;
}): EvaluationLog {
  const start = isoNow();
  return {
    ...input.log,
    metadata: {
      ...input.log.metadata,
      type: 'EvaluationLog',
      version: input.log.metadata.version ?? '0.1.0',
      'gemara-version': input.log.metadata['gemara-version'] ?? '1.2.0',
      date: (input.log.metadata.date as string | undefined) ?? start,
      description: input.description ?? input.log.metadata.description,
      author: {
        id: input.authorId,
        name: input.authorName,
        type: 'Software',
        version: '0.0.0',
      },
      'mapping-references':
        (input.log.metadata['mapping-references'] as unknown) ?? mappingReferences(),
    },
    result: input.result,
    evaluations: input.evaluations,
  };
}

export function controlEvaluation(input: {
  controlId: string;
  requirementId: string;
  planId: string;
  result: EvalResult;
  message: string;
  description: string;
  steps: string[];
  score?: number | null;
}): Record<string, unknown> {
  const start = isoNow();
  return {
    name: input.controlId,
    result: input.result,
    message: input.message,
    control: { 'reference-id': CONTROLS_REF, 'entry-id': input.controlId },
    'assessment-logs': [
      {
        requirement: { 'reference-id': CONTROLS_REF, 'entry-id': input.requirementId },
        plan: { 'reference-id': POLICY_REF, 'entry-id': input.planId },
        description: input.description,
        result: input.result,
        message:
          input.score == null ? input.message : `${input.message} (score ${input.score.toFixed(2)})`,
        applicability: ['propose', 'execute', 'human-approval-required'],
        steps: input.steps,
        'steps-executed': String(input.steps.length),
        start,
        end: start,
        'confidence-level': input.score == null ? 'High' : 'Medium',
      },
    ],
  };
}

export async function raiseLogEvaluation(
  fdc3: DesktopAgent,
  log: EvaluationLog
): Promise<void> {
  const logId = typeof log.metadata.id === 'string' ? log.metadata.id : undefined;
  await fdc3.raiseIntent(
    INTENTS.LogEvaluation,
    {
      type: CONTEXT_TYPES.gemaraEvaluationLog,
      id: logId ? { logId } : undefined,
      name: typeof log.metadata.description === 'string' ? log.metadata.description : undefined,
      log,
    },
    { appId: CONSOLE_APP_ID }
  );
}

/** Layer 5 always; layer 6 only for Allow / Deny. Escalate L6 is the approval app. */
export async function raiseDecisionLogs(
  fdc3: DesktopAgent,
  input: { log: EvaluationLog; authorId: string; authorName: string; intent?: string }
): Promise<void> {
  await raiseLogEvaluation(fdc3, input.log);
  const result = input.log.result;
  if (result !== 'Passed' && result !== 'Failed') return;
  const evalId = typeof input.log.metadata.id === 'string' ? input.log.metadata.id : undefined;
  await raiseLogEnforcement(fdc3, {
    id: evalId ?? String(Date.now()),
    actorAppId: input.log.target?.id ?? 'unknown',
    intent: input.intent ?? 'demo.SubmitOrder',
    decision: evalResultToEnforcement(result),
    authorId: input.authorId,
    authorName: input.authorName,
    evaluationId: evalId,
    steps: [`${input.authorId}.${result === 'Failed' ? 'deny' : 'allow'}`],
  });
}
