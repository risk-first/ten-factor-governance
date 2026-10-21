/**
 * Normalize fdc3.discoverability.appDirectory replies for the LLM.
 * Wire payload is already slim (appId / title / description).
 */

export type SummarizedDiscoverApp = {
  appId: string;
  title?: string;
  description?: string;
};

export function summarizeDiscoverApps(reply: unknown): {
  type: string;
  apps: SummarizedDiscoverApp[];
} {
  const raw = (reply ?? {}) as {
    type?: string;
    apps?: unknown[];
  };
  const appsIn = Array.isArray(raw.apps) ? raw.apps : [];
  const apps: SummarizedDiscoverApp[] = [];

  for (const item of appsIn) {
    if (!item || typeof item !== 'object') continue;
    const app = item as {
      appId?: unknown;
      title?: unknown;
      name?: unknown;
      description?: unknown;
    };
    if (typeof app.appId !== 'string' || !app.appId) continue;

    const title =
      typeof app.title === 'string'
        ? app.title
        : typeof app.name === 'string'
          ? app.name
          : undefined;
    const description =
      typeof app.description === 'string' ? app.description : undefined;

    const entry: SummarizedDiscoverApp = { appId: app.appId };
    if (title) entry.title = title;
    if (description) entry.description = description;
    apps.push(entry);
  }

  return {
    type: typeof raw.type === 'string' ? raw.type : 'fdc3.discoverability.appDirectory',
    apps,
  };
}
