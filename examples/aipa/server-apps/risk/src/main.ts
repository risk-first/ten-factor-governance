import '../../../common/src/ui/styles.css';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { CONTEXT_TYPES, INTENTS, type Fdc3Portfolio, type StressScenarioRequest } from '../../../common/src/contexts/types.ts';
import { toResultContext, type SignedEnvelope } from '../../../common/src/security/envelope.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { DesktopAgent } from '@finos/fdc3';

let fdc3: DesktopAgent | null = null;
let lastAnalysis: unknown = null;
let currentPortfolio: Fdc3Portfolio | null = null;

const drawer = mountStatusDrawer();
const statusEl = () => drawer.statusEl;
const analysisEl = () => document.getElementById('analysis');

function show(obj: unknown): void {
  lastAnalysis = obj;
  analysisEl()!.textContent = JSON.stringify(obj, null, 2);
}

async function analyseApi(portfolio?: Fdc3Portfolio): Promise<Record<string, unknown>> {
  const res = await fetch('/api/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolio }),
  });
  const envelope = (await res.json()) as SignedEnvelope;
  const result = toResultContext(envelope);
  show(result);
  setStatus(statusEl(), `Signed ${CONTEXT_TYPES.portfolioRisk} (jku=${envelope.jku})`);
  return result;
}

async function stressApi(req: StressScenarioRequest): Promise<Record<string, unknown>> {
  const res = await fetch('/api/stress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const envelope = (await res.json()) as SignedEnvelope;
  const result = toResultContext(envelope);
  show(result);
  setStatus(statusEl(), `Signed ${CONTEXT_TYPES.stressScenarioResult}`);
  return result;
}

async function setup(): Promise<void> {
  const session = await connectAppSession(statusEl());
  fdc3 = session.fdc3;
  if (!fdc3) return;

  await fdc3.addContextListener(CONTEXT_TYPES.portfolio, async ctx => {
    currentPortfolio = ctx as Fdc3Portfolio;
    setStatus(statusEl(), `Received portfolio ${currentPortfolio.id?.portfolioId ?? ''}`);
  });

  await fdc3.addIntentListener(INTENTS.GetPortfolioRisk, async ctx => {
    const portfolio = (ctx as Fdc3Portfolio) ?? currentPortfolio ?? undefined;
    return analyseApi(portfolio);
  });

  await fdc3.addIntentListener(INTENTS.RunStressScenario, async ctx => {
    return stressApi(ctx as StressScenarioRequest);
  });

  await fdc3.addIntentListener(INTENTS.ViewAnalysis, async () => {
    show(lastAnalysis ?? { message: 'No analysis yet' });
    setStatus(statusEl(), 'ViewAnalysis focused latest analysis');
  });
}

document.getElementById('run-local')!.addEventListener('click', () => void analyseApi(currentPortfolio ?? undefined));
document.getElementById('stress-local')!.addEventListener('click', () =>
  void stressApi({
    type: 'demo.stressScenarioRequest',
    portfolioId: currentPortfolio?.id?.portfolioId ?? 'aipa-energy-demo-1',
    scenario: { name: 'Oil price −20%', oilPriceShockPct: -20 },
  })
);

void setup();
