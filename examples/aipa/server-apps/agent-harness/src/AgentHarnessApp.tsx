import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContextMetadata, DesktopAgent, Listener, PrivateChannel } from '@finos/fdc3';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import {
  CONTEXT_TYPES,
  INTENTS,
  type AgentAnswer,
  type AgentCancel,
  type AgentDelta,
  type AgentQuery,
} from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';

type LogLine = { t: number; msg: string };

type ChannelSession = {
  id: string;
  channel: PrivateChannel;
  label: string;
  color: string;
  contextsSent: number;
  remoteListeners: number;
  lines: LogLine[];
  abort: AbortController | null;
  /** Local FDC3 listeners to unsubscribe on disconnect. */
  cleanup: Listener[];
};

const COLORS = [
  '#175cd3',
  '#12b76a',
  '#f04438',
  '#7a5af8',
  '#f79009',
  '#0e9384',
  '#ee46bc',
  '#e04f16',
];

function shortId(instanceId?: string): string {
  if (!instanceId) return '????';
  return instanceId.length <= 8 ? instanceId : instanceId.slice(-6);
}

function sourceLabel(meta?: ContextMetadata): string {
  const appId = meta?.source?.appId ?? 'unknown';
  const shortApp = appId.replace(/^aipa-/, '');
  return `${shortApp} · ${shortId(meta?.source?.instanceId)}`;
}

const HARNESS_LISTENER_TYPES = [CONTEXT_TYPES.agentCancel, CONTEXT_TYPES.agentQuery] as const;

/** Collect singular/plural context types from a PrivateChannel addContextListener event. */
function eventContextTypes(event: unknown): string[] {
  if (!event || typeof event !== 'object') return [];
  const e = event as {
    contextType?: string | null;
    contextTypes?: string[];
    details?: { contextType?: string | null; contextTypes?: string[] };
  };
  const types: string[] = [];
  const singular = e.contextType ?? e.details?.contextType;
  if (typeof singular === 'string') types.push(singular);
  const plural = e.contextTypes ?? e.details?.contextTypes;
  if (Array.isArray(plural)) {
    for (const t of plural) if (typeof t === 'string') types.push(t);
  }
  return [...new Set(types)];
}

function isUiChannelListener(types: string[]): boolean {
  return types.includes(CONTEXT_TYPES.agentDelta) || types.includes(CONTEXT_TYPES.agentAnswer);
}

async function streamQueryToChannel(
  query: AgentQuery,
  signal: AbortSignal,
  log: (msg: string) => void,
  broadcast: (ctx: AgentDelta | AgentAnswer) => Promise<void>
): Promise<void> {
  const res = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: query.text ?? '', model: query.model }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Harness LLM proxy failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let markdown = '';
  let suggestions: string[] | undefined;

  const flushEvents = async (chunk: string) => {
    buffer += chunk;
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const lines = part.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      const payload = JSON.parse(data) as Record<string, unknown>;
      if (event === 'status') {
        log(String(payload.message ?? 'status'));
        await broadcast({
          type: CONTEXT_TYPES.agentDelta,
          kind: 'status',
          payload: { message: payload.message, group: 'reasoning' },
        });
      } else if (event === 'text') {
        const delta = String(payload.delta ?? '');
        markdown += delta;
        await broadcast({
          type: CONTEXT_TYPES.agentDelta,
          kind: 'text',
          payload: { delta },
        });
      } else if (event === 'done') {
        markdown = String(payload.markdown ?? markdown);
        suggestions = Array.isArray(payload.suggestions)
          ? (payload.suggestions as string[])
          : undefined;
      } else if (event === 'error') {
        throw new Error(String(payload.message ?? 'stream error'));
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await flushEvents(decoder.decode(value, { stream: true }));
  }
  await flushEvents(decoder.decode());

  const answer: AgentAnswer = {
    type: CONTEXT_TYPES.agentAnswer,
    markdown: markdown.trim() || '_No response._',
    ...(suggestions ? { suggestions } : {}),
  };
  await broadcast(answer);
  log('agentAnswer sent');
}

