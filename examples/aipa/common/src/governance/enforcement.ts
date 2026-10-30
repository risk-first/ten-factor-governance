import type { DesktopAgent } from '@finos/fdc3';
import { CONTEXT_TYPES, INTENTS } from '../contexts/types.ts';
import {
  CONSOLE_APP_ID,
  CONTROLS_REF,
  CTL_005,
  CTL_005_AR,
  CTL_005_PLAN,
  CTL_006,
  CTL_006_AR,
  CTL_006_PLAN,
  POLICY_REF,
  asRecord,
  isoNow,
  mappingReferences,
  type EnforcementDecision,
  type EvalResult,
} from './refs.ts';

const METHOD_HOLD = 'em-apa-require-human-approval';
const METHOD_DENY = 'em-apa-block-execution';

export type EnforcementLogInput = {
  id: string;
  actorAppId: string;
  intent: string;
  decision: EnforcementDecision;
  authorId: string;
  authorName: string;
  evaluationId?: string;
  steps?: string[];
};

export function buildEnforcementLog(input: EnforcementLogInput): Record<string, unknown> {
  const start = isoNow();
  const hold = input.decision === 'REQUIRE_APPROVAL';
  const deny = input.decision === 'DENY';
  const disposition = hold || deny ? 'Enforced' : 'Clear';
  const evalResult: EvalResult = deny ? 'Failed' : hold ? 'Needs Review' : 'Passed';
  const controlId = deny ? CTL_006 : CTL_005;
  const requirementId = deny ? CTL_006_AR : CTL_005_AR;
  const planId = deny ? CTL_006_PLAN : CTL_005_PLAN;
  const methodId = deny ? METHOD_DENY : METHOD_HOLD;
  const description = deny
    ? `Blocked ${input.intent}`
    : hold
      ? `Held ${input.intent} for GetApproval`
      : `Forwarded ${input.intent}`;
  const message = deny
    ? 'Do not forward; IntentDeliveryFailed.'
    : hold
      ? 'Park getResult() until a human records a decision.'
      : 'Forward the original raiseIntentRequest.';
  const steps = input.steps ?? [hold ? 'hold' : deny ? 'deny' : 'forward'];
  const catalogRefs = mappingReferences();
  return {
    metadata: {
      id: `${input.authorId}-enf-${input.id}`,
      type: 'EnforcementLog',
      version: '0.1.0',
      'gemara-version': '1.2.0',
      date: start,
      description,
      author: {
        id: input.authorId,
        name: input.authorName,
        type: 'Software',
        version: '0.0.0',
      },
      'mapping-references': input.evaluationId
        ? [...catalogRefs, { id: input.evaluationId, title: `${input.intent} Evaluation Log`, version: '0.1.0' }]
        : catalogRefs,
    },
    disposition,
    target: { id: input.actorAppId, name: input.actorAppId, type: 'Software' },
    actions: [
      {
        disposition,
        method: { 'reference-id': POLICY_REF, 'entry-id': methodId },
        message,
        start,
        end: start,
        steps,
        justification: {
          assessments: [
            {
              result: evalResult,
              requirement: { 'reference-id': CONTROLS_REF, 'entry-id': requirementId },
              plan: { 'reference-id': POLICY_REF, 'entry-id': planId },
              ...(input.evaluationId
                ? { log: { 'reference-id': input.evaluationId, 'entry-id': controlId } }
                : {}),
            },
          ],
        },
      },
    ],
  };
}

export async function raiseLogEnforcement(
  fdc3: DesktopAgent,
  input: EnforcementLogInput
): Promise<void> {
  const log = buildEnforcementLog(input);
  const meta = asRecord(log.metadata);
  const logId = typeof meta?.id === 'string' ? meta.id : undefined;
  await fdc3.raiseIntent(
    INTENTS.LogEnforcement,
    {
      type: CONTEXT_TYPES.gemaraEnforcementLog,
      id: logId ? { logId } : undefined,
      name: typeof meta?.description === 'string' ? meta.description : undefined,
      log,
    },
    { appId: CONSOLE_APP_ID }
  );
}

export function recordEnforcement(
  fdc3: DesktopAgent | null | undefined,
  input: EnforcementLogInput
): void {
  if (!fdc3) return;
  void raiseLogEnforcement(fdc3, input).catch(() => undefined);
}
