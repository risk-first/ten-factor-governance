/**
 * Node-side LLM helpers adapted from OpenBB agent-rita (`lib/providers.ts`, MIT).
 * Agent loop + FDC3 deferred tools; Workspace SSE / widget bridge not used.
 */
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { type LanguageModel, type ModelMessage } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { runAgentLoop } from './agent/loop.js';
import { stageFile, type FileInput } from './agent/documents.js';
import { getSession, saveSession } from './agent/session-store.js';
import type { Artifact, Citation, StagedFile, ToolCallRequest, ToolResultPayload } from './agent/types.js';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

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
  onArtifact?: (artifact: Artifact) => void;
  onCitation?: (citation: Citation) => void;
  onFunctionCall?: (call: ToolCallRequest) => void;
  onDone: (
    markdown: string,
    meta?: { suggestions?: string[]; citations?: Citation[]; artifacts?: Artifact[] }
  ) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
};

export type RunHarnessTurnOpts = {
  sessionId: string;
  messages: ChatMessage[];
  modelHint?: string;
  /** New files to stage (fdc3.data.file payloads). */
  files?: FileInput[];
  /** Tool results from browser FDC3 execution (re-POST). */
  toolResults?: ToolResultPayload[];
  handlers: QueryStreamHandlers;
};

function toModelMessages(chat: ChatMessage[]): ModelMessage[] {
  return chat.map(m => ({
    role: m.role,
    content: m.content,
  }));
}

/** Stream an assistant reply (agent loop with optional FDC3 re-POST continuation). */
export async function runHarnessTurn(opts: RunHarnessTurnOpts): Promise<void> {
  const { sessionId, messages, modelHint, files: fileInputs, toolResults, handlers } = opts;
  const model = resolveModel(modelHint);
  const latest = [...messages].reverse().find(m => m.role === 'user')?.content?.trim() || 'Hello';

  if (!model) {
    const fallback =
      'No LLM provider is configured on the Agent harness.\n\n' +
      'Set `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, or `OLLAMA_BASE_URL` ' +
      'in the AIPA `.env` (see `server-apps/agent-harness/.env.example`).\n\n' +
      `You asked: “${latest}”.`;
    handlers.onStatus('Using offline fallback (no provider keys)');
    for (const chunk of fallback.match(/.{1,24}/gs) ?? [fallback]) {
      if (handlers.signal?.aborted) break;
      handlers.onText(chunk);
      await new Promise(r => setTimeout(r, 12));
    }
    handlers.onDone(fallback, {
      suggestions: [
        'What are the biggest risks in this portfolio?',
        'Gather research on the top holdings',
      ],
    });
    return;
  }

  let session = getSession(sessionId);
  const stagedFiles: Map<string, StagedFile> = session?.files ?? new Map();

  if (fileInputs?.length) {
    for (const f of fileInputs) {
      const staged = await stageFile(f);
      if (staged) stagedFiles.set(staged.id, staged);
    }
  }

  let modelMessages: ModelMessage[];
  if (toolResults?.length && session?.messages?.length) {
    modelMessages = session.messages;
  } else {
    modelMessages = toModelMessages(messages);
  }

  await runAgentLoop(
    {
      model,
      modelMessages,
      files: stagedFiles,
      toolResults,
    },
    {
      signal: handlers.signal,
      onStatus: handlers.onStatus,
      onText: handlers.onText,
      onArtifact: a => handlers.onArtifact?.(a),
      onCitation: c => handlers.onCitation?.(c),
      onFunctionCall: (call, continueMessages) => {
        saveSession(sessionId, { messages: continueMessages, files: stagedFiles });
        handlers.onFunctionCall?.(call);
      },
      onDone: (markdown, meta, continueMessages) => {
        saveSession(sessionId, {
          messages: [...continueMessages, { role: 'assistant', content: markdown }],
          files: stagedFiles,
        });
        handlers.onDone(markdown, meta);
      },
      onError: handlers.onError,
    }
  );
}

export { resolveModel };
