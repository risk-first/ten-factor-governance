import { useCallback, useEffect, useRef, useState } from 'react';
import type { Context, Listener } from '@finos/fdc3';
import { connectAgent, setStatus } from '../../../common/src/fdc3/agent.ts';
import {
  CONTEXT_TYPES,
  INTENTS,
  type AppDirectoryRecordReply,
  type AppDirectoryReply,
  type CapabilityRequest,
  type ContextSchemaReply,
  type ContextTypeListReply,
  type IntentListReply,
} from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import type { DiscoveryCatalog } from './catalog.ts';

type LogLine = { t: number; msg: string };

type CatalogTab = 'apps' | 'intents' | 'contextTypes' | 'schema' | 'appd';

const TABS: { id: CatalogTab; label: string }[] = [
  { id: 'apps', label: 'Apps' },
  { id: 'intents', label: 'Intents' },
  { id: 'contextTypes', label: 'Context types' },
  { id: 'schema', label: 'Schema' },
  { id: 'appd', label: 'AppD record' },
];

async function loadCatalog(): Promise<DiscoveryCatalog> {
  const res = await fetch('/api/catalog');
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `catalog HTTP ${res.status}`);
  }
  return res.json() as Promise<DiscoveryCatalog>;
}

async function loadContextSchema(contextType: string): Promise<ContextSchemaReply> {
  const res = await fetch(`/api/context-schema?contextType=${encodeURIComponent(contextType)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `context-schema HTTP ${res.status}`);
  }
  return res.json() as Promise<ContextSchemaReply>;
}

async function loadAppDirectoryRecord(appId: string): Promise<AppDirectoryRecordReply> {
  const res = await fetch(`/api/app-directory-record?appId=${encodeURIComponent(appId)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `app-directory-record HTTP ${res.status}`);
  }
  return res.json() as Promise<AppDirectoryRecordReply>;
}

function replyPayloadForTab(
  tab: Exclude<CatalogTab, 'schema' | 'appd'>,
  catalog: DiscoveryCatalog
): AppDirectoryReply | IntentListReply | ContextTypeListReply {
  if (tab === 'apps') {
    return { type: CONTEXT_TYPES.appDirectory, apps: catalog.apps };
  }
  if (tab === 'intents') {
    return { type: CONTEXT_TYPES.intentList, intents: catalog.intents };
  }
  return { type: CONTEXT_TYPES.contextTypeList, contextTypes: catalog.contextTypes };
}

function countForTab(tab: CatalogTab, catalog: DiscoveryCatalog): number | null {
  if (tab === 'apps') return catalog.apps.length;
  if (tab === 'intents') return catalog.intents.length;
  if (tab === 'contextTypes') return catalog.contextTypes.length;
  return null;
}

function asCapabilityRequest(ctx: Context): CapabilityRequest | null {
  if (ctx.type !== CONTEXT_TYPES.capabilityRequest) return null;
  const raw = ctx as Context & {
    capability?: unknown;
    contextType?: unknown;
    appId?: unknown;
  };
  const capability = raw.capability;
  if (capability === 'apps' || capability === 'intents' || capability === 'contextTypes') {
    return { type: CONTEXT_TYPES.capabilityRequest, capability };
  }
  if (capability === 'contextSchema') {
    const contextType = typeof raw.contextType === 'string' ? raw.contextType : '';
    return { type: CONTEXT_TYPES.capabilityRequest, capability, contextType };
  }
  if (capability === 'appDirectoryRecord') {
    const appId = typeof raw.appId === 'string' ? raw.appId : '';
    return { type: CONTEXT_TYPES.capabilityRequest, capability, appId };
  }
  return null;
}