export function AgentHarnessApp() {
  const [sessions, setSessions] = useState<ChannelSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const fdc3Ref = useRef<DesktopAgent | null>(null);
  const sessionsRef = useRef<ChannelSession[]>([]);
  const colorIdx = useRef(0);
  const drawer = useRef(mountStatusDrawer());

  const syncSessions = useCallback((next: ChannelSession[]) => {
    sessionsRef.current = next;
    setSessions(next);
  }, []);

  const updateSession = useCallback(
    (id: string, patch: Partial<ChannelSession> | ((s: ChannelSession) => ChannelSession)) => {
      const next = sessionsRef.current.map(s => {
        if (s.id !== id) return s;
        return typeof patch === 'function' ? patch(s) : { ...s, ...patch };
      });
      syncSessions(next);
    },
    [syncSessions]
  );

  const logToSession = useCallback(
    (id: string, msg: string) => {
      updateSession(id, s => ({
        ...s,
        lines: [...s.lines.slice(-80), { t: Date.now(), msg }],
      }));
      setStatus(drawer.current.statusEl, msg);
    },
    [updateSession]
  );

  const removeSession = useCallback(
    (id: string) => {
      const target = sessionsRef.current.find(s => s.id === id);
      if (!target) return;
      target.abort?.abort();
      for (const l of target.cleanup) {
        void l.unsubscribe().catch(() => undefined);
      }
      void target.channel.disconnect().catch(() => undefined);
      const next = sessionsRef.current.filter(s => s.id !== id);
      syncSessions(next);
      setActiveSessionId(prev => {
        if (prev !== id) return prev;
        return next[next.length - 1]?.id ?? null;
      });
    },
    [syncSessions]
  );

  const broadcastForSession = useCallback(
    (id: string, channel: PrivateChannel) =>
      async (ctx: AgentDelta | AgentAnswer) => {
        if (ctx.type === CONTEXT_TYPES.agentDelta) {
          const delta = ctx as AgentDelta;
          console.log(
            'fdc3.ai:',
            'context sent on PrivateChannel',
            CONTEXT_TYPES.agentDelta,
            delta.kind,
            delta.kind === 'text'
              ? String(delta.payload?.delta ?? '').slice(0, 40)
              : delta.payload?.message
          );
        } else {
          console.log(
            'fdc3.ai:',
            'context sent on PrivateChannel',
            CONTEXT_TYPES.agentAnswer,
            `${(ctx as AgentAnswer).markdown.length} chars`
          );
        }
        await channel.broadcast(ctx as Parameters<PrivateChannel['broadcast']>[0]);
        updateSession(id, s => ({ ...s, contextsSent: s.contextsSent + 1 }));
      },
    [updateSession]
  );

  useEffect(() => {
    let intentListener: Listener | null = null;
    let cancelled = false;

    void (async () => {
      const fdc3 = await connectAgent(drawer.current.statusEl);
      if (cancelled || !fdc3) return;
      fdc3Ref.current = fdc3;

      intentListener = await fdc3.addIntentListener(INTENTS.AskAgent, async (ctx, metadata) => {
        const query = (ctx ?? { type: CONTEXT_TYPES.agentQuery }) as AgentQuery;
        console.log('fdc3.ai:', 'intent received', INTENTS.AskAgent, {
          source: metadata?.source,
          text: query.text?.slice(0, 80) || '(session open)',
        });
        const channel = await fdc3.createPrivateChannel();
        const id = `ch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const color = COLORS[colorIdx.current % COLORS.length]!;
        colorIdx.current += 1;
        const label = sourceLabel(metadata);
        console.log('fdc3.ai:', 'PrivateChannel created', channel.id, 'session', id);

        const session: ChannelSession = {
          id,
          channel,
          label,
          color,
          contextsSent: 0,
          remoteListeners: 0,
          lines: [],
          abort: null,
          cleanup: [],
        };
        syncSessions([...sessionsRef.current, session]);
        setActiveSessionId(id);
        logToSession(id, `AskAgent from ${label}: ${query.text?.slice(0, 80) || '(session open)'}`);

        const log = (msg: string) => logToSession(id, msg);
        const broadcast = broadcastForSession(id, channel);

        // One multi-type listener for inbound cancel / follow-up query.
        // Register before PrivateChannel event listeners so Sail's non-replaying
        // addContextListener notification for this local add is not observed.
        const channelListener = await channel.addContextListener(
          [...HARNESS_LISTENER_TYPES],
          async c => {
            if (c.type === CONTEXT_TYPES.agentCancel) {
              const cancel = c as AgentCancel;
              console.log(
                'fdc3.ai:',
                'context received on PrivateChannel',
                CONTEXT_TYPES.agentCancel,
                cancel.reason ?? 'unspecified'
              );
              log(`agentCancel (${cancel.reason ?? 'unspecified'})`);
              const current = sessionsRef.current.find(s => s.id === id);
              current?.abort?.abort();
              return;
            }
            if (c.type === CONTEXT_TYPES.agentQuery) {
              const followUp = c as AgentQuery;
              console.log(
                'fdc3.ai:',
                'context received on PrivateChannel',
                CONTEXT_TYPES.agentQuery,
                followUp.text?.slice(0, 80)
              );
              if (!followUp.text) return;
              log(`follow-up agentQuery`);
              const current = sessionsRef.current.find(s => s.id === id);
              current?.abort?.abort();
              const ac = new AbortController();
              updateSession(id, { abort: ac });
              try {
                await streamQueryToChannel(followUp, ac.signal, log, broadcast);
              } catch (e) {
                if (!ac.signal.aborted) {
                  log(e instanceof Error ? e.message : String(e));
                }
              }
            }
          }
        );
        console.log(
          'fdc3.ai:',
          'handler added: PrivateChannel.addContextListener',
          [...HARNESS_LISTENER_TYPES],
          'channel',
          channel.id
        );

        // Start the LLM stream once (when UI binds, or after a short fallback).
        // Must not await this before returning the channel — UI getResult() has to
        // resolve so the UI can addContextListener (FDC3 QuoteStream pattern).
        let streamStarted = false;
        const startStream = (reason: string) => {
          if (streamStarted || !query.text) return;
          streamStarted = true;
          console.log('fdc3.ai:', 'starting stream', reason);
          log(`Starting stream (${reason})`);
          const ac = new AbortController();
          updateSession(id, { abort: ac });
          void (async () => {
            try {
              await broadcast({
                type: CONTEXT_TYPES.agentDelta,
                kind: 'status',
                payload: { message: 'Harness received AskAgent', group: 'reasoning' },
              } as AgentDelta);
              await streamQueryToChannel(query, ac.signal, log, broadcast);
            } catch (e) {
              if (!ac.signal.aborted) log(e instanceof Error ? e.message : String(e));
            }
          })();
        };

        const onAdd = await channel.addEventListener('addContextListener', event => {
          const types = eventContextTypes(event);
          if (types.length > 0 && !isUiChannelListener(types)) return;
          updateSession(id, s => ({ ...s, remoteListeners: s.remoteListeners + 1 }));
          log(`Remote listener added (${types.join(', ') || 'multi/any'})`);
          startStream('UI addContextListener');
        });
        console.log(
          'fdc3.ai:',
          'handler added: PrivateChannel.addEventListener',
          'addContextListener',
          'channel',
          channel.id
        );
        const onUnsub = await channel.addEventListener('unsubscribe', () => {
          updateSession(id, s => ({
            ...s,
            remoteListeners: Math.max(0, s.remoteListeners - 1),
          }));
        });
        const onDisconnect = await channel.addEventListener('disconnect', () => {
          log('Remote side disconnected');
          const target = sessionsRef.current.find(s => s.id === id);
          target?.abort?.abort();
          for (const l of target?.cleanup ?? []) {
            void l.unsubscribe().catch(() => undefined);
          }
          const next = sessionsRef.current.filter(s => s.id !== id);
          syncSessions(next);
          setActiveSessionId(prev => (prev !== id ? prev : next[next.length - 1]?.id ?? null));
        });

        // Fallback if Sail never delivers addContextListener events to the harness.
        const fallbackTimer = window.setTimeout(() => {
          startStream('fallback timeout (no addContextListener event)');
        }, 500);

        updateSession(id, s => ({
          ...s,
          cleanup: [
            channelListener,
            onAdd,
            onUnsub,
            onDisconnect,
            {
              unsubscribe: async () => {
                window.clearTimeout(fallbackTimer);
              },
            },
          ],
        }));

        // Return the PrivateChannel immediately so UI getResult() can resolve and bind.
        console.log('fdc3.ai:', 'intent result returned', INTENTS.AskAgent, `PrivateChannel id=${channel.id}`);
        return channel;
      });
      console.log('fdc3.ai:', 'handler added: DesktopAgent.addIntentListener', INTENTS.AskAgent);

      setReady(true);
      setStatus(drawer.current.statusEl, 'Listening for AskAgent (fdc3.ai)');
    })();

    return () => {
      cancelled = true;
      for (const s of sessionsRef.current) {
        s.abort?.abort();
        for (const l of s.cleanup) void l.unsubscribe().catch(() => undefined);
        void s.channel.disconnect().catch(() => undefined);
      }
      void intentListener?.unsubscribe();
    };
  }, [broadcastForSession, logToSession, syncSessions, updateSession]);

  const active = sessions.find(s => s.id === activeSessionId) ?? null;
  const lines = active?.lines ?? [];

  return (
    <div className="container">
      <div className="box" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <div className="toolbar ticker-bar" style={{ marginBottom: 8 }}>
          <div className="ticker-chips" aria-label="Active PrivateChannels">
            {sessions.map(s => {
              const isActive = s.id === activeSessionId;
              return (
                <div
                  key={s.id}
                  className={`ticker-chip${isActive ? '' : ' ticker-chip--dimmed'}`}
                  style={{ color: isActive ? s.color : undefined }}
                  data-active={isActive ? 'true' : 'false'}
                  title={`${s.label} — ${s.contextsSent} contexts sent, ${s.remoteListeners} listeners`}
                >
                  <button
                    type="button"
                    className="ticker-chip__focus"
                    onClick={() => setActiveSessionId(s.id)}
                  >
                    <span className="ticker-chip__swatch" style={{ background: s.color }} />
                    <span>{s.label}</span>
                    <span className="ticker-chip__name">
                      {s.contextsSent} ctx · {s.remoteListeners} ls
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ticker-chip__remove"
                    aria-label={`Disconnect ${s.label}`}
                    onClick={() => removeSession(s.id)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <span className="note" style={{ margin: 0 }}>
            {ready ? (sessions.length ? `${sessions.length} channel${sessions.length === 1 ? '' : 's'}` : 'ready') : 'connecting…'}
          </span>
        </div>

        <pre
          className="ex"
          style={{
            flex: 1,
            minHeight: 240,
            overflow: 'auto',
            background: '#f8fafc',
            padding: 12,
            borderRadius: 8,
            margin: 0,
          }}
        >
          {!active
            ? 'Waiting for Agent UI…'
            : lines.length === 0
              ? `Session ${active.label} — no log yet`
              : lines.map(l => `${new Date(l.t).toISOString().slice(11, 19)}  ${l.msg}`).join('\n')}
        </pre>
      </div>
    </div>
  );
}
