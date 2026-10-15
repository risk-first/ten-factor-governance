/**
 * Slim agent loop adapted from OpenBB Agent Rita agent/loop.ts (MIT).
 * FDC3 tools have no execute — pending tool calls are returned for browser re-POST.
 */

import { streamText, stepCountIs, hasToolCall, type ModelMessage } from 'ai';
import type { LanguageModel } from 'ai';
import { SYSTEM_PROMPT } from './prompt.js';
import { makeNativeTools } from './tools/native.js';
import { makeDocumentTools } from './tools/documents.js';
import { makeFdc3Tools, isFdc3Tool, FDC3_TOOL_NAMES } from './tools/fdc3.js';
import { mergeCitations } from './citations.js';
import type {
  Artifact,
  Citation,
  StagedFile,
  ToolCallRequest,
  ToolResultPayload,
} from './types.js';

export type AgentLoopHandlers = {
  onStatus: (message: string) => void;
  onText: (delta: string) => void;
  onArtifact: (artifact: Artifact) => void;
  onCitation: (citation: Citation) => void;
  /** Called when an FDC3 tool must run in the browser; messages include assistant tool-calls. */
  onFunctionCall: (call: ToolCallRequest, continueMessages: ModelMessage[]) => void;
  onDone: (
    markdown: string,
    meta: { suggestions?: string[]; citations: Citation[]; artifacts: Artifact[] },
    continueMessages: ModelMessage[]
  ) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
};

export type AgentLoopInput = {
  model: LanguageModel;
  /** Prior chat as simple user/assistant alternating, plus tool messages from re-POST. */
  modelMessages: ModelMessage[];
  files: Map<string, StagedFile>;
  toolResults?: ToolResultPayload[];
};

const MAX_STEPS = 8;

function truncateJson(value: unknown, max = 12_000): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value, null, 0);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[truncated]`;
}

export async function runAgentLoop(input: AgentLoopInput, handlers: AgentLoopHandlers): Promise<void> {
  const citations: Citation[] = [];
  const artifacts: Artifact[] = [];
  let suggestions: string[] | undefined;

  const pushCitation = (c: Citation) => {
    citations.push(c);
    handlers.onCitation(c);
  };

  const tools = {
    ...makeNativeTools({
      onStatus: handlers.onStatus,
      onArtifact: a => {
        artifacts.push(a);
        handlers.onArtifact(a);
      },
      setSuggestions: s => {
        suggestions = s;
      },
    }),
    ...makeDocumentTools({
      files: input.files,
      onCitation: pushCitation,
    }),
    ...makeFdc3Tools(),
  };

  let messages = [...input.modelMessages];

  // Append tool results from a browser re-POST before continuing.
  if (input.toolResults?.length) {
    for (const tr of input.toolResults) {
      messages.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            output: {
              type: 'text',
              value: truncateJson(tr.isError ? { error: tr.result } : tr.result),
            },
          },
        ],
      } as ModelMessage);
      if (isFdc3Tool(tr.toolName) && !tr.isError) {
        pushCitation({
          id: `fdc3:${tr.toolName}:${tr.toolCallId}`,
          source: 'fdc3',
          title: tr.toolName,
        });
      }
    }
    handlers.onStatus('Continuing after FDC3 tool result…');
  }

  handlers.onStatus('Calling model…');
  let full = '';

  try {
    const result = streamText({
      model: input.model,
      system: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: [
        stepCountIs(MAX_STEPS),
        // End-of-turn tool — do not keep stepping or the model repeats the answer.
        hasToolCall('suggest_followups'),
        ...FDC3_TOOL_NAMES.map(name => hasToolCall(name)),
      ],
      abortSignal: handlers.signal,
    });

    for await (const part of result.fullStream) {
      if (handlers.signal?.aborted) break;
      if (part.type === 'text-delta') {
        const delta = part.text;
        full += delta;
        handlers.onText(delta);
      } else if (part.type === 'tool-call') {
        handlers.onStatus(`Tool: ${part.toolName}`);
      }
    }

    const response = await result.response;
    const continueMessages: ModelMessage[] = [
      ...messages,
      ...(response.messages as ModelMessage[]),
    ];

    const toolCalls = await result.toolCalls;
    const pendingFdc3: ToolCallRequest[] = [];
    for (const tc of toolCalls) {
      if (!isFdc3Tool(tc.toolName)) continue;
      const answered = input.toolResults?.some(t => t.toolCallId === tc.toolCallId);
      if (answered) continue;
      pendingFdc3.push({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: ((tc as { input?: Record<string, unknown> }).input ??
          (tc as { args?: Record<string, unknown> }).args ??
          {}) as Record<string, unknown>,
      });
    }

    if (pendingFdc3.length > 0 && !handlers.signal?.aborted) {
      handlers.onFunctionCall(pendingFdc3[0]!, continueMessages);
      return;
    }

    if (!full.trim()) {
      full = (await result.text) || '';
    }
    const markdown = full.trim() || '_No response._';
    handlers.onDone(
      markdown,
      {
        suggestions,
        citations: mergeCitations(citations),
        artifacts,
      },
      continueMessages
    );
  } catch (e) {
    if (handlers.signal?.aborted) {
      handlers.onError('Cancelled');
      return;
    }
    handlers.onError(e instanceof Error ? e.message : String(e));
  }
}
