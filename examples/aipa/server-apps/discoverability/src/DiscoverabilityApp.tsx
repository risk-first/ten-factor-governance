import { useEffect, useRef, useState } from 'react';
import type { Channel, Context, Listener } from '@finos/fdc3';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import {
  CONTEXT_TYPES,
  DISCOVERABILITY_CHANNEL,
  type AppDirectoryReply,
  type ContextTypeListReply,
  type IntentListReply,
} from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { DiscoveryCatalog } from './catalog.ts';

type LogLine = { t: number; msg: string };

async function loadCatalog(): Promise<DiscoveryCatalog> {
  const res = await fetch('/api/catalog');
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `catalog HTTP ${res.status}`);
  }
  return res.json() as Promise<DiscoveryCatalog>;
}

export function DiscoverabilityApp() {
  const drawer = useRef(mountStatusDrawer());
  const [catalog, setCatalog] = useState<DiscoveryCatalog | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const catalogRef = useRef<DiscoveryCatalog | null>(null);

  const log = (msg: string) => {
    setLines(prev => [...prev.slice(-40), { t: Date.now(), msg }]);
    setStatus(drawer.current.statusEl, msg);
  };

  useEffect(() => {
    let cancelled = false;
    let channel: Channel | null = null;
    let refreshTimer: number | undefined;
    const listeners: Listener[] = [];

    void (async () => {
      try {
        const loaded = await loadCatalog();
        if (cancelled) return;
        catalogRef.current = loaded;
        setCatalog(loaded);
        log(
          `Catalog loaded · ${loaded.apps.length} apps · ${loaded.intents.length} intents · ${loaded.contextTypes.length} context types`
        );
      } catch (e) {
        log(`Catalog load failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      const fdc3 = await connectAgent(drawer.current.statusEl);
      if (cancelled || !fdc3) return;

      channel = await fdc3.getOrCreateChannel(DISCOVERABILITY_CHANNEL);
      log(`Listening on app channel ${DISCOVERABILITY_CHANNEL}`);

      const reply = async (ctx: Context) => {
        const current = catalogRef.current;
        if (!current) {
          log('Ignore discover request — catalog not ready');
          return;
        }
        if (!channel) return;

        if (ctx.type === CONTEXT_TYPES.discoverApps) {
          const payload: AppDirectoryReply = {
            type: CONTEXT_TYPES.appDirectory,
            apps: current.apps,
          };
          await channel.broadcast(payload as Context);
          log(`Replied appDirectory (${current.apps.length} apps)`);
          return;
        }

        if (ctx.type === CONTEXT_TYPES.discoverIntents) {
          const payload: IntentListReply = {
            type: CONTEXT_TYPES.intentList,
            intents: current.intents,
          };
          await channel.broadcast(payload as Context);
          log(`Replied intentList (${current.intents.length} intents)`);
          return;
        }

        if (ctx.type === CONTEXT_TYPES.discoverContextTypes) {
          const payload: ContextTypeListReply = {
            type: CONTEXT_TYPES.contextTypeList,
            contextTypes: current.contextTypes,
          };
          await channel.broadcast(payload as Context);
          log(`Replied contextTypeList (${current.contextTypes.length} types)`);
        }
      };

      for (const type of [
        CONTEXT_TYPES.discoverApps,
        CONTEXT_TYPES.discoverIntents,
        CONTEXT_TYPES.discoverContextTypes,
      ]) {
        listeners.push(await channel.addContextListener(type, ctx => void reply(ctx)));
      }

      // Refresh catalog periodically so newly started apps appear after AppD regen.
      refreshTimer = window.setInterval(() => {
        void loadCatalog()
          .then(loaded => {
            if (cancelled) return;
            catalogRef.current = loaded;
            setCatalog(loaded);
          })
          .catch(() => {
            /* keep last good catalog */
          });
      }, 15_000);
    })();

    return () => {
      cancelled = true;
      if (refreshTimer != null) window.clearInterval(refreshTimer);
      for (const l of listeners) void l.unsubscribe();
    };
  }, []);

  return (
    <div className="container">
      <div className="box" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Discoverability</h2>
        <p className="note" style={{ marginTop: 0 }}>
          Responder on app channel <code>{DISCOVERABILITY_CHANNEL}</code>. Catalog from combined App
          Directory.
        </p>
        {catalog ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <strong>{catalog.apps.length}</strong> apps
            </div>
            <div>
              <strong>{catalog.intents.length}</strong> intents
            </div>
            <div>
              <strong>{catalog.contextTypes.length}</strong> context types
            </div>
          </div>
        ) : (
          <p className="note">Loading catalog…</p>
        )}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            background: '#f8fafc',
            borderRadius: 8,
            padding: 12,
          }}
        >
          {lines.length === 0 ? (
            <span style={{ color: '#667085' }}>Waiting for discover requests…</span>
          ) : (
            lines.map(l => (
              <div key={l.t + l.msg}>
                {new Date(l.t).toLocaleTimeString()} — {l.msg}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
