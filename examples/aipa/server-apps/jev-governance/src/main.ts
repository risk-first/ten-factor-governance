import type { Context, ContextMetadata } from '@finos/fdc3';
import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { INTENTS } from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import {
  asGovernanceDecision,
  raiseDecisionLogs,
} from '../../../common/src/governance/evaluation.ts';

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;

async function setup(): Promise<void> {
  const session = await connectAppSession(statusEl());
  if (!session.fdc3 || !session.boundary) {
    if (session.fdc3 && !session.boundary) {
      setStatus(statusEl(), 'FDC3 connected; secure backend unavailable — JEV cannot decide.');
    }
    return;
  }

  const decide = await session.boundary.remoteIntentHandler(INTENTS.GetGovernanceDecision);
  await session.fdc3.addIntentListener(INTENTS.GetGovernanceDecision, async (ctx: Context, metadata?: ContextMetadata) => {
    const filled = await decide(
      ctx,
      metadata ?? ({ source: { appId: 'unknown' }, timestamp: new Date() } as ContextMetadata)
    );
    const decision = asGovernanceDecision(filled) ?? asGovernanceDecision(ctx);
    if (!decision?.log.result) {
      setStatus(statusEl(), 'JEV returned no decision');
      return filled;
    }
    try {
      await raiseDecisionLogs(session.fdc3!, {
        log: decision.log,
        authorId: 'aipa-jev-governance',
        authorName: 'JEV Governance',
        intent: 'demo.SubmitOrder',
      });
    } catch (error) {
      setStatus(
        statusEl(),
        `Governance log failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    setStatus(statusEl(), `${decision.log.result} — ${decision.log.metadata.description ?? ''}`);
    return filled;
  });
  setStatus(statusEl(), 'Listening for demo.GetGovernanceDecision');
}

void setup();
