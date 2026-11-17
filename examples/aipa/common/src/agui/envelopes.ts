/**
 * FDC3 envelopes for AG-UI 1.0 payloads on a PrivateChannel.
 * Only wraps published AG-UI types (`RunAgentInput`, `Event`).
 */

import type { BaseEvent, RunAgentInput } from '@ag-ui/client';
import { CONTEXT_TYPES, type AgentQuery } from '../contexts/types.ts';

export const AGUI_PROTOCOL_VERSION = '1.0';

export type AguiRun = {
  type: 'fdc3.ai.agui.run';
  input: RunAgentInput;
};

export type AguiEvent = {
  type: 'fdc3.ai.agui.event';
  /** Monotonic per PrivateChannel session (FDC3 ordering, not AG-UI). */
  seq: number;
  event: BaseEvent;
};

export function isAgentQuery(ctx: { type?: string }): ctx is AgentQuery {
  return ctx.type === CONTEXT_TYPES.agentQuery;
}

export function isAguiRun(ctx: { type?: string }): ctx is AguiRun {
  return ctx.type === CONTEXT_TYPES.aguiRun;
}

export function isAguiEvent(ctx: { type?: string }): ctx is AguiEvent {
  return ctx.type === CONTEXT_TYPES.aguiEvent;
}

export function encodeAgentQuery(partial?: Omit<AgentQuery, 'type'>): AgentQuery {
  return { type: CONTEXT_TYPES.agentQuery, ...partial };
}

export function encodeAguiRun(input: RunAgentInput): AguiRun {
  return { type: CONTEXT_TYPES.aguiRun, input };
}

export function encodeAguiEvent(seq: number, event: BaseEvent): AguiEvent {
  return { type: CONTEXT_TYPES.aguiEvent, seq, event };
}

/** Monotonic seq allocator for one PrivateChannel session (harness → UI). */
export function createSeqAllocator(start = 1): { next(): number; peek(): number } {
  let seq = start;
  return {
    next: () => seq++,
    peek: () => seq,
  };
}

/**
 * Ordered event applicator for the UI transport.
 * Buffers gaps briefly; ignores duplicates and seq ≤ lastApplied.
 */
export function createOrderedEventApplicator(opts?: {
  maxBuffer?: number;
  onEvent: (event: BaseEvent, seq: number) => void;
}): {
  push(seq: number, event: BaseEvent): void;
  reset(): void;
  lastApplied(): number;
} {
  const maxBuffer = opts?.maxBuffer ?? 64;
  const onEvent = opts?.onEvent ?? (() => undefined);
  let last = 0;
  const pending = new Map<number, BaseEvent>();

  const flush = () => {
    while (pending.has(last + 1)) {
      last += 1;
      const ev = pending.get(last)!;
      pending.delete(last);
      onEvent(ev, last);
    }
  };

  return {
    push(seq, event) {
      if (!Number.isFinite(seq) || seq < 1) return;
      if (seq <= last) return;
      if (seq === last + 1) {
        last = seq;
        onEvent(event, seq);
        flush();
        return;
      }
      if (pending.size >= maxBuffer) {
        const keys = [...pending.keys()].sort((a, b) => a - b);
        for (const k of keys) {
          if (k <= last) {
            pending.delete(k);
            continue;
          }
          break;
        }
      }
      pending.set(seq, event);
      flush();
    },
    reset() {
      last = 0;
      pending.clear();
    },
    lastApplied: () => last,
  };
}
