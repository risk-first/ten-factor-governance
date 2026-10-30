import type { Context, ContextMetadata } from '@finos/fdc3';
import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { INTENTS } from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import {
  fetchDecisionLog,
  renderDecisionLog,
  showDecisionDetail,
  type DecisionLogEntry,
} from '../../../common/src/ui/decision-log.ts';
import {
  asGovernanceDecision,
  raiseDecisionLogs,
} from '../../../common/src/governance/evaluation.ts';

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;
let log: DecisionLogEntry[] = [];
let selectedId: string | null = null;

function metaLine(entry: DecisionLogEntry): string {
  const decision = entry.decision as DecisionLogEntry['decision'] & {
    signature?: { reason?: string; trusted?: boolean; jku?: string };
  };
  const reason = decision.signature?.reason;
  return [reason, `${entry.ms} ms`].filter(Boolean).join(' · ');
}

function paint(select?: DecisionLogEntry): void {
  if (select) {
    selectedId = select.id;
    showDecisionDetail(select);
  }
  renderDecisionLog(log, selectedId, entry => paint(entry), metaLine);
}

async function loadLog(): Promise<void> {
  log = await fetchDecisionLog();
  paint(selectedId ? log.find(e => e.id === selectedId) : log[0]);
}

function latestStatus(): string {
  const entry = log[0];
  if (!entry) return 'Listening for demo.GetGovernanceDecision';
  return `${entry.decision.outcome} — ${entry.decision.message}`;
}

async function testDecision(): Promise<void> {
  const button = document.getElementById('test-decision');
  if (button instanceof HTMLButtonElement) button.disabled = true;
  setStatus(statusEl(), 'Inspecting test demo.SubmitOrder…');
  try {
    const res = await fetch('/api/test', { method: 'POST' });
    const body = (await res.json().catch(() => ({}))) as { log?: { id?: string } };
    await loadLog();
    const entry = body.log?.id ? log.find(e => e.id === body.log?.id) ?? log[0] : log[0];
    paint(entry);
    setStatus(statusEl(), latestStatus());
    drawer.open();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(statusEl(), `Test failed: ${message}`);
    drawer.open();
  } finally {
    if (button instanceof HTMLButtonElement) button.disabled = false;
  }
}

async function setup(): Promise<void> {
  await loadLog().catch(() => {
    setStatus(statusEl(), 'Decision log unavailable — restart AIPA to load /api/log.');
  });
  const session = await connectAppSession(statusEl());
  if (!session.fdc3 || !session.boundary) {
    if (session.fdc3 && !session.boundary) {
      setStatus(statusEl(), 'FDC3 connected; secure backend unavailable — Direct cannot decide.');
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
      setStatus(statusEl(), 'Direct returned no decision');
      return filled;
    }
    try {
      await raiseDecisionLogs(session.fdc3!, {
        log: decision.log,
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
    await loadLog().catch(() => undefined);
    paint(log[0]);
    setStatus(statusEl(), `${decision.log.result} — ${decision.log.metadata.description ?? ''}`);
    drawer.open();
    return filled;
  });
  setStatus(statusEl(), latestStatus());
}

document.getElementById('test-decision')?.addEventListener('click', () => {
  void testDecision();
});

void setup();
