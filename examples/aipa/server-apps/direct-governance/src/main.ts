import '../../../common/src/ui/styles.css';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import { INTENTS } from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import {
  asGovernanceDecision,
  controlEvaluation,
  fillEvaluationLog,
  raiseDecisionLogs,
  type GovernanceDecisionContext,
} from '../../../common/src/governance/evaluation.ts';
import {
  CTL_005,
  CTL_005_AR,
  CTL_005_PLAN,
  isTrustedApprover,
  type EvalResult,
} from '../../../common/src/governance/refs.ts';

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;

function decideDirect(ctx: unknown): GovernanceDecisionContext | undefined {
  const decision = asGovernanceDecision(ctx);
  if (!decision) return undefined;
  const actorAppId = typeof decision.log.target?.id === 'string' ? decision.log.target.id : '';
  const trusted = isTrustedApprover(actorAppId, decision.signatureJku);
  const result: EvalResult = trusted ? 'Passed' : 'Needs Review';
  const message = trusted
    ? 'demo.SubmitOrder signed by a trusted approvals provider or raised from that app.'
    : `Unsigned demo.SubmitOrder from ${actorAppId || 'unknown'} requires human approval.`;
  const log = fillEvaluationLog({
    log: decision.log,
    authorId: 'aipa-direct-governance',
    authorName: 'Direct Governance',
    result,
    description: `Inspection of demo.SubmitOrder from ${actorAppId || 'unknown'}: ${
      trusted ? 'ALLOW' : 'REQUIRE_APPROVAL'
    }`,
    evaluations: [
      controlEvaluation({
        controlId: CTL_005,
        requirementId: CTL_005_AR,
        planId: CTL_005_PLAN,
        result,
        message,
        description: 'Inspect raiseIntent actor, intent, and ContextMetadata.signature.',
        steps: [
          'direct-governance.inspectRaiseIntent',
          'direct-governance.decideAllowOrRequireApproval',
        ],
      }),
    ],
  });
  return { ...decision, log };
}

async function setup(): Promise<void> {
  const fdc3 = await connectAgent(statusEl());
  if (!fdc3) return;
  await fdc3.addIntentListener(INTENTS.GetGovernanceDecision, async ctx => {
    const filled = decideDirect(ctx);
    if (!filled) {
      setStatus(statusEl(), 'Ignored non-governanceDecision context');
      return;
    }
    try {
      await raiseDecisionLogs(fdc3, {
        log: filled.log,
        authorId: 'aipa-direct-governance',
        authorName: 'Direct Governance',
        intent: 'demo.SubmitOrder',
      });
    } catch (error) {
      setStatus(
        statusEl(),
        `Governance log failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    setStatus(statusEl(), `${filled.log.result ?? 'Needs Review'} — ${filled.log.metadata.description ?? ''}`);
    return filled;
  });
  setStatus(statusEl(), 'Listening for demo.GetGovernanceDecision');
}

void setup();
