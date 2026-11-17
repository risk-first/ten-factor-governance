/**
 * AG-UI AbstractAgent that wraps the existing AIPA harness agent loop.
 * Registered in CopilotRuntime so the harness browser can HttpAgent against it.
 * FDC3 tools have no server execute — pending calls are emitted as TOOL_CALL_* and
 * the run finishes; the harness browser fulfills them and starts a continuation run.
 */

import {
  AbstractAgent,
  EventType,
  type AgentConfig,
  type BaseEvent,
  type Message,
  type RunAgentInput,
  type ToolMessage,
} from '@ag-ui/client';
import { Observable } from 'rxjs';
import { runHarnessTurn, type ChatMessage } from '../llm.js';
import type { FileInput } from '../agent/documents.js';
import type { ToolResultPayload } from '../agent/types.js';
import { isFdc3Tool } from '../agent/tools/fdc3.js';

export type AipaLoopAgentConfig = AgentConfig & {
  modelHint?: string;
};

function textOf(content: Message['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(part => {
      if (!part || typeof part !== 'object') return '';
      if ('text' in part && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
      return '';
    })
    .join('');
}

function chatMessagesFromAgui(messages: Message[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      const content = textOf(m.content).trim();
      if (content) out.push({ role: 'user', content });
    } else if (m.role === 'assistant') {
      const content = textOf(m.content).trim();
      if (content) out.push({ role: 'assistant', content });
    }
  }
  return out;
}

function toolResultsFromAgui(messages: Message[]): ToolResultPayload[] {
  const out: ToolResultPayload[] = [];
  for (const m of messages) {
    if (m.role !== 'tool') continue;
    const tm = m as ToolMessage;
    const toolCallId = String(tm.toolCallId ?? '');
    if (!toolCallId) continue;
    let result: unknown = textOf(tm.content);
    try {
      result = JSON.parse(String(result));
    } catch {
      /* keep string */
    }
    const meta = (tm as { metadata?: { toolName?: string } }).metadata;
    out.push({
      toolCallId,
      toolName: String(
        meta?.toolName ?? (tm as { toolName?: string }).toolName ?? 'tool'
      ),
      result,
      isError: Boolean((tm as { error?: unknown }).error),
    });
  }
  return out;
}

function filesFromForwarded(props: Record<string, unknown> | undefined): FileInput[] {
  if (!props) return [];
  const raw = props.files;
  if (!Array.isArray(raw)) return [];
  const out: FileInput[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const id = String((f as { id?: string }).id ?? (f as { fileId?: string }).fileId ?? '');
    const name = String((f as { name?: string }).name ?? '');
    const format = (f as { format?: string }).format;
    if (!id || !name) continue;
    if (format !== 'pdf' && format !== 'docx' && format !== 'txt' && format !== 'md' && format !== 'html') {
      continue;
    }
    out.push({
      id,
      name,
      format,
      content_b64:
        typeof (f as { content_b64?: string }).content_b64 === 'string'
          ? (f as { content_b64: string }).content_b64
          : undefined,
      url: typeof (f as { url?: string }).url === 'string' ? (f as { url: string }).url : undefined,
    });
  }
  return out;
}

export class AipaLoopAgent extends AbstractAgent {
  modelHint?: string;

  constructor(config: AipaLoopAgentConfig = {}) {
    super(config);
    this.modelHint = config.modelHint;
  }

