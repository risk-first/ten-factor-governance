import { useEffect, useRef, useState } from 'react';
import type { Listener } from '@finos/fdc3';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import { CONTEXT_TYPES, INTENTS, type Fdc3DataMarkdown } from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import { MarkdownView } from '../../../common/src/ui/MarkdownView.tsx';

const DEBUG = '[markdown-viewer]';

function debug(statusEl: HTMLElement | null, ...args: unknown[]): void {
  console.log(DEBUG, ...args);
  const line = args
    .map(a => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
  if (statusEl) setStatus(statusEl, `${DEBUG} ${line}`);
}

function ctxShape(ctx: unknown): Record<string, unknown> {
  if (!ctx || typeof ctx !== 'object') return { kind: typeof ctx, value: ctx };
  const o = ctx as Record<string, unknown>;
  const markdown = o.markdown;
  return {
    type: o.type,
    keys: Object.keys(o),
    title: o.title,
    instanceId: o.instanceId,
    markdownType: typeof markdown,
    markdownLen: typeof markdown === 'string' ? markdown.length : undefined,
    markdownPreview: typeof markdown === 'string' ? markdown.slice(0, 80) : markdown,
  };
}

function isMarkdownCtx(ctx: unknown): ctx is Fdc3DataMarkdown {
  const ok =
    !!ctx &&
    typeof ctx === 'object' &&
    (ctx as { type?: string }).type === CONTEXT_TYPES.markdown &&
    typeof (ctx as { markdown?: unknown }).markdown === 'string';
  if (!ok) {
    const o = ctx && typeof ctx === 'object' ? (ctx as Record<string, unknown>) : null;
    console.log(DEBUG, 'isMarkdownCtx=false', {
      expectedType: CONTEXT_TYPES.markdown,
      actualType: o?.type,
      markdownType: o ? typeof o.markdown : typeof ctx,
      shape: ctxShape(ctx),
    });
  }
  return ok;
}

export function MarkdownViewerApp() {
  const [doc, setDoc] = useState<Fdc3DataMarkdown | null>(null);
  const drawer = useRef(mountStatusDrawer());

  useEffect(() => {
    let cancelled = false;
    let viewListener: Listener | null = null;
    let openListener: Listener | null = null;
    const statusEl = () => drawer.current.statusEl;

    debug(statusEl(), 'effect start', { href: window.location.href });

    void (async () => {
      debug(statusEl(), 'connectAgent…');
      const fdc3 = await connectAgent(statusEl());
      debug(statusEl(), 'connectAgent done', { cancelled, hasAgent: !!fdc3 });
      if (cancelled || !fdc3) {
        debug(statusEl(), 'bailing — cancelled or no agent');
        return;
      }

      try {
        const info = await fdc3.getInfo();
        debug(statusEl(), 'getInfo', {
          fdc3Version: info.fdc3Version,
          provider: info.provider,
          appId: info.appMetadata?.appId,
          instanceId: info.appMetadata?.instanceId,
        });
      } catch (e) {
        debug(statusEl(), 'getInfo failed', e instanceof Error ? e.message : e);
      }

      const apply = (ctx: Fdc3DataMarkdown, via: string) => {
        debug(statusEl(), `apply via ${via}`, ctxShape(ctx));
        setDoc(ctx);
        setStatus(
          statusEl(),
          `${via}: ${ctx.title || 'markdown'} (${ctx.markdown.length} chars)`
        );
      };

      debug(statusEl(), `addIntentListener(${INTENTS.ViewData})…`);
      viewListener = await fdc3.addIntentListener(INTENTS.ViewData, async ctx => {
        debug(statusEl(), 'ViewData received', ctxShape(ctx));
        if (!isMarkdownCtx(ctx)) {
          setStatus(statusEl(), 'ViewData ignored — expected fdc3.data.markdown with markdown string');
          return;
        }
        apply(ctx, 'ViewData');
      });
      debug(statusEl(), 'ViewData listener registered');

      try {
        debug(statusEl(), `addContextListener(${CONTEXT_TYPES.markdown})…`);
        openListener = await fdc3.addContextListener(CONTEXT_TYPES.markdown, ctx => {
          debug(statusEl(), 'context listener fired', ctxShape(ctx));
          if (isMarkdownCtx(ctx)) apply(ctx, 'context');
          else debug(statusEl(), 'context ignored — required schema field markdown is not a string');
        });
        debug(statusEl(), 'context listener registered');
      } catch (e) {
        debug(statusEl(), 'addContextListener failed', e instanceof Error ? e.message : e);
      }

      try {
        const ch = await fdc3.getCurrentChannel();
        const current = ch ? await ch.getCurrentContext() : null;
        debug(statusEl(), 'current channel', {
          channelId: ch?.id ?? null,
          currentType: current?.type ?? null,
          currentShape: current ? ctxShape(current) : null,
        });
      } catch (e) {
        debug(statusEl(), 'getCurrentChannel failed', e instanceof Error ? e.message : e);
      }

      if (cancelled) {
        debug(statusEl(), 'cancelled after setup — listeners will unsubscribe');
        return;
      }
      setStatus(statusEl(), 'Markdown Viewer ready — open / ViewData fdc3.data.markdown');
      debug(statusEl(), 'ready');
    })().catch(e => {
      debug(statusEl(), 'setup threw', e instanceof Error ? e.message : e);
    });

    return () => {
      debug(statusEl(), 'effect cleanup — unsubscribing');
      cancelled = true;
      void viewListener?.unsubscribe();
      void openListener?.unsubscribe();
    };
  }, []);

  return (
    <div className="container">
      <div className="box" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>{doc?.title || 'Markdown Viewer'}</h2>
        {!doc ? (
          <p className="note">Waiting for fdc3.open / ViewData with fdc3.data.markdown…</p>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <MarkdownView markdown={doc.markdown} />
          </div>
        )}
      </div>
    </div>
  );
}
