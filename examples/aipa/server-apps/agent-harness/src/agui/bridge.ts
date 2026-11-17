/**
 * Harness-side bridge: RunAgentInput → CopilotRuntime HttpAgent → AG-UI events,
 * with local FDC3 tool execution (deduped by toolCallId) under harness identity.
 *
 * Multi-round tool continuations are collapsed into one outer run for the UI:
 * only one RUN_STARTED / RUN_FINISHED pair is forwarded.
 */

import {
  EventType,
  HttpAgent,
  type BaseEvent,
  type Message,
  type RunAgentInput,
  type ToolCallArgsEvent,
  type ToolCallStartEvent,
} from '@ag-ui/client';
import type { Channel, DesktopAgent } from '@finos/fdc3';
import { executeFdc3Tool, type ContextCache } from '../fdc3Executor.js';
import { isFdc3Tool } from '../agent/tools/fdc3.js';

export const COPILOTKIT_AGENT_RUN_URL = '/api/copilotkit/agent/default/run';

type PendingTool = {
  toolCallId: string;
  toolCallName: string;
  argsJson: string;
};

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Run until the model finishes (no pending FDC3 tool), forwarding AG-UI events.
 * Desktop tools execute here; TOOL_CALL_RESULT is also forwarded to the UI.
 */
export async function runAguiWithDesktopTools(opts: {
  input: RunAgentInput;
  signal: AbortSignal;
  fdc3: DesktopAgent;
  contextCache: ContextCache;
  channelCache: Map<string, Channel>;
  onEvent: (event: BaseEvent) => void | Promise<void>;
  log?: (msg: string) => void;
  maxRounds?: number;
}): Promise<void> {
  const {
    signal,
    fdc3,
    contextCache,
    channelCache,
    onEvent,
    log = () => undefined,
    maxRounds = 12,
  } = opts;

  const outerThreadId = opts.input.threadId;
  const outerRunId = opts.input.runId;
  let input = opts.input;
  const executed = new Set<string>();
  let startedEmitted = false;
  let finishedEmitted = false;

  const files =
    input.forwardedProps &&
    typeof input.forwardedProps === 'object' &&
    Array.isArray((input.forwardedProps as { files?: unknown }).files)
      ? (input.forwardedProps as { files: unknown[] }).files
      : undefined;

  const emitFinished = async () => {
    if (finishedEmitted) return;
    finishedEmitted = true;
    await onEvent({
      type: EventType.RUN_FINISHED,
      threadId: outerThreadId,
      runId: outerRunId,
    } as BaseEvent);
  };

  const forward = async (event: BaseEvent, hasPendingTool: boolean) => {
    if (event.type === EventType.RUN_STARTED) {
      if (startedEmitted) return;
      startedEmitted = true;
      await onEvent({
        ...event,
        threadId: outerThreadId,
        runId: outerRunId,
      } as BaseEvent);
      return;
    }
    if (event.type === EventType.RUN_FINISHED) {
      // Suppress until the outer run truly ends (no pending desktop tool).
      if (hasPendingTool) return;
      await emitFinished();
      return;
    }
    if (event.type === EventType.RUN_ERROR) {
      finishedEmitted = true;
      await onEvent({
        ...event,
        threadId: outerThreadId,
        runId: outerRunId,
      } as BaseEvent);
      return;
    }
    await onEvent(event);
  };

  for (let round = 0; round < maxRounds; round++) {
    if (signal.aborted) return;

    let roundPending: PendingTool | null = null;

    await new Promise<void>((resolve, reject) => {
      const agent = new HttpAgent({ url: COPILOTKIT_AGENT_RUN_URL });
      if (signal.aborted) {
        resolve();
        return;
      }

      const onAbort = () => {
        agent.abortRun();
        resolve();
      };
      signal.addEventListener('abort', onAbort, { once: true });

      const sub = agent.run(input).subscribe({
        next: ev => {
          if (ev.type === EventType.TOOL_CALL_START) {
            const start = ev as ToolCallStartEvent;
            if (isFdc3Tool(start.toolCallName)) {
              roundPending = {
                toolCallId: start.toolCallId,
                toolCallName: start.toolCallName,
                argsJson: '',
              };
            }
          } else if (ev.type === EventType.TOOL_CALL_ARGS && roundPending) {
            const args = ev as ToolCallArgsEvent;
            if (args.toolCallId === roundPending.toolCallId) {
              roundPending.argsJson += args.delta;
            }
          }
          void forward(ev, Boolean(roundPending)).catch(() => undefined);
        },
        error: err => {
          signal.removeEventListener('abort', onAbort);
          reject(err);
        },
        complete: () => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        },
      });

      signal.addEventListener(
        'abort',
        () => {
          try {
            sub.unsubscribe();
          } catch {
            /* ignore */
          }
        },
        { once: true }
      );
    });

    if (signal.aborted) return;

    if (!roundPending) {
      await emitFinished();
      return;
    }

    if (executed.has(roundPending.toolCallId)) {
      log(`skip duplicate toolCallId ${roundPending.toolCallId}`);
      await emitFinished();
      return;
    }
    executed.add(roundPending.toolCallId);

    const args = parseArgs(roundPending.argsJson);
    log(`FDC3 tool ${roundPending.toolCallName}`);
    let result: unknown;
    let isError = false;
    try {
      result = await executeFdc3Tool(fdc3, roundPending.toolCallName, args, {
        contextCache,
        channelCache,
      });
    } catch (e) {
      isError = true;
      result = e instanceof Error ? e.message : String(e);
    }

    await onEvent({
      type: EventType.TOOL_CALL_RESULT,
      toolCallId: roundPending.toolCallId,
      content: typeof result === 'string' ? result : JSON.stringify(result),
      messageId: crypto.randomUUID(),
      role: 'tool',
    } as BaseEvent);

    const toolMessage = {
      id: crypto.randomUUID(),
      role: 'tool' as const,
      toolCallId: roundPending.toolCallId,
      content: typeof result === 'string' ? result : JSON.stringify(result),
      metadata: { toolName: roundPending.toolCallName },
      ...(isError ? { error: typeof result === 'string' ? result : 'tool error' } : {}),
    } as Message;

    input = {
      ...input,
      runId: crypto.randomUUID(),
      messages: [...(input.messages ?? []), toolMessage],
      forwardedProps: {
        ...(typeof input.forwardedProps === 'object' && input.forwardedProps
          ? input.forwardedProps
          : {}),
        ...(round === 0 && files ? { files } : { files: undefined }),
      },
    };
  }

  throw new Error('Exceeded FDC3 tool continuation rounds');
}
