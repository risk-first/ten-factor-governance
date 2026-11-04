export type ClefAnswer =
  | { ok: true; model: string; scores: Record<string, number> }
  | { ok: false; reason: 'timeout' | 'unavailable'; detail: string };

export type ClefQuestion = { id: string; text: string };

export type ClefRequest = {
  state: unknown;
  questions: ClefQuestion[];
};

export type ClefClient = {
  model: string;
  ask: (request: ClefRequest) => Promise<ClefAnswer>;
};

const DEFAULT_URL = 'http://127.0.0.1:1234/v1/systemone';
const DEFAULT_MODEL = 'clef-flash-artemis';
const DEFAULT_TIMEOUT_MS = 30_000;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function noulFrom(value: unknown): number | undefined {
  const rec = asRecord(value);
  const noul = rec?.noul;
  return typeof noul === 'number' && noul >= 0 && noul <= 1 ? noul : undefined;
}

function isTimeout(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'TimeoutError') return true;
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function unavailable(detail: string): ClefAnswer {
  return { ok: false, reason: 'unavailable', detail };
}

export function clefFromEnv(env: NodeJS.ProcessEnv = process.env): ClefClient {
  const url = env.CLEF_URL?.trim() || DEFAULT_URL;
  const model = env.CLEF_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutRaw = env.CLEF_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : DEFAULT_TIMEOUT_MS;
  const timeout =
    Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;

  async function ask(request: ClefRequest): Promise<ClefAnswer> {
    const questions: Record<string, unknown> = {};
    for (const { id, text } of request.questions) {
      questions[id] = { type: 'noul', instructions: text };
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, state: request.state, questions }),
      signal: AbortSignal.timeout(timeout),
    });
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return unavailable('Clef sent a reply that is not JSON');
    }
    const envelope = asRecord(parsed);
    if (!response.ok || envelope?.success === false) {
      const err = envelope?.error;
      const message =
        typeof err === 'string'
          ? err
          : asRecord(err)?.message && typeof asRecord(err)?.message === 'string'
            ? (asRecord(err)!.message as string)
            : `HTTP ${response.status}`;
      return unavailable(`Clef answered ${response.status}: ${message}`);
    }
    const result = asRecord(envelope?.result) ?? envelope;
    const answers = asRecord(result?.answers);
    if (!answers) return unavailable('Clef sent a reply with no answers');
    const scores: Record<string, number> = {};
    for (const { id } of request.questions) {
      const score = noulFrom(answers[id]);
      if (score != null) scores[id] = score;
    }
    const reported = result?.model;
    return {
      ok: true,
      model: typeof reported === 'string' && reported ? reported : model,
      scores,
    };
  }

  return {
    model,
    async ask(request) {
      try {
        return await ask(request);
      } catch (error) {
        if (isTimeout(error)) {
          return {
            ok: false,
            reason: 'timeout',
            detail: `Clef gave no answer within ${timeout} ms`,
          };
        }
        return unavailable(error instanceof Error ? error.message : String(error));
      }
    },
  };
}