  clone(): AipaLoopAgent {
    const cloned = super.clone() as AipaLoopAgent;
    cloned.modelHint = this.modelHint;
    return cloned;
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>(subscriber => {
      const ac = new AbortController();
      const { threadId, runId } = input;
      const messageId = crypto.randomUUID();
      let textStarted = false;
      let finished = false;

      const emit = (event: BaseEvent) => {
        if (finished) return;
        subscriber.next(event);
      };

      const finishOk = () => {
        if (finished) return;
        emit({ type: EventType.RUN_FINISHED, threadId, runId } as BaseEvent);
        finished = true;
        subscriber.complete();
      };

      const finishErr = (message: string) => {
        if (finished) return;
        emit({ type: EventType.RUN_ERROR, message } as BaseEvent);
        finished = true;
        subscriber.complete();
      };

      emit({ type: EventType.RUN_STARTED, threadId, runId } as BaseEvent);

      const forwarded =
        input.forwardedProps && typeof input.forwardedProps === 'object'
          ? (input.forwardedProps as Record<string, unknown>)
          : undefined;
      const modelHint =
        (typeof forwarded?.model === 'string' ? forwarded.model : undefined) || this.modelHint;
      const sessionId = threadId || `anon-${Date.now()}`;
      let chatMessages = chatMessagesFromAgui(input.messages ?? []);
      const toolResults = toolResultsFromAgui(input.messages ?? []);
      const files = filesFromForwarded(forwarded);

      // Surface CopilotKit useAgentContext entries (AG-UI `context`) to the model.
      if (Array.isArray(input.context) && input.context.length && !toolResults.length) {
        const lines = input.context.map(c => {
          const desc = String((c as { description?: string }).description ?? 'context');
          const raw = (c as { value?: unknown }).value;
          const value = typeof raw === 'string' ? raw : JSON.stringify(raw ?? null);
          return `- ${desc}: ${value}`;
        });
        const note = `\n\n[Application context from the Agent UI]\n${lines.join('\n')}`;
        const lastUser = [...chatMessages].reverse().find(m => m.role === 'user');
        if (lastUser) {
          lastUser.content = `${lastUser.content}${note}`;
        } else {
          chatMessages = [{ role: 'user', content: note.trim() }];
        }
      }

      void runHarnessTurn({
        sessionId,
        messages: chatMessages.length ? chatMessages : [{ role: 'user', content: '' }],
        modelHint,
        files,
        toolResults: toolResults.length ? toolResults : undefined,
        handlers: {
          signal: ac.signal,
          onStatus: message => {
            emit({
              type: EventType.CUSTOM,
              name: 'status',
              value: { message },
            } as BaseEvent);
          },
          onText: delta => {
            if (!textStarted) {
              textStarted = true;
              emit({
                type: EventType.TEXT_MESSAGE_START,
                messageId,
                role: 'assistant',
              } as BaseEvent);
            }
            emit({
              type: EventType.TEXT_MESSAGE_CONTENT,
              messageId,
              delta,
            } as BaseEvent);
          },
          onArtifact: artifact => {
            emit({
              type: EventType.CUSTOM,
              name: 'artifact',
              value: { artifact },
            } as BaseEvent);
          },
          onCitation: citation => {
            emit({
              type: EventType.CUSTOM,
              name: 'citation',
              value: { citation },
            } as BaseEvent);
          },
          onFunctionCall: call => {
            if (!isFdc3Tool(call.toolName) && !call.toolName) return;
            emit({
              type: EventType.TOOL_CALL_START,
              toolCallId: call.toolCallId,
              toolCallName: call.toolName,
              parentMessageId: messageId,
            } as BaseEvent);
            emit({
              type: EventType.TOOL_CALL_ARGS,
              toolCallId: call.toolCallId,
              delta: JSON.stringify(call.args ?? {}),
            } as BaseEvent);
            emit({
              type: EventType.TOOL_CALL_END,
              toolCallId: call.toolCallId,
            } as BaseEvent);
            // Pause for harness browser fulfillment — end text if open, then finish run.
            if (textStarted) {
              emit({ type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent);
            }
            finishOk();
          },
          onDone: (markdown, meta) => {
            if (!textStarted && markdown) {
              textStarted = true;
              emit({
                type: EventType.TEXT_MESSAGE_START,
                messageId,
                role: 'assistant',
              } as BaseEvent);
              emit({
                type: EventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: markdown,
              } as BaseEvent);
            }
            if (textStarted) {
              emit({ type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent);
            }
            if (meta?.suggestions?.length) {
              emit({
                type: EventType.CUSTOM,
                name: 'suggestions',
                value: { suggestions: meta.suggestions },
              } as BaseEvent);
            }
            if (meta?.citations?.length) {
              emit({
                type: EventType.CUSTOM,
                name: 'citations',
                value: { citations: meta.citations },
              } as BaseEvent);
            }
            if (meta?.artifacts?.length) {
              emit({
                type: EventType.CUSTOM,
                name: 'artifacts',
                value: { artifacts: meta.artifacts },
              } as BaseEvent);
            }
            finishOk();
          },
          onError: message => {
            finishErr(message);
          },
        },
      }).catch(e => {
        finishErr(e instanceof Error ? e.message : String(e));
      });

      return () => {
        ac.abort();
      };
    });
  }
}
