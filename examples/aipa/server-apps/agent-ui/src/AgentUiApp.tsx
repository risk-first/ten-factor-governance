import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppIdentifier, DesktopAgent, Listener, PrivateChannel } from '@finos/fdc3';
import { connectAgent } from '../../../common/src/fdc3/agent.ts';
import {
  CONTEXT_TYPES,
  INTENTS,
  type AgentAnswer,
  type AgentDelta,
  type AgentQuery,
  type Fdc3DataFile,
  type Fdc3Portfolio,
  type FileFormat,
} from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import { MarkdownView } from '../../../common/src/ui/MarkdownView.tsx';

const HARNESS_APP: AppIdentifier = { appId: 'aipa-agent-harness' };

type AttachedFile = {
  fileId: string;
  name: string;
  format: FileFormat;
  content_b64: string;
};

type ChatMsg =
  | { id: string; role: 'user'; text: string; fileIds?: string[] }
  | {
      id: string;
      role: 'assistant';
      text: string;
      streaming?: boolean;
      suggestions?: string[];
      citations?: Array<Record<string, unknown>>;
      artifacts?: Array<Record<string, unknown>>;
    };

const STATUS_LOG_CAP = 80;

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatFromName(name: string): FileFormat | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'txt') return 'txt';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'html' || ext === 'htm') return 'html';
  return null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

async function resolveHarnessTarget(fdc3: DesktopAgent): Promise<AppIdentifier> {
  try {
    const instances = await fdc3.findInstances(HARNESS_APP);
    if (instances[0]) return instances[0];
  } catch {
    /* fall through */
  }
  return HARNESS_APP;
}

