/** Demo org chart: requester identity → Fluxnova Tasklist assignee. */

const SUPERVISORS: Record<string, string> = {
  'rob@finos.org': 'rob@finos.org',
  'rob.moffat@finos.org': 'rob@finos.org',
  'olivier@finos.org': 'olivier@finos.org',
  'demo@finos.org': 'rob@finos.org',
  demo: 'rob@finos.org',
};

const APP_REQUESTERS: Record<string, string> = {
  'aipa-order-entry': 'rob.moffat@finos.org',
  'aipa-approvals': 'rob@finos.org',
  'aipa-fluxnova': 'rob@finos.org',
};

/**
 * Identities that may complete work assigned to a given Tasklist user.
 * Sail Governance assigns rob@finos.org or olivier@finos.org; Entra may use
 * rob.moffat@finos.org for Rob.
 */
const ASSIGNEE_EQUIVALENTS: Record<string, readonly string[]> = {
  'rob@finos.org': ['rob@finos.org', 'rob', 'rob.moffat@finos.org', 'rob.moffat'],
  'rob.moffat@finos.org': ['rob.moffat@finos.org', 'rob.moffat', 'rob@finos.org'],
  'olivier@finos.org': ['olivier@finos.org', 'olivier'],
  demo: ['demo', 'demo@finos.org', 'rob@finos.org', 'rob.moffat@finos.org', 'rob.moffat'],
};

export function resolveRequester(input?: {
  requester?: string;
  raiserAppId?: string;
}): string {
  const explicit = input?.requester?.trim().toLowerCase();
  if (explicit) return explicit;
  const fromApp = input?.raiserAppId ? APP_REQUESTERS[input.raiserAppId] : undefined;
  if (fromApp) return fromApp;
  return 'rob@finos.org';
}

export function supervisorOf(requester: string): string {
  const key = requester.trim().toLowerCase();
  return SUPERVISORS[key] ?? 'rob@finos.org';
}

function identityTokens(user: { email?: string; name?: string }): Set<string> {
  const tokens = new Set<string>();
  const email = user.email?.trim().toLowerCase();
  if (email) {
    tokens.add(email);
    tokens.add(email.split('@')[0] ?? email);
  }
  const name = user.name?.trim().toLowerCase();
  if (name) tokens.add(name);
  return tokens;
}

/** True when a signed-in Entra user may complete a task assigned to `assignee`. */
export function sessionMatchesAssignee(
  user: { email?: string; name?: string } | null | undefined,
  assignee?: string
): boolean {
  if (!user) return false;
  const tokens = identityTokens(user);
  if (tokens.size === 0) return false;
  const wanted = assignee?.trim().toLowerCase();
  if (!wanted) return true;
  if (tokens.has(wanted)) return true;
  const aliases = ASSIGNEE_EQUIVALENTS[wanted] ?? [wanted];
  return aliases.some(alias => tokens.has(alias));
}
