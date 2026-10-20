/**
 * Build discoverability catalogs from the combined AIPA App Directory.
 */
import {
  CONTEXT_TYPES,
  type DiscoverabilityAppEntry,
  type DiscoverabilityContextTypeEntry,
  type DiscoverabilityIntentEntry,
} from '../../../common/src/contexts/types.ts';
import type { ContextTypeCatalogMeta } from './schemaLookup.ts';

export type AppDirectoryApplication = Record<string, unknown> & {
  appId?: string;
  title?: string;
  name?: string;
  description?: string;
  interop?: {
    intents?: {
      listensFor?: Record<
        string,
        {
          displayName?: string;
          /** Non-standard AppD extension used by fdc3.discoverability. */
          purpose?: string;
          contexts?: string[];
          resultType?: string;
        }
      >;
      raises?: Record<
        string,
        {
          displayName?: string;
          purpose?: string;
          contexts?: string[];
          resultType?: string;
        }
      >;
    };
  };
};

export type DiscoveryCatalog = {
  apps: DiscoverabilityAppEntry[];
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
  [CONTEXT_TYPES.portfolioRecommendation]: 'Portfolio recommendation',
  [CONTEXT_TYPES.orderProposal]: 'Order proposal',
  [CONTEXT_TYPES.portfolioRisk]: 'Portfolio risk',
  [CONTEXT_TYPES.researchBundle]: 'Research bundle',
  [CONTEXT_TYPES.stressScenarioRequest]: 'Stress scenario request',
  [CONTEXT_TYPES.stressScenarioResult]: 'Stress scenario result',
  [CONTEXT_TYPES.priceHistory]: 'Price history',
};

function intentEntriesFromApp(app: AppDirectoryApplication): DiscoverabilityIntentEntry[] {
  const listens = app.interop?.intents?.listensFor ?? {};
  return Object.entries(listens).flatMap(([name, meta]) => {
    const purpose = typeof meta?.purpose === 'string' ? meta.purpose.trim() : '';
    if (!purpose) return [];
    const entry: DiscoverabilityIntentEntry = { name, purpose };
    if (meta?.displayName) entry.displayName = meta.displayName;
    if (meta?.contexts?.length) entry.contexts = [...meta.contexts];
    if (meta?.resultType) entry.resultType = meta.resultType;
    return [entry];
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

function appEntryFromApp(app: AppDirectoryApplication): DiscoverabilityAppEntry | null {
  if (typeof app.appId !== 'string' || !app.appId) return null;
  const entry: DiscoverabilityAppEntry = { appId: app.appId };
  const title =
    typeof app.title === 'string' ? app.title : typeof app.name === 'string' ? app.name : undefined;
  if (title) entry.title = title;
  if (typeof app.description === 'string' && app.description) entry.description = app.description;
  return entry;
}

export function findApplicationById(
  applications: AppDirectoryApplication[],
  appId: string
): AppDirectoryApplication | undefined {
  const trimmed = appId.trim();
  if (!trimmed) return undefined;
  return applications.find(a => a.appId === trimmed);
}

export function buildCatalog(
  applications: AppDirectoryApplication[],
  schemaMeta: Map<string, ContextTypeCatalogMeta> = new Map()
): DiscoveryCatalog {
  const sourceApps = applications.filter(a => typeof a.appId === 'string' && a.appId);
  const apps = sourceApps
    .map(appEntryFromApp)
    .filter((a): a is DiscoverabilityAppEntry => a != null)
    .sort((a, b) => a.appId.localeCompare(b.appId));
  const intentByName = new Map<string, DiscoverabilityIntentEntry>();
  for (const app of sourceApps) {
    for (const entry of intentEntriesFromApp(app)) {
      const prev = intentByName.get(entry.name);
      if (!prev) {
        intentByName.set(entry.name, entry);
        continue;
      }
      const contexts = new Set([...(prev.contexts ?? []), ...(entry.contexts ?? [])]);
      const purpose =
        prev.purpose === entry.purpose
          ? prev.purpose
          : [prev.purpose, entry.purpose].filter(Boolean).join(' | ');
      intentByName.set(entry.name, {
        name: entry.name,
        purpose,
        displayName: prev.displayName ?? entry.displayName,
        ...(contexts.size ? { contexts: [...contexts].sort() } : {}),
        resultType: prev.resultType ?? entry.resultType,
      });
    }
  }

  const contextSet = new Set<string>();
  for (const app of sourceApps) {
    for (const c of contextsFromApp(app)) contextSet.add(c);
  }
  // Always include suite context types (including discoverability itself).
  for (const c of Object.values(CONTEXT_TYPES)) contextSet.add(c);

  const contextTypes: DiscoverabilityContextTypeEntry[] = [...contextSet]
    .sort()
    .map(contextType => {
      const meta = schemaMeta.get(contextType);
      const entry: DiscoverabilityContextTypeEntry = { contextType };
      const name = meta?.name ?? KNOWN_CONTEXT_LABELS[contextType];
      if (name) entry.name = name;
      if (meta?.description) entry.description = meta.description;
      if (meta?.schemaUrl) entry.schemaUrl = meta.schemaUrl;
      return entry;
    });

  return {
    apps,
    intents: [...intentByName.values()].sort((a, b) => a.name.localeCompare(b.name)),
    contextTypes,
  };
}