export function AgentUiApp() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        'AI Portfolio Assistant — ask about portfolio risk, research, or recommendations. ' +
        'Attach files (txt/md/html/pdf/docx); they are sent as `fdc3.data.file` and referenced by id. ' +
        'The harness uses generic FDC3 tools to talk to other apps.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const fdc3Ref = useRef<DesktopAgent | null>(null);
  const channelRef = useRef<PrivateChannel | null>(null);
  const channelListeners = useRef<Listener[]>([]);
  const assistantIdRef = useRef<string | null>(null);
  const turnTimeoutRef = useRef<number | null>(null);
  const sessionFilesRef = useRef<AttachedFile[]>([]);
  const drawer = useRef(mountStatusDrawer());
  const statusLog = useRef<string[]>([]);
  const scroller = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pushStatus = useCallback((msg: string) => {
    const line = msg.trim();
    if (!line) return;
    statusLog.current = [...statusLog.current.slice(-(STATUS_LOG_CAP - 1)), line];
    const text = statusLog.current.join('\n');
    const { statusEl, root } = drawer.current;
    statusEl.textContent = text;
    const summary = root.querySelector<HTMLElement>('.status-drawer__summary');
    if (summary) summary.textContent = line;
    const panel = root.querySelector<HTMLElement>('.status-drawer__panel');
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, []);

  const clearTurnTimeout = useCallback(() => {
    if (turnTimeoutRef.current != null) {
      window.clearTimeout(turnTimeoutRef.current);
      turnTimeoutRef.current = null;
    }
  }, []);

  const append = useCallback((msg: ChatMsg) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const patchAssistant = useCallback((id: string, patch: Partial<Extract<ChatMsg, { role: 'assistant' }>>) => {
    setMessages(prev =>
      prev.map(m => (m.id === id && m.role === 'assistant' ? { ...m, ...patch } : m))
    );
  }, []);

  const clearChannel = useCallback(async () => {
    for (const l of channelListeners.current) {
      try {
        await l.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    channelListeners.current = [];
    channelRef.current = null;
  }, []);

  const deliverFiles = useCallback(async (channel: PrivateChannel, files: AttachedFile[]) => {
    for (const f of files) {
      const ctx: Fdc3DataFile = {
        type: CONTEXT_TYPES.file,
        id: { fileId: f.fileId },
        name: f.name,
        format: f.format,
        content_b64: f.content_b64,
      };
      console.log('fdc3.ai:', 'context sent on PrivateChannel', CONTEXT_TYPES.file, f.name);
      await channel.broadcast(ctx as never);
      if (!sessionFilesRef.current.some(x => x.fileId === f.fileId)) {
        sessionFilesRef.current = [...sessionFilesRef.current, f];
      }
    }
  }, []);

  const bindChannel = useCallback(
    async (channel: PrivateChannel) => {
      await clearChannel();
      channelRef.current = channel;

      const onChannel = await channel.addContextListener(
        [CONTEXT_TYPES.agentDelta, CONTEXT_TYPES.agentAnswer],
        async ctx => {
          const assistantId = assistantIdRef.current;
          if (ctx.type === CONTEXT_TYPES.agentDelta) {
            const delta = ctx as AgentDelta;
            if (delta.kind === 'text') {
              if (!assistantId) return;
              const piece = String(delta.payload?.delta ?? '');
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId && m.role === 'assistant'
                    ? { ...m, text: (m.text || '') + piece, streaming: true }
                    : m
                )
              );
            } else if (delta.kind === 'status') {
              pushStatus(String(delta.payload?.message ?? '…'));
            } else if (delta.kind === 'citation') {
              const citation = delta.payload?.citation as Record<string, unknown> | undefined;
              if (assistantId && citation) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId && m.role === 'assistant'
                      ? { ...m, citations: [...(m.citations ?? []), citation] }
                      : m
                  )
                );
              }
            } else if (delta.kind === 'artifact') {
              const artifact = delta.payload?.artifact as Record<string, unknown> | undefined;
              if (assistantId && artifact) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId && m.role === 'assistant'
                      ? { ...m, artifacts: [...(m.artifacts ?? []), artifact] }
                      : m
                  )
                );
              }
            }
            return;
          }

          if (ctx.type === CONTEXT_TYPES.agentAnswer) {
            const answer = ctx as AgentAnswer;
            clearTurnTimeout();
            if (assistantId) {
              patchAssistant(assistantId, {
                text: answer.markdown,
                streaming: false,
                suggestions: answer.suggestions,
                citations: answer.citations,
                artifacts: answer.artifacts,
              });
            }
            setBusy(false);
            pushStatus('Turn complete');
            assistantIdRef.current = null;
          }
        }
      );

      const onDisconnect = await channel.addEventListener('disconnect', () => {
        pushStatus('PrivateChannel disconnected');
        void clearChannel();
      });

      channelListeners.current = [onChannel, onDisconnect];
    },
    [clearChannel, clearTurnTimeout, patchAssistant, pushStatus]
  );

  const sendTurn = useCallback(
    async (text: string) => {
      const fdc3 = fdc3Ref.current;
      if (!fdc3 || (!text.trim() && attachments.length === 0) || busy) return;

      const userText = text.trim() || (attachments.length ? '(see attached files)' : '');
      const turnFiles = [...attachments];
      setDraft('');
      setAttachments([]);
      append({
        id: uid(),
        role: 'user',
        text: userText,
        fileIds: turnFiles.map(f => f.fileId),
      });
      const assistantId = uid();
      assistantIdRef.current = assistantId;
      append({ id: assistantId, role: 'assistant', text: '', streaming: true });
      setBusy(true);

      const query: AgentQuery = {
        type: CONTEXT_TYPES.agentQuery,
        text: userText,
        fileIds: turnFiles.length ? turnFiles.map(f => f.fileId) : undefined,
      };

      clearTurnTimeout();
      turnTimeoutRef.current = window.setTimeout(() => {
        if (assistantIdRef.current !== assistantId) return;
        patchAssistant(assistantId, {
          text: '**Timed out waiting for the Agent harness.** Try again.',
          streaming: false,
        });
        setBusy(false);
        pushStatus('Turn timed out');
        assistantIdRef.current = null;
      }, 120_000);

      try {
        const existing = channelRef.current;
        if (existing) {
          if (turnFiles.length) await deliverFiles(existing, turnFiles);
          pushStatus('Follow-up on PrivateChannel…');
          await existing.broadcast(query as never);
          return;
        }

        pushStatus('Raising AskAgent…');
        const target = await resolveHarnessTarget(fdc3);
        // Open session without text so the harness waits; then send files + query on the channel.
        const openQuery: AgentQuery = { type: CONTEXT_TYPES.agentQuery, text: null };
        const resolution = await fdc3.raiseIntent(INTENTS.AskAgent, openQuery as never, target);
        const result = await resolution.getResult();
        if (result && typeof result === 'object' && 'broadcast' in result) {
          const channel = result as PrivateChannel;
          await bindChannel(channel);
          if (turnFiles.length) await deliverFiles(channel, turnFiles);
          await channel.broadcast(query as never);
          pushStatus('PrivateChannel connected');
        } else {
          throw new Error('AskAgent did not return a PrivateChannel');
        }
      } catch (e) {
        clearTurnTimeout();
        const msg = e instanceof Error ? e.message : String(e);
        patchAssistant(assistantId, {
          text: `**Could not reach Agent harness.** ${msg}`,
          streaming: false,
        });
        setBusy(false);
        pushStatus(msg);
        assistantIdRef.current = null;
        await clearChannel();
      }
    },
    [
      append,
      attachments,
      bindChannel,
      busy,
      clearChannel,
      clearTurnTimeout,
      deliverFiles,
      patchAssistant,
      pushStatus,
    ]
  );

  const cancelTurn = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel) return;
    clearTurnTimeout();
    await channel.broadcast({
      type: CONTEXT_TYPES.agentCancel,
      reason: 'user_stopped',
    } as never);
    setBusy(false);
    if (assistantIdRef.current) {
      patchAssistant(assistantIdRef.current, { streaming: false });
      assistantIdRef.current = null;
    }
    pushStatus('Cancelled');
  }, [clearTurnTimeout, patchAssistant, pushStatus]);

  const onPickFiles = useCallback(async (list: FileList | null) => {
    if (!list?.length) return;
    const next: AttachedFile[] = [];
    for (const file of Array.from(list)) {
      const format = formatFromName(file.name);
      if (!format) {
        pushStatus(`Unsupported type: ${file.name}`);
        continue;
      }
      const content_b64 = await readFileAsBase64(file);
      next.push({
        fileId: `file-${uid()}`,
        name: file.name,
        format,
        content_b64,
      });
    }
    setAttachments(prev => [...prev, ...next]);
  }, [pushStatus]);

  useEffect(() => {
    let portfolioListener: Listener | null = null;
    let cancelled = false;
    void (async () => {
      const fdc3 = await connectAgent(drawer.current.statusEl);
      if (cancelled || !fdc3) return;
      fdc3Ref.current = fdc3;
      // Seed the drawer log with whatever connectAgent wrote.
      const seed = drawer.current.statusEl.textContent?.trim();
      if (seed) statusLog.current = [seed];
      portfolioListener = await fdc3.addContextListener(CONTEXT_TYPES.portfolio, ctx => {
        const p = ctx as Fdc3Portfolio;
        const label = p.name || p.id?.portfolioId || 'portfolio';
        pushStatus(`Aligned with portfolio: ${label}`);
      });
      pushStatus('Agent UI ready');
    })();
    return () => {
      cancelled = true;
      void portfolioListener?.unsubscribe();
      void clearChannel();
    };
  }, [clearChannel, pushStatus]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  return (
    <div className="container agent-ui">
      {busy ? (
        <div className="agent-ui__stop">
          <button type="button" onClick={() => void cancelTurn()}>
            Stop
          </button>
        </div>
      ) : null}

      <div ref={scroller} className="agent-ui__messages">
        {messages.map(m => (
          <div
            key={m.id}
            className={
              m.role === 'user' ? 'agent-ui__msg agent-ui__msg--user' : 'agent-ui__msg agent-ui__msg--assistant'
            }
          >
            <div className="agent-ui__msg-role">
              {m.role === 'user' ? 'You' : 'Assistant'}
              {m.role === 'assistant' && m.streaming ? ' · streaming' : ''}
            </div>
            {m.role === 'assistant' ? (
              <MarkdownView markdown={m.text || (m.streaming ? '…' : '')} />
            ) : (
              m.text
            )}
            {m.role === 'user' && m.fileIds?.length ? (
              <div className="agent-ui__file-chips">
                {m.fileIds.map(id => {
                  const f = sessionFilesRef.current.find(x => x.fileId === id);
                  return (
                    <span key={id} className="agent-ui__chip">
                      {f?.name ?? id}
                    </span>
                  );
                })}
              </div>
            ) : null}
            {m.role === 'assistant' && m.citations?.length ? (
              <ul className="agent-ui__citations">
                {m.citations.map((c, i) => (
                  <li key={String(c.id ?? i)}>
                    {String(c.title ?? c.source ?? 'citation')}
                    {c.fileId ? ` · ${String(c.fileId)}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
            {m.role === 'assistant' && m.artifacts?.length
              ? m.artifacts.map((a, i) => (
                  <div key={String(a.uuid ?? i)} className="agent-ui__artifact">
                    <div className="agent-ui__msg-role">{String(a.name ?? a.type ?? 'artifact')}</div>
                    {a.type === 'html' && typeof a.content === 'string' ? (
                      <iframe
                        title={String(a.name ?? 'artifact')}
                        sandbox=""
                        srcDoc={a.content}
                        style={{ width: '100%', minHeight: 120, border: '1px solid #e2e8f0' }}
                      />
                    ) : (
                      <pre className="ex">{JSON.stringify(a, null, 2)}</pre>
                    )}
                  </div>
                ))
              : null}
            {m.role === 'assistant' && m.suggestions?.length ? (
              <div className="agent-ui__suggestions">
                {m.suggestions.map(s => (
                  <button key={s} type="button" disabled={busy} onClick={() => void sendTurn(s)}>
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {attachments.length ? (
        <div className="agent-ui__attach-bar">
          {attachments.map(f => (
            <span key={f.fileId} className="agent-ui__chip">
              {f.name}
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setAttachments(prev => prev.filter(x => x.fileId !== f.fileId))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <form
        className="agent-ui__composer"
        onSubmit={e => {
          e.preventDefault();
          void sendTurn(draft);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.markdown,.html,.htm"
          hidden
          onChange={e => {
            void onPickFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          Attach
        </button>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Ask about portfolio risk, research, recommendations…"
          disabled={busy}
        />
        <button type="submit" className="primary" disabled={(!draft.trim() && !attachments.length) || busy}>
          Send
        </button>
      </form>
    </div>
  );
}
