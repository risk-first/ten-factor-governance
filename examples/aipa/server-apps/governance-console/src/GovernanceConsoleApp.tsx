import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isEnforcementLog,
  isEvaluationLog,
  type EnforcementLogData,
  type EvaluationLogData,
} from '@gemara/react';
import { GemaraProvider } from '@gemara/react/provider';
import {
  DEFAULT_CATALOG_URLS,
  makeCatalogLinkResolver,
  withCatalogUrls,
  type CatalogUrls,
} from './catalogLinks.tsx';
import { EvaluationLog } from '@gemara/react/evaluation-log';
import { EnforcementReceipt } from './EnforcementReceipt.tsx';
import type { Context, ContextMetadata } from '@finos/fdc3';
import type { ExchangeDataMessage } from '@finos/fdc3-security';
import { connectAppSession, setStatus } from '../../../common/src/fdc3/agent.ts';
import { INTENTS } from '../../../common/src/contexts/types.ts';
import { mountStatusDrawer } from '../../../common/src/ui/status-drawer.ts';
import { LOAD_LOGS, LOGS_UPDATED } from './boundary.ts';

type Tab = 'evaluation' | 'enforcement';

type GemaraLog = EvaluationLogData | EnforcementLogData;

function logId(log: GemaraLog, index: number): string {
  return log.metadata?.id ?? String(index);
}

