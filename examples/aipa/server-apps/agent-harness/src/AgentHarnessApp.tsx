import { useCallback, useEffect, useRef, useState } from 'react';
import type { Channel, Context, ContextMetadata, DesktopAgent, Listener, PrivateChannel } from '@finos/fdc3';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import {
  CONTEXT_TYPES,
  INTENTS,
  type AgentAnswer,
  type AgentCancel,
  type AgentDelta,
  type AgentQuery,
  type Fdc3DataFile,
} from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import { executeFdc3Tool, type ContextCache } from './fdc3Executor.ts';

type LogLine = { t: number; msg: string };

type ChatTurn = { role: 'user' | 'assistant'; content: string };

type PendingFile = {
  id: string;
  name: string;
  format: Fdc3DataFile['format'];
  content_b64?: string;
  url?: string;
};

type ChannelSession = {
  id: string;
  channel: PrivateChannel;
  label: string;
  color: string;
  contextsSent: number;
  remoteListeners: number;
  /** Prior turns for this PrivateChannel (sent to the LLM on follow-ups). */
  history: ChatTurn[];
  /** Files staged from fdc3.data.file on this channel. */
  pendingFiles: PendingFile[];
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

const HARNESS_LISTENER_TYPES = [
  CONTEXT_TYPES.agentCancel,
  CONTEXT_TYPES.agentQuery,
  CONTEXT_TYPES.file,
] as const;

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

async function readSseTurn(
  body: Record<string, unknown>,
  signal: AbortSignal,
  log: (msg: string) => void,
  broadcast: (ctx: AgentDelta | AgentAnswer) => Promise<void>,
  onFunctionCall: (call: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
  }) => Promise<void>
): Promise<{
  markdown: string;
  suggestions?: string[];
  citations?: Record<string, unknown>[];
  artifacts?: Record<string, unknown>[];
  deferred: boolean;
} | null> {
  const res = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  let citations: Record<string, unknown>[] | undefined;
  let artifacts: Record<string, unknown>[] | undefined;
  let deferred = false;

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
      } else if (event === 'artifact') {
        const artifact = payload.artifact as Record<string, unknown>;
        await broadcast({
          type: CONTEXT_TYPES.agentDelta,
          kind: 'artifact',
          payload: { artifact },
        });
      } else if (event === 'citation') {
        const citation = payload.citation as Record<string, unknown>;
        await broadcast({
          type: CONTEXT_TYPES.agentDelta,
          kind: 'citation',
          payload: { citation },
        });
      } else if (event === 'function_call') {
        deferred = true;
        await onFunctionCall({
          toolCallId: String(payload.toolCallId ?? ''),
          toolName: String(payload.toolName ?? ''),
          args: (payload.args as Record<string, unknown>) ?? {},
        });
      } else if (event === 'done') {
        markdown = String(payload.markdown ?? markdown);
        suggestions = Array.isArray(payload.suggestions)
          ? (payload.suggestions as string[])
          : undefined;
        citations = Array.isArray(payload.citations)
          ? (payload.citations as Record<string, unknown>[])
          : undefined;
        artifacts = Array.isArray(payload.artifacts)
          ? (payload.artifacts as Record<string, unknown>[])
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
  if (signal.aborted) return null;
  return { markdown, suggestions, citations, artifacts, deferred };
}

