export type DecisionLogActivity = {
  intent: string;
  sourceAppId: string;
  targetAppId?: string;
  contextType?: string;
  signature?: string;
};

export type DecisionLogEntry = {
  id: string;
  at: string;
  source: string;
  ms: number;
  activity: DecisionLogActivity;
  sent?: unknown;
  decision: {
    outcome: string;
    message: string;
    [key: string]: unknown;
  };
};

export function outcomeClass(outcome: string): string {
  if (outcome === 'Allow' || outcome === 'Passed') return 'outcome outcome--ok';
  if (outcome === 'Block' || outcome === 'Failed') return 'outcome outcome--fail';
  return 'outcome outcome--warn';
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, { hour12: false });
}

export function sentLine(activity: DecisionLogActivity): string {
  return [activity.sourceAppId, activity.intent, activity.targetAppId, activity.contextType, activity.signature]
    .filter(Boolean)
    .join(' → ');
}

export async function fetchDecisionLog(): Promise<DecisionLogEntry[]> {
  const res = await fetch('/api/log');
  const body = (await res.json()) as { entries?: DecisionLogEntry[] };
  return Array.isArray(body.entries) ? body.entries : [];
}

export function renderDecisionLog(
  log: DecisionLogEntry[],
  selectedId: string | null,
  onSelect: (entry: DecisionLogEntry) => void,
  metaLine: (entry: DecisionLogEntry) => string
): void {
  const tbody = document.getElementById('log');
  if (!tbody) return;
  tbody.replaceChildren();
  for (const entry of log) {
    const tr = document.createElement('tr');
    if (selectedId === entry.id) tr.classList.add('selected');
    tr.addEventListener('click', () => onSelect(entry));

    const when = document.createElement('td');
    when.className = 'num-col';
    when.textContent = formatWhen(entry.at);

    const source = document.createElement('td');
    source.textContent = entry.source;

    const sent = document.createElement('td');
    sent.className = 'context-cell';
    sent.textContent = sentLine(entry.activity);

    const outcome = document.createElement('td');
    outcome.className = outcomeClass(entry.decision.outcome);
    outcome.textContent = entry.decision.outcome;

    const detail = document.createElement('td');
    const message = document.createElement('div');
    message.textContent = entry.decision.message;
    const meta = document.createElement('div');
    meta.className = 'meta-row';
    meta.textContent = metaLine(entry);
    detail.append(message, meta);

    tr.append(when, source, sent, outcome, detail);
    tbody.appendChild(tr);
  }
}

export function showDecisionDetail(entry: DecisionLogEntry): void {
  const detail = document.getElementById('detail');
  if (!detail) return;
  detail.hidden = false;
  detail.textContent = JSON.stringify(
    {
      sent: entry.sent,
      result: {
        at: entry.at,
        source: entry.source,
        ms: entry.ms,
        outcome: entry.decision.outcome,
        message: entry.decision.message,
        decision: entry.decision,
      },
    },
    null,
    2
  );
}
