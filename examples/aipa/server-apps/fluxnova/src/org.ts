/** Identity helpers for Fluxnova task assignment / Entra session checks. */

export function resolveRequester(input?: {
  requester?: string;
  raiserAppId?: string;
}): string {
  const explicit = input?.requester?.trim();
  if (explicit) return explicit;
  const fromApp = input?.raiserAppId?.trim();
  if (fromApp) return fromApp;
  return 'unknown';
}

function identityTokens(user: { email?: string; name?: string }): Set<string> {
  const tokens = new Set<string>();
  const email = user.email?.trim().toLowerCase();
  if (email) tokens.add(email);
  const name = user.name?.trim().toLowerCase();
  if (name) tokens.add(name);
  return tokens;
}

/** True when a signed-in Entra user matches the task assignee email. */
export function sessionMatchesAssignee(
  user: { email?: string; name?: string } | null | undefined,
  assignee?: string
): boolean {
  if (!user) return false;
  const tokens = identityTokens(user);
  if (tokens.size === 0) return false;
  const wanted = assignee?.trim().toLowerCase();
  if (!wanted) return true;
  return tokens.has(wanted);
}
