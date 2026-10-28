/** Demo org chart: requester identity → Fluxnova Tasklist assignee. */

const SUPERVISORS: Record<string, string> = {
  'rob@finos.org': 'demo',
  'demo@finos.org': 'demo',
  demo: 'demo',
};

const APP_REQUESTERS: Record<string, string> = {
  'aipa-order-entry': 'rob@finos.org',
  'aipa-approvals': 'demo',
  'aipa-fluxnova': 'demo',
};

export function resolveRequester(input?: {
  requester?: string;
  raiserAppId?: string;
}): string {
  const explicit = input?.requester?.trim().toLowerCase();
  if (explicit) return explicit;
  const fromApp = input?.raiserAppId ? APP_REQUESTERS[input.raiserAppId] : undefined;
  if (fromApp) return fromApp;
  return 'demo';
}

export function supervisorOf(requester: string): string {
  const key = requester.trim().toLowerCase();
  return SUPERVISORS[key] ?? 'demo';
}
