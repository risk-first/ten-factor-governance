/**
 * Node-side LLM helpers adapted from OpenBB agent-rita (`src/rita/lib/providers.ts`).
 * Provider selection mirrors Rita; the Workspace SSE / widget bridge is not used here.
 */
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, type LanguageModel } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';

const SYSTEM_PROMPT =
  'You are the AI Portfolio Assistant (AIPA) harness, derived from OpenBB Agent Rita. ' +
  'You help analyse portfolios, explain risk and research, and draft recommendations. ' +
  'Be concise and precise with numbers. Never claim to have executed trades. ' +
  'If portfolio or market data is not in the prompt, say what FDC3 intent you would raise ' +
  '(e.g. demo.GetPortfolioRisk, demo.GetResearch) rather than inventing figures.';

function resolveModel(modelHint?: string): LanguageModel | null {
  const preferred = (modelHint || process.env.DEFAULT_MODEL || '').trim();

  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiBaseURL = process.env.OPENAI_BASE_URL;
  if (openaiKey) {
    const openai = createOpenAI({
      apiKey: openaiKey,
      ...(openaiBaseURL ? { baseURL: openaiBaseURL } : {}),
    });
    const id = preferred.startsWith('openai:')
      ? preferred.slice('openai:'.length)
      : preferred && !preferred.includes(':')
        ? preferred
        : process.env.LM_STUDIO_MODEL || 'gpt-4o-mini';
    if (!preferred || preferred.startsWith('openai:') || !preferred.includes(':')) {
      // Custom baseURL (LM Studio, etc.) only implements Chat Completions;
      // openai(id) defaults to the Responses API and yields an empty stream.
      return openaiBaseURL ? openai.chat(id) : openai(id);
    }
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey && (!preferred || preferred.startsWith('openrouter:'))) {
    const openrouter = createOpenRouter({ apiKey: openrouterKey });
    const id = preferred.startsWith('openrouter:')
      ? preferred.slice('openrouter:'.length)
      : 'openai/gpt-4o-mini';
    return openrouter(id);
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && (!preferred || preferred.startsWith('groq:'))) {
    const groq = createGroq({ apiKey: groqKey });
    const id = preferred.startsWith('groq:') ? preferred.slice('groq:'.length) : 'llama-3.3-70b-versatile';
    return groq(id);
  }

  const ollamaBase = process.env.OLLAMA_BASE_URL;
  if (ollamaBase && (!preferred || preferred.startsWith('ollama:'))) {
    const ollama = createOllama({ baseURL: ollamaBase });
    const id = preferred.startsWith('ollama:') ? preferred.slice('ollama:'.length) : 'llama3.2';
    return ollama(id);
  }

  return null;
}

export type QueryStreamHandlers = {
  onStatus: (message: string) => void;
  onText: (delta: string) => void;
  onDone: (markdown: string, suggestions?: string[]) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
};

/** Stream an assistant reply for one user utterance. */
export async function runHarnessTurn(
  text: string,
  modelHint: string | undefined,
  handlers: QueryStreamHandlers
): Promise<void> {
  const model = resolveModel(modelHint);
  if (!model) {
    const fallback =
      'No LLM provider is configured on the Agent harness.\n\n' +
      'Set `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, or `OLLAMA_BASE_URL` ' +
      'in the AIPA `.env` (see `server-apps/agent-harness/.env.example`).\n\n' +
      `You asked: “${text.trim() || '(empty)'}”.`;
    handlers.onStatus('Using offline fallback (no provider keys)');
    for (const chunk of fallback.match(/.{1,24}/gs) ?? [fallback]) {
      if (handlers.signal?.aborted) break;
      handlers.onText(chunk);
      await new Promise(r => setTimeout(r, 12));
    }
    handlers.onDone(fallback, [
      'What are the biggest risks in this portfolio?',
      'Gather research on the top holdings',
    ]);
    return;
  }

  handlers.onStatus('Calling model…');
  let full = '';
  try {
    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      prompt: text.trim() || 'Hello',
      abortSignal: handlers.signal,
    });
    for await (const delta of result.textStream) {
      if (handlers.signal?.aborted) break;
      full += delta;
      handlers.onText(delta);
    }
    if (!full.trim()) {
      full = (await result.text) || '';
    }
    const markdown = full.trim() || '_No response._';
    handlers.onDone(markdown, [
      'What are the biggest risks in this portfolio?',
      'Show supporting research',
      'What should I do about concentration risk?',
    ]);
  } catch (e) {
    if (handlers.signal?.aborted) {
      handlers.onError('Cancelled');
      return;
    }
    handlers.onError(e instanceof Error ? e.message : String(e));
  }
}
