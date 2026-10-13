import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DesktopAgent } from '@finos/fdc3';
import { connectAppSession } from '../../../common/src/fdc3/agent.ts';
import {
  CONTEXT_TYPES,
  INTENTS,
  type ResearchBundle,
  type ResearchFinding,
} from '../../../common/src/contexts/types.ts';
import { toResultContext, type SignedEnvelope } from '../../../common/src/security/envelope.ts';
import { BroadcastButton } from '../../../common/src/ui/BroadcastButton.tsx';
import { StatusDrawer } from '../../../common/src/ui/StatusDrawer.tsx';

type BundleView = ResearchBundle & {
  __appMeta?: unknown;
};

type InstrumentContext = {
  type: 'fdc3.instrument';
  name?: string;
  id: { ticker: string; [key: string]: string | undefined };
};

type ResearchTab = {
  key: string;
  color: string;
  instrument: InstrumentContext;
  /** Extra instruments when the tab covers a multi-ticker fetch. */
  instruments: InstrumentContext[];
  bundle: BundleView | null;
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

function tabKeyForTickers(tickers: string[]): string {
  return [...new Set(tickers.map(t => t.toUpperCase()).filter(Boolean))].sort().join(',') || 'SHEL';
}

function asInstrument(ctx: unknown, fallbackTicker = ''): InstrumentContext | null {
  if (!ctx || typeof ctx !== 'object') return null;
  const c = ctx as {
    type?: string;
    name?: string;
    id?: Record<string, string | undefined>;
    instrument?: { type?: string; name?: string; id?: Record<string, string | undefined> };
  };
  if (c.type === CONTEXT_TYPES.position && c.instrument) {
    return asInstrument({ ...c.instrument, type: CONTEXT_TYPES.instrument }, fallbackTicker);
  }
  const ticker = (c.id?.ticker ?? fallbackTicker).toUpperCase();
  if (!ticker) return null;
  const instrument: InstrumentContext = {
    type: 'fdc3.instrument',
    id: { ...(c.id ?? {}), ticker },
  };
  if (typeof c.name === 'string' && c.name.trim()) instrument.name = c.name.trim();
  return instrument;
}

function mergeInstrument(
  existing: InstrumentContext | undefined,
  incoming: InstrumentContext | null | undefined,
  ticker: string
): InstrumentContext {
  const id: InstrumentContext['id'] = {
    ...(existing?.id ?? {}),
    ...(incoming?.id ?? {}),
    ticker,
  };
  const name = incoming?.name?.trim() || existing?.name?.trim() || undefined;
  const instrument: InstrumentContext = { type: 'fdc3.instrument', id };
  if (name) instrument.name = name;
  return instrument;
}

function tickersFromContext(ctx: unknown): string[] {
  if (!ctx || typeof ctx !== 'object') return [];
  const c = ctx as Record<string, unknown>;
  if (typeof c.tickers === 'string') {
    return String(c.tickers)
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
  }
  if (Array.isArray(c.tickers)) {
    return (c.tickers as string[]).map(t => String(t).toUpperCase()).filter(Boolean);
  }
  const single = asInstrument(ctx);
  if (single) return [single.id.ticker];
  return [];
}

function parseTickerInput(raw: string): string[] {
  return raw
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
}

export function ResearchApp() {
  const [status, setStatus] = useState('Connecting…');
  const [tickersInput, setTickersInput] = useState('SHEL');
  const [tabs, setTabs] = useState<ResearchTab[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [fdc3, setFdc3] = useState<DesktopAgent | null>(null);
  const [loading, setLoading] = useState(false);
  const tickersInputRef = useRef(tickersInput);
  tickersInputRef.current = tickersInput;
  const colorIdx = useRef(0);

  const activeTab = useMemo(
    () => tabs.find(t => t.key === activeKey) ?? tabs[0] ?? null,
    [tabs, activeKey]
  );
  const findings = activeTab?.bundle?.findings ?? [];
  const subjectTickers = activeTab?.bundle?.subject?.tickers ?? [];

  const nextColor = useCallback(() => {
    const c = COLORS[colorIdx.current % COLORS.length]!;
    colorIdx.current += 1;
    return c;
  }, []);

  const upsertTab = useCallback(
    (
      tickers: string[],
      bundle: BundleView,
      incoming?: InstrumentContext | null
    ): string => {
      const key = tabKeyForTickers(tickers);
      const primaryTicker = tickers[0]!.toUpperCase();
      setTabs(prev => {
        const existing = prev.find(t => t.key === key);
        const instrument = mergeInstrument(
          existing?.instrument,
          incoming?.id.ticker === primaryTicker ? incoming : null,
          primaryTicker
        );
        // If multi-ticker and incoming was for another ticker, still merge into instruments list.
        const instrumentsMap = new Map<string, InstrumentContext>();
        for (const inst of existing?.instruments ?? []) {
          instrumentsMap.set(inst.id.ticker, inst);
        }
        for (const t of tickers) {
          if (!instrumentsMap.has(t)) {
            instrumentsMap.set(t, { type: 'fdc3.instrument', id: { ticker: t } });
          }
        }
        if (incoming?.id.ticker) {
          instrumentsMap.set(
            incoming.id.ticker,
            mergeInstrument(instrumentsMap.get(incoming.id.ticker), incoming, incoming.id.ticker)
          );
        }
        // Keep primary instrument name preferred for chip.
        const primary = mergeInstrument(
          instrumentsMap.get(primaryTicker),
          instrument,
          primaryTicker
        );
        instrumentsMap.set(primaryTicker, primary);

        const tab: ResearchTab = {
          key,
          color: existing?.color ?? nextColor(),
          instrument: primary,
          instruments: [...instrumentsMap.values()],
          bundle,
        };
        if (existing) {
          return prev.map(t => (t.key === key ? tab : t));
        }
        return [...prev, tab];
      });
      setActiveKey(key);
      return key;
    },
    [nextColor]
  );

  const fetchResearch = useCallback(
    async (
      context?: unknown,
      incomingInstrument?: InstrumentContext | null
    ): Promise<Record<string, unknown>> => {
      setLoading(true);
      try {
        const res = await fetch('/api/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: context ?? { tickers: tickersInputRef.current },
          }),
        });
        const envelope = (await res.json()) as SignedEnvelope;
        const result = toResultContext(envelope) as BundleView;
        const fromCtx = tickersFromContext(context);
        const fromInput = parseTickerInput(tickersInputRef.current);
        const list =
          (result.subject?.tickers?.length ? result.subject.tickers : null) ??
          (fromCtx.length ? fromCtx : null) ??
          (fromInput.length ? fromInput : ['SHEL']);
        upsertTab(list, result, incomingInstrument ?? asInstrument(context));
        setDetail(null);
        const label =
          incomingInstrument?.name ||
          asInstrument(context)?.name ||
          list.join(', ');
        setStatus(`Research ready — ${label}`);
        return result as unknown as Record<string, unknown>;
      } finally {
        setLoading(false);
      }
    },
    [upsertTab]
  );

  const onInstrumentContext = useCallback(
    async (ctx: unknown) => {
      const instrument = asInstrument(ctx);
      const ticker = instrument?.id.ticker;
      if (!ticker) return;
      setTickersInput(ticker);
      setStatus(
        `Received ${CONTEXT_TYPES.instrument} ${instrument?.name ?? ticker} — fetching research…`
      );
      await fetchResearch(
        {
          type: CONTEXT_TYPES.instrument,
          name: instrument?.name,
          id: instrument?.id ?? { ticker },
        },
        instrument
      );
    },
    [fetchResearch]
  );

  const broadcastInstrument = useCallback(
    async (instrument: InstrumentContext) => {
      if (!fdc3) {
        setStatus('No agent — cannot broadcast.');
        return;
      }
      await fdc3.broadcast(instrument as Parameters<DesktopAgent['broadcast']>[0]);
      const name = instrument.name;
      setStatus(
        name
          ? `Broadcast ${instrument.id.ticker} (${name})`
          : `Broadcast fdc3.instrument ${instrument.id.ticker}`
      );
    },
    [fdc3]
  );

  const removeTab = useCallback(
    (key: string) => {
      setTabs(prev => {
        const next = prev.filter(t => t.key !== key);
        setActiveKey(curr => {
          if (curr !== key) return curr;
          return next[0]?.key ?? null;
        });
        return next;
      });
      setStatus(`Removed research tab ${key}`);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<{ unsubscribe: () => Promise<void> | void }> = [];

    void (async () => {
      const proxy = {
        get textContent() {
          return '';
        },
        set textContent(v: string) {
          if (!cancelled) setStatus(v);
        },
      } as HTMLElement;
      const session = await connectAppSession(proxy);
      if (cancelled) return;
      setFdc3(session.fdc3);
      if (!session.fdc3) return;

      unsubs.push(
        await session.fdc3.addContextListener(CONTEXT_TYPES.instrument, async ctx => {
          await onInstrumentContext(ctx);
        })
      );
      unsubs.push(
        await session.fdc3.addContextListener(CONTEXT_TYPES.position, async ctx => {
          await onInstrumentContext(ctx);
        })
      );

      unsubs.push(
        await session.fdc3.addIntentListener(INTENTS.GetResearch, async ctx =>
          fetchResearch(ctx, asInstrument(ctx))
        )
      );
      unsubs.push(
        await session.fdc3.addIntentListener(INTENTS.ViewInstrument, async ctx => {
          await onInstrumentContext(ctx);
        })
      );
      unsubs.push(
        await session.fdc3.addIntentListener(INTENTS.ViewNews, async ctx => {
          const result = await fetchResearch(ctx, asInstrument(ctx));
          const items = ((result as BundleView).findings ?? []).map(f => `• ${f.title}`);
          setDetail(items.join('\n') || 'No news');
          setStatus('ViewNews');
        })
      );
      unsubs.push(
        await session.fdc3.addIntentListener(INTENTS.ViewResearch, async ctx => {
          const instrument = asInstrument(ctx);
          const ticker = instrument?.id.ticker ?? 'subject';
          setDetail(`Research detail for ${instrument?.name ?? ticker}`);
          setStatus('ViewResearch');
          if (ticker !== 'subject') await onInstrumentContext(ctx);
        })
      );
    })();

    return () => {
      cancelled = true;
      for (const u of unsubs) void u.unsubscribe?.();
    };
  }, [fetchResearch, onInstrumentContext]);

  return (
    <div className="container research-app">
      <div className="box research-panel">
        <div className="research-panel__header">
          <div className="toolbar ticker-bar">
            <div className="ticker-chips" aria-label="Research subjects">
              {tabs.map(tab => {
                const name = tab.instrument.name;
                const multi = tab.key.includes(',');
                const isActive = tab.key === activeTab?.key;
                return (
                  <div
                    key={tab.key}
                    className={`ticker-chip${isActive ? '' : ' ticker-chip--dimmed'}`}
                    style={{ color: isActive ? tab.color : undefined }}
                    data-active={isActive ? 'true' : 'false'}
                    title={name ? `${tab.key} — ${name}` : tab.key}
                  >
                    <button
                      type="button"
                      className="ticker-chip__focus"
                      onClick={() => {
                        setActiveKey(tab.key);
                        setTickersInput(tab.key.replace(/,/g, ', '));
                        setDetail(null);
                        setStatus(`Showing research for ${name ?? tab.key}`);
                      }}
                    >
                      <span className="ticker-chip__swatch" />
                      <span>{multi ? tab.key : tab.instrument.id.ticker}</span>
                      {name && !multi ? (
                        <span className="ticker-chip__name">{name}</span>
                      ) : null}
                    </button>
                    <BroadcastButton
                      title={`Broadcast ${name || tab.instrument.id.ticker}`}
                      className="ticker-chip__broadcast"
                      disabled={!fdc3}
                      onClick={() => void broadcastInstrument(tab.instrument)}
                    />
                    <button
                      type="button"
                      className="ticker-chip__remove"
                      aria-label={`Remove ${tab.key}`}
                      onClick={() => removeTab(tab.key)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <label className="add-ticker">
              <input
                value={tickersInput}
                onChange={e => setTickersInput(e.target.value)}
                aria-label="Tickers"
                placeholder="Ticker"
                size={10}
              />
            </label>
            <button
              type="button"
              className="primary"
              disabled={loading}
              onClick={() => void fetchResearch()}
            >
              {loading ? 'Loading…' : 'Add'}
            </button>
          </div>

          {activeTab?.bundle ? (
            <div className="meta-row">
              <span className="badge">
                {activeTab.bundle.provenance?.sources?.join(' · ') || 'bundle'}
              </span>
              <span>{new Date(activeTab.bundle.asOf).toLocaleString()}</span>
              <span>{subjectTickers.join(', ')}</span>
            </div>
          ) : (
            <p className="meta-row">
              Add a ticker or broadcast an instrument to load research.
            </p>
          )}
        </div>

        <div className="research-panel__body">
          <div className="finding-list">
            {findings.map((f: ResearchFinding, i) => (
              <article className="finding-card" key={`${activeTab?.key}-${f.title}-${i}`}>
                <h3>{f.title}</h3>
                <p>{f.summary}</p>
                <div className="finding-meta">
                  <span className="badge">{f.sourceType}</span>
                  <span>{new Date(f.publishedAt).toLocaleDateString()}</span>
                  {(f.tickers ?? []).map(t => {
                    const inst =
                      activeTab?.instruments.find(x => x.id.ticker === t) ??
                      ({ type: 'fdc3.instrument', id: { ticker: t } } as InstrumentContext);
                    return (
                      <BroadcastButton
                        key={t}
                        title={`Broadcast ${inst.name || t}`}
                        disabled={!fdc3}
                        onClick={() => void broadcastInstrument(inst)}
                      />
                    );
                  })}
                  {f.sourceUrl ? (
                    <a href={f.sourceUrl} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {detail ? (
            <div className="box">
              <h2>Detail</h2>
              <pre className="code">{detail}</pre>
            </div>
          ) : null}
        </div>
      </div>

      <StatusDrawer message={status} />
    </div>
  );
}
