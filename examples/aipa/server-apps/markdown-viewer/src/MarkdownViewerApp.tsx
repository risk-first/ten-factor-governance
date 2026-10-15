import { useEffect, useRef, useState } from 'react';
import type { Listener } from '@finos/fdc3';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import { CONTEXT_TYPES, INTENTS, type Fdc3DataMarkdown } from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import { MarkdownView } from '../../../common/src/ui/MarkdownView.tsx';

function isMarkdownCtx(ctx: unknown): ctx is Fdc3DataMarkdown {
  return (
    !!ctx &&
    typeof ctx === 'object' &&
    (ctx as { type?: string }).type === CONTEXT_TYPES.markdown &&
    typeof (ctx as { markdown?: unknown }).markdown === 'string'
  );
}

export function MarkdownViewerApp() {
  const [doc, setDoc] = useState<Fdc3DataMarkdown | null>(null);
  const drawer = useRef(mountStatusDrawer());

  useEffect(() => {
    let cancelled = false;
    let viewListener: Listener | null = null;
    let openListener: Listener | null = null;

    void (async () => {
      const fdc3 = await connectAgent(drawer.current.statusEl);
      if (cancelled || !fdc3) return;

      const apply = (ctx: Fdc3DataMarkdown, via: string) => {
        setDoc(ctx);
        setStatus(
          drawer.current.statusEl,
          `${via}: ${ctx.title || 'markdown'} (${ctx.markdown.length} chars)`
        );
      };

      viewListener = await fdc3.addIntentListener(INTENTS.ViewData, async ctx => {
        if (!isMarkdownCtx(ctx)) {
          setStatus(drawer.current.statusEl, 'ViewData ignored — expected fdc3.data.markdown');
          return;
        }
        apply(ctx, 'ViewData');
      });

      // Seed from open / launch context if present.
      try {
        openListener = await fdc3.addContextListener(CONTEXT_TYPES.markdown, ctx => {
          if (isMarkdownCtx(ctx)) apply(ctx, 'context');
        });
      } catch {
        /* optional */
      }

      setStatus(drawer.current.statusEl, 'Markdown Viewer ready — open / ViewData fdc3.data.markdown');
    })();

    return () => {
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