export function CapabilityApp() {
  const drawer = useRef(mountStatusDrawer());
  const [catalog, setCatalog] = useState<DiscoveryCatalog | null>(null);
  const [activeTab, setActiveTab] = useState<CatalogTab>('apps');
  const [schemaContextType, setSchemaContextType] = useState('fdc3.instrument');
  const [appdAppId, setAppdAppId] = useState('');
  const [previewJson, setPreviewJson] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const catalogRef = useRef<DiscoveryCatalog | null>(null);
  const schemaContextTypeRef = useRef(schemaContextType);
  schemaContextTypeRef.current = schemaContextType;
  const appdAppIdRef = useRef(appdAppId);
  appdAppIdRef.current = appdAppId;
  const previewSeq = useRef(0);

  const log = (msg: string) => {
    setLines(prev => [...prev.slice(-40), { t: Date.now(), msg }]);
    setStatus(drawer.current.statusEl, msg);
  };

  const refreshPreview = useCallback(async (tab: CatalogTab, lookupKey?: string) => {
    const seq = ++previewSeq.current;
    setPreviewLoading(true);
    try {
      if (tab === 'schema') {
        const payload = await loadContextSchema(lookupKey ?? schemaContextTypeRef.current);
        if (seq !== previewSeq.current) return;
        setPreviewJson(JSON.stringify(payload, null, 2));
        return;
      }
      if (tab === 'appd') {
        const loaded = catalogRef.current ?? (await loadCatalog());
        if (seq !== previewSeq.current) return;
        catalogRef.current = loaded;
        setCatalog(loaded);
        const selected = lookupKey || appdAppIdRef.current || loaded.apps[0]?.appId || '';
        if (selected && selected !== appdAppIdRef.current) {
          setAppdAppId(selected);
        }
        const payload = await loadAppDirectoryRecord(selected);
        if (seq !== previewSeq.current) return;
        setPreviewJson(JSON.stringify(payload, null, 2));
        return;
      }
      const loaded = await loadCatalog();
      if (seq !== previewSeq.current) return;
      catalogRef.current = loaded;
      setCatalog(loaded);
      if (!appdAppIdRef.current && loaded.apps[0]?.appId) {
        setAppdAppId(loaded.apps[0].appId);
      }
      const payload = replyPayloadForTab(tab, loaded);
      setPreviewJson(JSON.stringify(payload, null, 2));
    } catch (e) {
      if (seq !== previewSeq.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setPreviewJson('');
      log(`Preview refresh failed: ${msg}`);
    } finally {
      if (seq === previewSeq.current) setPreviewLoading(false);
    }
  }, []);

  const selectTab = (tab: CatalogTab) => {
    setActiveTab(tab);
    setPreviewJson('');
    void refreshPreview(tab);
  };

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | undefined;
    const listeners: Listener[] = [];

    void (async () => {
      await refreshPreview('apps');
      if (cancelled) return;
      const loaded = catalogRef.current;
      if (loaded) {
        log(
          `Catalog loaded · ${loaded.apps.length} apps · ${loaded.intents.length} intents · ${loaded.contextTypes.length} context types`
        );
      }

      const fdc3 = await connectAgent(drawer.current.statusEl);
      if (cancelled || !fdc3) return;

      const handleGetCapabilities = async (ctx: Context) => {
        const request = asCapabilityRequest(ctx);
        if (!request) {
          log(`Ignore GetCapabilities — invalid request context (${ctx.type})`);
          return;
        }

        if (request.capability === 'apps') {
          const current = catalogRef.current;
          if (!current) {
            log('Ignore GetCapabilities(apps) — catalog not ready');
            return;
          }
          const payload: AppDirectoryReply = {
            type: CONTEXT_TYPES.appDirectory,
            apps: current.apps,
          };
          log(`Returned appDirectory (${current.apps.length} apps)`);
          return payload;
        }

        if (request.capability === 'intents') {
          const current = catalogRef.current;
          if (!current) {
            log('Ignore GetCapabilities(intents) — catalog not ready');
            return;
          }
          const payload: IntentListReply = {
            type: CONTEXT_TYPES.intentList,
            intents: current.intents,
          };
          log(`Returned intentList (${current.intents.length} intents)`);
          return payload;
        }

        if (request.capability === 'contextTypes') {
          const current = catalogRef.current;
          if (!current) {
            log('Ignore GetCapabilities(contextTypes) — catalog not ready');
            return;
          }
          const payload: ContextTypeListReply = {
            type: CONTEXT_TYPES.contextTypeList,
            contextTypes: current.contextTypes,
          };
          log(`Returned contextTypeList (${current.contextTypes.length} types)`);
          return payload;
        }

        if (request.capability === 'contextSchema') {
          const { contextType } = request;
          try {
            const payload = await loadContextSchema(contextType);
            log(
              payload.error
                ? `Returned contextSchema error for ${contextType}: ${payload.error}`
                : `Returned contextSchema for ${contextType}`
            );
            return payload;
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            const payload: ContextSchemaReply = {
              type: CONTEXT_TYPES.contextSchema,
              contextType,
              error,
            };
            log(`Returned contextSchema error for ${contextType}: ${error}`);
            return payload;
          }
        }

        const { appId } = request;
        try {
          const payload = await loadAppDirectoryRecord(appId);
          log(
            payload.error
              ? `Returned appDirectoryRecord error for ${appId}: ${payload.error}`
              : `Returned appDirectoryRecord for ${appId}`
          );
          return payload;
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          const payload: AppDirectoryRecordReply = {
            type: CONTEXT_TYPES.appDirectoryRecord,
            appId,
            error,
          };
          log(`Returned appDirectoryRecord error for ${appId}: ${error}`);
          return payload;
        }
      };

      listeners.push(
        await fdc3.addIntentListener(INTENTS.GetCapabilities, ctx => handleGetCapabilities(ctx))
      );
      log(`Listening for intent ${INTENTS.GetCapabilities}`);

      refreshTimer = window.setInterval(() => {
        void loadCatalog()
          .then(loadedCatalog => {
            if (cancelled) return;
            catalogRef.current = loadedCatalog;
            setCatalog(loadedCatalog);
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
  }, [refreshPreview]);

  const schemaOptions =
    catalog?.contextTypes.map(c => c.contextType) ??
    ['fdc3.instrument', 'fdc3.data.markdown', 'fdc3.ai.agentQuery'];
  const appdOptions = catalog?.apps.map(a => a.appId) ?? [];

  return (
    <div className="container">
      <div className="box" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Capability</h2>
        <p className="note" style={{ marginTop: 0 }}>
          Handles intent <code>{INTENTS.GetCapabilities}</code> with{' '}
          <code>{CONTEXT_TYPES.capabilityRequest}</code>. Catalog from combined App Directory. Tab
          to preview reply JSON (refetched on every tab). Schema tab looks up the JSON Schema for
          one context type. AppD record tab looks up the full Application record for one appId.
        </p>

        <div
          role="tablist"
          aria-label="Capability reply previews"
          style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}
        >
          {TABS.map(tab => {
            const selected = activeTab === tab.id;
            const count = catalog ? countForTab(tab.id, catalog) : null;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={selected ? 'primary' : undefined}
                onClick={() => selectTab(tab.id)}
                disabled={previewLoading && selected}
              >
                {tab.label}
                {count != null ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        {activeTab === 'schema' ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <label htmlFor="schema-context-type" className="note" style={{ margin: 0 }}>
              contextType
            </label>
            <select
              id="schema-context-type"
              value={schemaContextType}
              onChange={e => {
                const next = e.target.value;
                setSchemaContextType(next);
                setPreviewJson('');
                void refreshPreview('schema', next);
              }}
              style={{ flex: 1, minWidth: 0 }}
            >
              {[...new Set([schemaContextType, ...schemaOptions])].sort().map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setPreviewJson('');
                void refreshPreview('schema');
              }}
              disabled={previewLoading}
            >
              Refresh
            </button>
          </div>
        ) : null}

        {activeTab === 'appd' ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <label htmlFor="appd-app-id" className="note" style={{ margin: 0 }}>
              appId
            </label>
            <select
              id="appd-app-id"
              value={appdAppId}
              onChange={e => {
                const next = e.target.value;
                setAppdAppId(next);
                setPreviewJson('');
                void refreshPreview('appd', next);
              }}
              style={{ flex: 1, minWidth: 0 }}
            >
              {[...new Set([appdAppId, ...appdOptions].filter(Boolean))].sort().map(id => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setPreviewJson('');
                void refreshPreview('appd');
              }}
              disabled={previewLoading}
            >
              Refresh
            </button>
          </div>
        ) : null}

        <div
          role="tabpanel"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            background: '#f8fafc',
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
          }}
        >
          {previewLoading && !previewJson ? (
            <span style={{ color: '#667085' }}>Loading reply JSON…</span>
          ) : previewJson ? (
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                opacity: previewLoading ? 0.55 : 1,
              }}
            >
              {previewJson}
            </pre>
          ) : (
            <span style={{ color: '#667085' }}>No preview yet.</span>
          )}
        </div>
        <div
          style={{
            flex: '0 0 auto',
            maxHeight: 140,
            overflow: 'auto',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            background: '#f1f5f9',
            borderRadius: 8,
            padding: 12,
          }}
        >
          {lines.length === 0 ? (
            <span style={{ color: '#667085' }}>Waiting for GetCapabilities…</span>
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
