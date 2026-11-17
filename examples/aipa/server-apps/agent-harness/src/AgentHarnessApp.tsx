import { useCallback, useEffect, useRef, useState } from 'react';
import type { Channel, Context, ContextMetadata, DesktopAgent, Listener, PrivateChannel } from '@finos/fdc3';
import type { BaseEvent, RunAgentInput } from '@ag-ui/client';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import {
  CONTEXT_TYPES,
  INTENTS,
  type AgentQuery,
  type Fdc3DataFile,
} from '../../../common/src/contexts/types.ts';
import {
  createSeqAllocator,
  encodeAguiEvent,
  isAgentQuery,
  isAguiRun,
} from '../../../common/src/agui/envelopes.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { ContextCache } from './fdc3Executor.ts';
import { runAguiWithDesktopTools } from './agui/bridge.ts';

type LogLine = { t: number; msg: string };

type HarnessTab = 'sessions' | 'tools';

type ToolCatalogEntry = {
  name: string;
  description: string;
  category: 'native' | 'documents' | 'fdc3';
};

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
  threadId: string;
  label: string;
  color: string;
  contextsSent: number;
  remoteListeners: number;
  pendingFiles: PendingFile[];
  lines: LogLine[];
  abort: AbortController | null;
  activeRunId: string | null;
  seq: ReturnType<typeof createSeqAllocator>;
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

const HARNESS_LISTENER_TYPES = [CONTEXT_TYPES.aguiRun, CONTEXT_TYPES.file] as const;

function shortId(instanceId?: string): string {
  if (!instanceId) return '????';
  return instanceId.length <= 8 ? instanceId : instanceId.slice(-6);
}

function sourceLabel(meta?: ContextMetadata): string {
  const appId = meta?.source?.appId ?? 'unknown';
  const shortApp = appId.replace(/^aipa-/, '');
  return `${shortApp} · ${shortId(meta?.source?.instanceId)}`;
}

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
  return types.includes(CONTEXT_TYPES.aguiEvent);
}

const TOOL_CATEGORY_LABEL: Record<ToolCatalogEntry['category'], string> = {
  native: 'Native',
  documents: 'Documents',
  fdc3: 'FDC3',
};