function formatWhen(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function asLogs<T extends GemaraLog>(value: unknown, guard: (x: unknown) => x is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

function snapshotFromPayload(payload: unknown): {
  evaluations: EvaluationLogData[];
  enforcements: EnforcementLogData[];
} {
  const rec = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  return {
    evaluations: asLogs(rec.evaluations, isEvaluationLog),
    enforcements: asLogs(rec.enforcements, isEnforcementLog),
  };
}

export function GovernanceConsoleApp() {
  const [tab, setTab] = useState<Tab>('evaluation');
  const [evaluations, setEvaluations] = useState<EvaluationLogData[]>([]);
  const [enforcements, setEnforcements] = useState<EnforcementLogData[]>([]);
  const [selectedEvalId, setSelectedEvalId] = useState<string>();
  const [selectedEnfId, setSelectedEnfId] = useState<string>();
  const [catalogs, setCatalogs] = useState<CatalogUrls>(DEFAULT_CATALOG_URLS);
  const drawer = useRef(mountStatusDrawer());

  const applySnapshot = useCallback((payload: unknown) => {
    const next = snapshotFromPayload(payload);
    setEvaluations(next.evaluations);
    setEnforcements(next.enforcements);
    if (next.evaluations[0]?.metadata?.id) {
      setSelectedEvalId(current => current ?? next.evaluations[0].metadata.id);
    }
    if (next.enforcements[0]?.metadata?.id) {
      setSelectedEnfId(current => current ?? next.enforcements[0].metadata.id);
    }
  }, []);

  useEffect(() => {
    void fetch('/api/config')
      .then(res => (res.ok ? res.json() : DEFAULT_CATALOG_URLS))
      .then((body: Partial<CatalogUrls>) => {
        setCatalogs({
          controlsCatalogUrl: body.controlsCatalogUrl?.trim() || DEFAULT_CATALOG_URLS.controlsCatalogUrl,
          policyUrl: body.policyUrl?.trim() || DEFAULT_CATALOG_URLS.policyUrl,
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const statusEl = () => drawer.current.statusEl;

    void (async () => {
      const session = await connectAppSession(statusEl(), async (msg: ExchangeDataMessage) => {
        if (msg.purpose === LOGS_UPDATED) applySnapshot(msg.payload);
      });
      if (cancelled || !session.fdc3 || !session.boundary) {
        if (!cancelled && session.fdc3 && !session.boundary) {
          setStatus(statusEl(), 'FDC3 connected; secure backend unavailable — history will not persist.');
        }
        return;
      }

      const stored = await session.boundary.exchangeData(LOAD_LOGS, {});
      if (cancelled) return;
      applySnapshot(stored);

      const evaluationHandler = await session.boundary.remoteIntentHandler(INTENTS.LogEvaluation);
      const enforcementHandler = await session.boundary.remoteIntentHandler(INTENTS.LogEnforcement);

      await session.fdc3.addIntentListener(INTENTS.LogEvaluation, async (ctx: Context, metadata?: ContextMetadata) => {
        await evaluationHandler(ctx, metadata ?? { source: { appId: 'unknown' }, timestamp: new Date() });
        const id = (ctx as { log?: { metadata?: { id?: string } } }).log?.metadata?.id;
        if (id) setSelectedEvalId(id);
        setStatus(statusEl(), `Evaluation: ${id ?? 'receipt'}`);
      });

      await session.fdc3.addIntentListener(INTENTS.LogEnforcement, async (ctx: Context, metadata?: ContextMetadata) => {
        await enforcementHandler(ctx, metadata ?? { source: { appId: 'unknown' }, timestamp: new Date() });
        const id = (ctx as { log?: { metadata?: { id?: string } } }).log?.metadata?.id;
        if (id) setSelectedEnfId(id);
        setStatus(statusEl(), `Enforcement: ${id ?? 'receipt'}`);
      });

      setStatus(statusEl(), 'Listening for LogEvaluation / LogEnforcement');
    })();

    return () => {
      cancelled = true;
    };
  }, [applySnapshot]);

  const logs = tab === 'evaluation' ? evaluations : enforcements;
  const selectedId = tab === 'evaluation' ? selectedEvalId : selectedEnfId;
  const selected = logs.find((log, index) => logId(log, index) === selectedId) ?? logs[0];
  const empty =
    tab === 'evaluation'
      ? 'No evaluation receipts yet. Direct or JEV governance raises LogEvaluation after each decision.'
      : 'No enforcement receipts yet. Direct / JEV raise LogEnforcement on Allow or Deny; Approvals / Fluxnova raise it on hold and approved execute.';

  function select(id: string): void {
    if (tab === 'evaluation') setSelectedEvalId(id);
    else setSelectedEnfId(id);
  }

  return (
    <div className="console">
      <header className="console__header">
        <div className="console__tabs" role="tablist" aria-label="Gemara logs">
          <button
            type="button"
            role="tab"
            className="console__tab"
            aria-selected={tab === 'evaluation'}
            onClick={() => setTab('evaluation')}
          >
            Evaluation ({evaluations.length})
          </button>
          <button
            type="button"
            role="tab"
            className="console__tab"
            aria-selected={tab === 'enforcement'}
            onClick={() => setTab('enforcement')}
          >
            Enforcement ({enforcements.length})
          </button>
        </div>
      </header>

      <div className="console__split">
        <nav className="console__list" aria-label={`${tab} receipts`}>
          {logs.length === 0 ? (
            <p className="console__empty-list">No events</p>
          ) : (
            logs.map((log, index) => {
              const id = logId(log, index);
              const current = selected ? logId(selected, logs.indexOf(selected)) === id : false;
              return (
                <button
                  key={id}
                  type="button"
                  className="console__item"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => select(id)}
                >
                  {formatWhen(log.metadata?.date)}
                </button>
              );
            })
          )}
        </nav>

        <section className="console__detail">
          {!selected ? (
            <p className="console__empty-detail">{empty}</p>
          ) : (
            <GemaraProvider linkResolver={makeCatalogLinkResolver(catalogs)}>
              {tab === 'evaluation' ? (
                <EvaluationLog
                  data={withCatalogUrls(selected as EvaluationLogData, catalogs)}
                  headingLevel={2}
                />
              ) : (
                <EnforcementReceipt
                  data={withCatalogUrls(selected as EnforcementLogData, catalogs)}
                  headingLevel={2}
                />
              )}
            </GemaraProvider>
          )}
        </section>
      </div>
    </div>
  );
}
