import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppIdentifier, Channel, DesktopAgent, Listener } from '@finos/fdc3';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import {
  CONTEXT_TYPES,
  INTENTS,
  type AgentAnswer,
  type AgentDelta,
  type AgentQuery,
  type Fdc3Portfolio,
} from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';

const HARNESS_APP: AppIdentifier = { appId: 'aipa-agent-harness' };

type ChatMsg =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; streaming?: boolean; suggestions?: string[] }
  | { id: string; role: 'status'; text: string };

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Prefer a running harness instance; otherwise target the appId (DA may launch). */
async function resolveHarnessTarget(fdc3: DesktopAgent): Promise<AppIdentifier> {
  try {
    const instances = await fdc3.findInstances(HARNESS_APP);
    if (instances[0]) return instances[0];
  } catch {
    /* findInstances unsupported or failed — fall through */
  }
  return HARNESS_APP;
}

export function AgentUiApp() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'AI Portfolio Assistant — ask about portfolio risk, research, or recommendations. Turns go to the Agent harness over `fdc3.ai` (AskAgent → PrivateChannel).',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const fdc3Ref = useRef<DesktopAgent | null>(null);
  const channelRef = useRef<Channel | null>(null);
  const channelListeners = useRef<Listener[]>([]);
  const assistantIdRef = useRef<string | null>(null);
  const turnTimeoutRef = useRef<number | null>(null);
  const drawer = useRef(mountStatusDrawer());
  const scroller = useRef<HTMLDivElement | null>(null);

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

  const bindChannel = useCallback(
    async (channel: Channel, assistantId: string) => {
      await clearChannel();
      channelRef.current = channel;

      const onChannel = await channel.addContextListener(
        [CONTEXT_TYPES.agentDelta, CONTEXT_TYPES.agentAnswer],
        async ctx => {
          if (ctx.type === CONTEXT_TYPES.agentDelta) {
            const delta = ctx as AgentDelta;
            console.log(
              'fdc3.ai:',
              'context received on PrivateChannel',
              CONTEXT_TYPES.agentDelta,
              delta.kind,
              delta.kind === 'text'
                ? String(delta.payload?.delta ?? '').slice(0, 40)
                : delta.payload?.message
            );
            if (delta.kind === 'text') {
              const piece = String(delta.payload?.delta ?? '');
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId && m.role === 'assistant'
                    ? { ...m, text: (m.text || '') + piece, streaming: true }
                    : m
                )
              );
            } else if (delta.kind === 'status') {
              const message = String(delta.payload?.message ?? '…');
              setStatus(drawer.current.statusEl, message);
              append({ id: uid(), role: 'status', text: message });
            }
            return;
          }

          if (ctx.type === CONTEXT_TYPES.agentAnswer) {
            const answer = ctx as AgentAnswer;
            console.log(
              'fdc3.ai:',
              'context received on PrivateChannel',
              CONTEXT_TYPES.agentAnswer,
              `${answer.markdown.length} chars`
            );
            clearTurnTimeout();
            patchAssistant(assistantId, {
              text: answer.markdown,
              streaming: false,
              suggestions: answer.suggestions,
            });
            setBusy(false);
            setStatus(drawer.current.statusEl, 'Turn complete');
            assistantIdRef.current = null;
            // One AskAgent → one PrivateChannel per turn (next send raises again).
            await clearChannel();
          }
        }
      );
      console.log(
        'fdc3.ai:',
        'handler added: PrivateChannel.addContextListener',
        [CONTEXT_TYPES.agentDelta, CONTEXT_TYPES.agentAnswer]
      );

      channelListeners.current = [onChannel];
    },
    [append, clearChannel, clearTurnTimeout, patchAssistant]
  );

  const sendTurn = useCallback(
    async (text: string) => {
      const fdc3 = fdc3Ref.current;
      if (!fdc3 || !text.trim() || busy) return;

      const userText = text.trim();
      setDraft('');
      append({ id: uid(), role: 'user', text: userText });
      const assistantId = uid();
      assistantIdRef.current = assistantId;
      append({ id: assistantId, role: 'assistant', text: '', streaming: true });
      setBusy(true);
      setStatus(drawer.current.statusEl, 'Raising AskAgent…');

      clearTurnTimeout();
      turnTimeoutRef.current = window.setTimeout(() => {
        if (assistantIdRef.current !== assistantId) return;
        patchAssistant(assistantId, {
          text: '**Timed out waiting for the Agent harness.** Try again.',
          streaming: false,
        });
        setBusy(false);
        setStatus(drawer.current.statusEl, 'AskAgent timed out');
        void clearChannel();
      }, 60_000);

      try {
        const query: AgentQuery = {
          type: CONTEXT_TYPES.agentQuery,
          text: userText,
        };

        const target = await resolveHarnessTarget(fdc3);
        setStatus(
          drawer.current.statusEl,
          target.instanceId
            ? `AskAgent → existing harness (${target.instanceId})`
            : 'AskAgent → harness (launch if needed)'
        );
        // Target a running instance when findInstances returns one; otherwise
        // appId alone lets the Desktop Agent launch (or resolve) the harness.
        console.log('fdc3.ai:', 'intent raised', INTENTS.AskAgent, {
          appId: target.appId,
          instanceId: target.instanceId,
          text: userText.slice(0, 80),
        });
        const resolution = await fdc3.raiseIntent(INTENTS.AskAgent, query as never, target);
        const result = await resolution.getResult();
        console.log(
          'fdc3.ai:',
          'intent result retrieved',
          INTENTS.AskAgent,
          result && typeof result === 'object' && 'broadcast' in result
            ? `PrivateChannel id=${(result as Channel).id}`
            : result
        );
        if (result && typeof result === 'object' && 'broadcast' in result) {
          await bindChannel(result as Channel, assistantId);
          setStatus(drawer.current.statusEl, 'PrivateChannel connected');
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
        setStatus(drawer.current.statusEl, msg);
        await clearChannel();
      }
    },
    [append, bindChannel, busy, clearChannel, clearTurnTimeout, patchAssistant]
  );

  const cancelTurn = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel) return;
    clearTurnTimeout();
    const cancelCtx = {
      type: CONTEXT_TYPES.agentCancel,
      reason: 'user_stopped',
    } as never;
    console.log('fdc3.ai:', 'context sent on PrivateChannel', CONTEXT_TYPES.agentCancel, 'user_stopped');
    await channel.broadcast(cancelCtx);
    setBusy(false);
    if (assistantIdRef.current) {
      patchAssistant(assistantIdRef.current, { streaming: false });
    }
    setStatus(drawer.current.statusEl, 'Cancelled');
    await clearChannel();
  }, [clearChannel, clearTurnTimeout, patchAssistant]);

  useEffect(() => {
    let portfolioListener: Listener | null = null;
    let cancelled = false;
    void (async () => {
      const fdc3 = await connectAgent(drawer.current.statusEl);
      if (cancelled || !fdc3) return;
      fdc3Ref.current = fdc3;
      portfolioListener = await fdc3.addContextListener(CONTEXT_TYPES.portfolio, ctx => {
        const p = ctx as Fdc3Portfolio;
        const label = p.name || p.id?.portfolioId || 'portfolio';
        setStatus(drawer.current.statusEl, `Aligned with portfolio: ${label}`);
        append({
          id: uid(),
          role: 'status',
          text: `Observed fdc3.portfolio — ${label}`,
        });
      });
      setStatus(drawer.current.statusEl, 'Agent UI ready — raise AskAgent to harness');
    })();
    return () => {
      cancelled = true;
      void portfolioListener?.unsubscribe();
      void clearChannel();
    };
  }, [append, clearChannel]);

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
              m.role === 'user'
                ? 'agent-ui__msg agent-ui__msg--user'
                : m.role === 'status'
                  ? 'agent-ui__msg agent-ui__msg--status'
                  : 'agent-ui__msg agent-ui__msg--assistant'
            }
          >
            {m.role !== 'status' ? (
              <div className="agent-ui__msg-role">
                {m.role === 'user' ? 'You' : 'Assistant'}
                {m.role === 'assistant' && m.streaming ? ' · streaming' : ''}
              </div>
            ) : null}
            {m.text || (m.role === 'assistant' && m.streaming ? '…' : '')}
            {m.role === 'assistant' && m.suggestions?.length ? (
              <div className="agent-ui__suggestions">
                {m.suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => void sendTurn(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <form
        className="agent-ui__composer"
        onSubmit={e => {
          e.preventDefault();
          void sendTurn(draft);
        }}
      >
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Ask about portfolio risk, research, recommendations…"
          disabled={busy}
        />
        <button type="submit" className="primary" disabled={!draft.trim() || busy}>
          Send
        </button>
      </form>
    </div>
  );
}