export function AgentHarnessApp() {
  const [sessions, setSessions] = useState<ChannelSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<HarnessTab>('sessions');
  const [tools, setTools] = useState<ToolCatalogEntry[]>([]);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [toolsLoading, setToolsLoading] = useState(false);
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

  const handleRun = useCallback(
    async (sessionId: string, input: RunAgentInput) => {
      const session = sessionsRef.current.find(s => s.id === sessionId);
      if (!session) return;
      const fdc3 = fdc3Ref.current;
      if (!fdc3) {
        logToSession(sessionId, 'No DesktopAgent for FDC3 tools');
        return;
      }

      session.abort?.abort();
      const ac = new AbortController();
      updateSession(sessionId, { abort: ac, activeRunId: input.runId });
      logToSession(sessionId, `agui.run ${input.runId}`);

      const existingForwarded =
        input.forwardedProps && typeof input.forwardedProps === 'object'
          ? (input.forwardedProps as Record<string, unknown>)
          : {};
      // Prefer files already on the run (UI-attached); merge any channel-staged extras.
      const fromRun = Array.isArray(existingForwarded.files)
        ? (existingForwarded.files as Array<Record<string, unknown>>)
        : [];
      const fromChannel = session.pendingFiles.map(f => ({
        id: f.id,
        name: f.name,
        format: f.format,
        content_b64: f.content_b64,
        url: f.url,
      }));
      const byId = new Map<string, Record<string, unknown>>();
      for (const f of [...fromChannel, ...fromRun]) {
        const id = String(f.id ?? f.fileId ?? '');
        if (id) byId.set(id, { ...f, id });
      }
      const filesForProps = [...byId.values()];

      const runInput: RunAgentInput = {
        ...input,
        threadId: session.threadId,
        forwardedProps: {
          ...existingForwarded,
          ...(filesForProps.length ? { files: filesForProps } : {}),
        },
      };
      if (filesForProps.length) {
        logToSession(
          sessionId,
          `files on run: ${filesForProps.map(f => String(f.name ?? f.id)).join(', ')}`
        );
      }

      const emit = async (event: BaseEvent) => {
        const current = sessionsRef.current.find(s => s.id === sessionId);
        if (!current || ac.signal.aborted) return;
        if (current.activeRunId && current.activeRunId !== input.runId) {
          // Allow continuation runIds from the bridge — track latest.
        }
        const seq = current.seq.next();
        await current.channel.broadcast(encodeAguiEvent(seq, event) as never);
        updateSession(sessionId, s => ({ ...s, contextsSent: s.contextsSent + 1 }));
      };

      try {
        await runAguiWithDesktopTools({
          input: runInput,
          signal: ac.signal,
          fdc3,
          contextCache: contextCacheRef.current,
          channelCache: channelCacheRef.current,
          onEvent: emit,
          log: msg => logToSession(sessionId, msg),
        });
        logToSession(sessionId, 'run finished');
      } catch (e) {
        if (!ac.signal.aborted) {
          logToSession(sessionId, e instanceof Error ? e.message : String(e));
        }
      } finally {
        updateSession(sessionId, s =>
          s.activeRunId === input.runId ? { ...s, abort: null, activeRunId: null } : s
        );
      }
    },
    [logToSession, updateSession]
  );

  useEffect(() => {
    let intentListener: Listener | null = null;
    let cancelled = false;

    void (async () => {
      const fdc3 = await connectAgent(drawer.current.statusEl);
      if (cancelled || !fdc3) return;
      fdc3Ref.current = fdc3;

      try {
        await fdc3.addContextListener(null, (ctx: Context) => {
          if (ctx?.type) contextCacheRef.current.set(ctx.type, ctx);
        });
      } catch {
        /* optional */
      }

      intentListener = await fdc3.addIntentListener(INTENTS.AskAgent, async (ctx, metadata) => {
        const query = (ctx ?? { type: CONTEXT_TYPES.agentQuery }) as AgentQuery;
        if (ctx && !isAgentQuery(ctx)) {
          // Accept empty / unknown AskAgent payloads as session bootstrap.
          console.log('fdc3.ai:', 'AskAgent with non-agentQuery context; treating as agentQuery', ctx.type);
        }
        console.log('fdc3.ai:', 'intent received', INTENTS.AskAgent, {
          source: metadata?.source,
          threadHint: query.threadId,
        });

        const channel = await fdc3.createPrivateChannel();
        const id = `ch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const threadId = query.threadId?.trim() || id;
        const color = COLORS[colorIdx.current % COLORS.length]!;
        colorIdx.current += 1;
        const label = sourceLabel(metadata);

        const session: ChannelSession = {
          id,
          channel,
          threadId,
          label,
          color,
          contextsSent: 0,
          remoteListeners: 0,
          pendingFiles: [],
          lines: [],
          abort: null,
          activeRunId: null,
          seq: createSeqAllocator(1),
          cleanup: [],
        };
        syncSessions([...sessionsRef.current, session]);
        setActiveSessionId(id);
        logToSession(id, `AskAgent from ${label} (thread ${threadId})`);

        const channelListener = await channel.addContextListener(
          [...HARNESS_LISTENER_TYPES],
          async c => {
            if (c.type === CONTEXT_TYPES.file) {
              const file = c as Fdc3DataFile;
              const fileId = file.id?.fileId;
              if (!fileId) return;
              logToSession(id, `staged file ${file.name} (${fileId})`);
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
            if (isAguiRun(c)) {
              const input = c.input;
              if (!input?.runId || !input.messages) {
                logToSession(id, 'agui.run missing runId/messages');
                return;
              }
              void handleRun(id, input);
            }
          }
        );

        const onAdd = await channel.addEventListener('addContextListener', event => {
          const types = eventContextTypes(event);
          if (types.length > 0 && !isUiChannelListener(types)) return;
          updateSession(id, s => ({ ...s, remoteListeners: s.remoteListeners + 1 }));
          logToSession(id, `Remote listener added (${types.join(', ') || 'multi/any'})`);
        });
        const onUnsub = await channel.addEventListener('unsubscribe', () => {
          // UI hung up its event listener (e.g. local abort) — stop the active run.
          const current = sessionsRef.current.find(s => s.id === id);
          current?.abort?.abort();
          updateSession(id, s => ({
            ...s,
            remoteListeners: Math.max(0, s.remoteListeners - 1),
          }));
        });
        const onDisconnect = await channel.addEventListener('disconnect', () => {
          logToSession(id, 'Remote side disconnected');
          const current = sessionsRef.current.find(s => s.id === id);
          current?.abort?.abort();
          removeSession(id);
        });

        updateSession(id, s => ({
          ...s,
          cleanup: [channelListener, onAdd, onUnsub, onDisconnect],
        }));

        return channel;
      });

      setReady(true);
      setStatus(drawer.current.statusEl, 'Listening for AskAgent');
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
  }, [handleRun, logToSession, removeSession, syncSessions, updateSession]);

  const active = sessions.find(s => s.id === activeSessionId) ?? null;
  const lines = active?.lines ?? [];

  const loadTools = useCallback(async () => {
    setToolsLoading(true);
    setToolsError(null);
    try {
      const res = await fetch('/api/tools');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `tools HTTP ${res.status}`);
      }
      const body = (await res.json()) as { tools?: ToolCatalogEntry[] };
      setTools(Array.isArray(body.tools) ? body.tools : []);
    } catch (e) {
      setTools([]);
      setToolsError(e instanceof Error ? e.message : String(e));
    } finally {
      setToolsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'tools') return;
    void loadTools();
  }, [tab, loadTools]);

  const toolsByCategory = (['fdc3', 'native', 'documents'] as const).map(category => ({
    category,
    items: tools.filter(t => t.category === category),
  }));

  return (
    <div className="container">
      <div className="box" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <div
          role="tablist"
          aria-label="Agent harness views"
          style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'sessions'}
            className={tab === 'sessions' ? 'primary' : undefined}
            onClick={() => setTab('sessions')}
          >
            Sessions{sessions.length ? ` (${sessions.length})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tools'}
            className={tab === 'tools' ? 'primary' : undefined}
            onClick={() => setTab('tools')}
          >
            Tools{tools.length ? ` (${tools.length})` : ''}
          </button>
        </div>

        {tab === 'sessions' ? (
          <>
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
                {ready
                  ? sessions.length
                    ? `${sessions.length} channel${sessions.length === 1 ? '' : 's'}`
                    : 'ready'
                  : 'connecting…'}
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
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <p className="note" style={{ margin: 0, flex: 1 }}>
                Tools registered for the agent loop (native, documents, FDC3).
              </p>
              <button type="button" onClick={() => void loadTools()} disabled={toolsLoading}>
                {toolsLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 240,
                overflow: 'auto',
                background: '#f8fafc',
                borderRadius: 8,
                padding: 12,
              }}
            >
              {toolsError ? (
                <span style={{ color: '#b42318' }}>{toolsError}</span>
              ) : toolsLoading && !tools.length ? (
                <span className="note">Loading tools…</span>
              ) : !tools.length ? (
                <span className="note">No tools registered.</span>
              ) : (
                toolsByCategory.map(
                  group =>
                    group.items.length ? (
                      <div key={group.category} style={{ marginBottom: 16 }}>
                        <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>
                          {TOOL_CATEGORY_LABEL[group.category]} ({group.items.length})
                        </h3>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {group.items.map(t => (
                            <li
                              key={t.name}
                              style={{
                                marginBottom: 10,
                                paddingBottom: 10,
                                borderBottom: '1px solid #e4e7ec',
                              }}
                            >
                              <code style={{ fontSize: 12 }}>{t.name}</code>
                              <div className="note" style={{ margin: '4px 0 0' }}>
                                {t.description || '(no description)'}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
