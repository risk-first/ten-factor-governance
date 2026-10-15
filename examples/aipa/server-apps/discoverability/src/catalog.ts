/**
 * Build discoverability catalogs from the combined AIPA App Directory.
 */
import {
  CONTEXT_TYPES,
  type DiscoverabilityContextTypeEntry,
  type DiscoverabilityIntentEntry,
} from '../../../common/src/contexts/types.ts';

export type AppDirectoryApplication = Record<string, unknown> & {
  appId?: string;
  title?: string;
  name?: string;
  interop?: {
    intents?: {
      listensFor?: Record<
        string,
        { displayName?: string; contexts?: string[]; resultType?: string }
      >;
      raises?: Record<string, { displayName?: string; contexts?: string[]; resultType?: string }>;
    };
  };
};

export type DiscoveryCatalog = {
  apps: AppDirectoryApplication[];
  intents: DiscoverabilityIntentEntry[];
  contextTypes: DiscoverabilityContextTypeEntry[];
};

const KNOWN_CONTEXT_LABELS: Record<string, string> = {
  [CONTEXT_TYPES.portfolio]: 'Portfolio',
  [CONTEXT_TYPES.instrument]: 'Instrument',
  [CONTEXT_TYPES.markdown]: 'Markdown',
  [CONTEXT_TYPES.tabularData]: 'Tabular data',
  [CONTEXT_TYPES.file]: 'File',
  [CONTEXT_TYPES.agentQuery]: 'Agent query',
  [CONTEXT_TYPES.agentAnswer]: 'Agent answer',
};

function intentEntriesFromApp(app: AppDirectoryApplication): DiscoverabilityIntentEntry[] {
  const listens = app.interop?.intents?.listensFor ?? {};
  return Object.entries(listens).map(([name, meta]) => {
    const entry: DiscoverabilityIntentEntry = { name };
    if (meta?.displayName) entry.displayName = meta.displayName;
    if (meta?.contexts?.length) entry.contexts = [...meta.contexts];
    if (meta?.resultType) entry.resultType = meta.resultType;
    return entry;
  });
}

function contextsFromApp(app: AppDirectoryApplication): string[] {
  const out: string[] = [];
  const intents = app.interop?.intents;
  for (const meta of Object.values(intents?.listensFor ?? {})) {
    for (const c of meta?.contexts ?? []) out.push(c);
  }
  for (const meta of Object.values(intents?.raises ?? {})) {
    for (const c of meta?.contexts ?? []) out.push(c);
  }
  return out;
}

export function buildCatalog(applications: AppDirectoryApplication[]): DiscoveryCatalog {
  const apps = applications.filter(a => typeof a.appId === 'string' && a.appId);
  const intentByName = new Map<string, DiscoverabilityIntentEntry>();
  for (const app of apps) {
    for (const entry of intentEntriesFromApp(app)) {
      const prev = intentByName.get(entry.name);
      if (!prev) {
        intentByName.set(entry.name, entry);
        continue;
      }
      const contexts = new Set([...(prev.contexts ?? []), ...(entry.contexts ?? [])]);
      intentByName.set(entry.name, {
        name: entry.name,
        displayName: prev.displayName ?? entry.displayName,
        ...(contexts.size ? { contexts: [...contexts].sort() } : {}),
        resultType: prev.resultType ?? entry.resultType,
      });
    }
  }

  const contextSet = new Set<string>();
  for (const app of apps) {
    for (const c of contextsFromApp(app)) contextSet.add(c);
  }
  // Always include suite context types (including discoverability itself).
  for (const c of Object.values(CONTEXT_TYPES)) contextSet.add(c);

  const contextTypes: DiscoverabilityContextTypeEntry[] = [...contextSet]
    .sort()
    .map(contextType => {
      const entry: DiscoverabilityContextTypeEntry = { contextType };
      const name = KNOWN_CONTEXT_LABELS[contextType];
      if (name) entry.name = name;
      return entry;
    });

  return {
    apps,
    intents: [...intentByName.values()].sort((a, b) => a.name.localeCompare(b.name)),
    contextTypes,
  };
}