async function streamQueryToChannel(
  query: AgentQuery,
  priorHistory: ChatTurn[],
  sessionId: string,
  pendingFiles: PendingFile[],
  signal: AbortSignal,
  log: (msg: string) => void,
  broadcast: (ctx: AgentDelta | AgentAnswer) => Promise<void>,
  fdc3: DesktopAgent,
  contextCache: ContextCache,
  channelCache: Map<string, Channel>
): Promise<ChatTurn[] | null> {
  const userText = (query.text ?? '').trim();
  const messages: ChatTurn[] = [
    ...priorHistory,
    ...(userText ? [{ role: 'user' as const, content: userText }] : []),
  ];
  log(`LLM turn (${messages.length} msg${messages.length === 1 ? '' : 's'})`);

  const fileIds = query.fileIds;
  const filesForPost = pendingFiles
    .filter(f => !fileIds?.length || fileIds.includes(f.id))
    .map(f => ({
      id: f.id,
      name: f.name,
      format: f.format,
      content_b64: f.content_b64,
      url: f.url,
    }));

  let toolResults: { toolCallId: string; toolName: string; result: unknown; isError?: boolean }[] | undefined;
  const maxRounds = 12;

  for (let round = 0; round < maxRounds; round++) {
    const turn = await readSseTurn(
      {
        sessionId,
        messages,
        text: userText,
        model: query.model,
        files: round === 0 ? filesForPost : undefined,
        toolResults,
      },
      signal,
      log,
      broadcast,
      async call => {
        log(`FDC3 tool ${call.toolName}`);
        try {
          const result = await executeFdc3Tool(fdc3, call.toolName, call.args, {
            contextCache,
            channelCache,
          });
          toolResults = [
            { toolCallId: call.toolCallId, toolName: call.toolName, result },
          ];
        } catch (e) {
          toolResults = [
            {
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              result: e instanceof Error ? e.message : String(e),
              isError: true,
            },
          ];
        }
      }
    );

    if (!turn) return null;
    if (turn.deferred) {
      // toolResults populated by onFunctionCall; loop to re-POST
      continue;
    }

    const answerMarkdown = turn.markdown.trim() || '_No response._';
    const answer: AgentAnswer = {
      type: CONTEXT_TYPES.agentAnswer,
      markdown: answerMarkdown,
      ...(turn.suggestions ? { suggestions: turn.suggestions } : {}),
      ...(turn.citations ? { citations: turn.citations } : {}),
      ...(turn.artifacts ? { artifacts: turn.artifacts } : {}),
    };
    await broadcast(answer);
    log('agentAnswer sent');
    if (!userText) return priorHistory;
    return [...messages, { role: 'assistant', content: answerMarkdown }];
  }

  throw new Error('Exceeded FDC3 tool re-POST rounds');
}

export function AgentHarnessApp() {
  const [sessions, setSessions] = useState<ChannelSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const fdc3Ref = useRef<DesktopAgent | null>(null);
  const sessionsRef = useRef<ChannelSession[]>([]);
  const colorIdx = useRef(0);
  const drawer = useRef(mountStatusDrawer());
  const contextCacheRef = useRef<ContextCache>(new Map());
  const channelCacheRef = useRef<Map<string, Channel>>(new Map());

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

      // Cache user-channel contexts for fdc3_get_current_channel_context.
      try {
        await fdc3.addContextListener(null, (ctx: Context) => {
          if (ctx?.type) contextCacheRef.current.set(ctx.type, ctx);
        });
      } catch {
        /* optional */
      }

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
          history: [],
          pendingFiles: [],
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
            if (c.type === CONTEXT_TYPES.file) {
              const file = c as Fdc3DataFile;
              const fileId = file.id?.fileId;
              if (!fileId) return;
              log(`staged file ${file.name} (${fileId})`);
              updateSession(id, s => ({
                ...s,
                pendingFiles: [
                  ...s.pendingFiles.filter(f => f.id !== fileId),
                  {
                    id: fileId,
                    name: file.name,
                    format: file.format,
                    content_b64: file.content_b64,
                    url: file.url,
                  },
                ],
              }));
              return;
            }
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
              const prior = current?.history ?? [];
              const files = current?.pendingFiles ?? [];
              const ac = new AbortController();
              updateSession(id, { abort: ac });
              const da = fdc3Ref.current;
              if (!da) {
                log('No DesktopAgent for FDC3 tools');
                return;
              }
              try {
                const nextHistory = await streamQueryToChannel(
                  followUp,
                  prior,
                  id,
                  files,
                  ac.signal,
                  log,
                  broadcast,
                  da,
                  contextCacheRef.current,
                  channelCacheRef.current
                );
                if (nextHistory) updateSession(id, { history: nextHistory });
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
          const current = sessionsRef.current.find(s => s.id === id);
          const prior = current?.history ?? [];
          const files = current?.pendingFiles ?? [];
          const ac = new AbortController();
          updateSession(id, { abort: ac });
          void (async () => {
            try {
              await broadcast({
                type: CONTEXT_TYPES.agentDelta,
                kind: 'status',
                payload: { message: 'Harness received AskAgent', group: 'reasoning' },
              } as AgentDelta);
              const da = fdc3Ref.current;
              if (!da) {
                log('No DesktopAgent for FDC3 tools');
                return;
              }
              const nextHistory = await streamQueryToChannel(
                query,
                prior,
                id,
                files,
                ac.signal,
                log,
                broadcast,
                da,
                contextCacheRef.current,
                channelCacheRef.current
              );
              if (nextHistory) updateSession(id, { history: nextHistory });
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
