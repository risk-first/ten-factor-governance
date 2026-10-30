import { clefFromEnv, type ClefClient } from './clef.ts';

export type Outcome = 'Allow' | 'Review' | 'Block';

export type JevRule = {
  id: string;
  controlId: string;
  question: string;
  thresholds: { block: number; review: number };
};

export type RuleResult = {
  ruleId: string;
  controlId: string;
  score: number | null;
  outcome: Outcome;
};

export type ClefRequestBody = {
  model: string;
  state: unknown;
  questions: Record<string, { type: 'noul'; instructions: string }>;
};

export type Decision = {
  outcome: Outcome;
  message: string;
  rules: RuleResult[];
  clef: { model: string; status: 'answered' | 'timeout' | 'unavailable'; detail?: string };
  request: ClefRequestBody;
};

const severity: Record<Outcome, number> = { Allow: 0, Review: 1, Block: 2 };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseRules(raw: unknown[]): JevRule[] {
  const rules: JevRule[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec) continue;
    const thresholds = asRecord(rec.thresholds);
    const id = rec.id;
    const controlId = rec.controlId;
    const question = rec.question;
    const block = thresholds?.block;
    const review = thresholds?.review;
    if (
      typeof id !== 'string' ||
      typeof controlId !== 'string' ||
      typeof question !== 'string' ||
      typeof block !== 'number' ||
      typeof review !== 'number'
    ) {
      continue;
    }
    rules.push({ id, controlId, question, thresholds: { block, review } });
  }
  return rules;
}

function outcomeFor(score: number | null, thresholds: JevRule['thresholds']): Outcome {
  if (score == null) return 'Review';
  // `block: 1` is unreachable for a 0–1 noul (`>= 1` would still Deny a perfect hit).
  if (thresholds.block < 1 && score >= thresholds.block) return 'Block';
  if (score >= thresholds.review) return 'Review';
  return 'Allow';
}

function messageFor(
  worst: RuleResult | undefined,
  answerOk: boolean,
  results: RuleResult[]
): string {
  if (!answerOk) return 'Review: Clef gave no answer.';
  if (!worst || worst.outcome === 'Allow') return 'Allowed: no rule fired.';
  if (worst.score == null) {
    const missing = results.filter(r => r.score == null).map(r => r.ruleId);
    return `Review: Clef gave no score for ${missing.join(', ')}.`;
  }
  const label = worst.outcome === 'Block' ? 'Blocked by' : 'Review:';
  return `${label} ${worst.ruleId} (score ${worst.score.toFixed(2)}).`;
}

export function scoreDecision(
  rules: readonly JevRule[],
  scores: Record<string, number> | null
): { outcome: Outcome; message: string; rules: RuleResult[] } {
  const results = rules.map((rule): RuleResult => {
    const score = scores ? (scores[rule.id] ?? null) : null;
    return {
      ruleId: rule.id,
      controlId: rule.controlId,
      score,
      outcome: outcomeFor(score, rule.thresholds),
    };
  });
  const worst = [...results].sort(
    (a, b) => severity[b.outcome] - severity[a.outcome] || (b.score ?? 1) - (a.score ?? 1)
  )[0];
  return {
    outcome: worst?.outcome ?? 'Allow',
    message: messageFor(worst, scores != null, results),
    rules: results,
  };
}

export async function decide(
  rules: readonly JevRule[],
  activity: unknown,
  clef: ClefClient = clefFromEnv()
): Promise<Decision> {
  const rec = asRecord(activity) ?? {};
  const state = { ...rec };
  delete state.correlationId;
  const questions: ClefRequestBody['questions'] = {};
  for (const rule of rules) {
    questions[rule.id] = { type: 'noul', instructions: rule.question };
  }
  const request: ClefRequestBody = { model: clef.model, state, questions };
  const answer = await clef.ask({
    state,
    questions: rules.map(rule => ({ id: rule.id, text: rule.question })),
  });
  if (!answer.ok) {
    return {
      ...scoreDecision(rules, null),
      message: `Review: ${answer.detail}.`,
      clef: { model: clef.model, status: answer.reason, detail: answer.detail },
      request,
    };
  }
  const scored = scoreDecision(rules, answer.scores);
  return {
    ...scored,
    clef: { model: answer.model, status: 'answered' },
    request,
  };
}
