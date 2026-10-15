/**
 * Citation helpers adapted from OpenBB Agent Rita protocol/citations.ts (MIT) — slimmed.
 */

import type { Citation } from './types.js';

export function citationFromFile(fileId: string, name: string): Citation {
  return {
    id: `file:${fileId}`,
    source: 'file',
    title: name,
    fileId,
  };
}

export function citationFromApp(
  intent: string,
  appId?: string,
  instanceId?: string,
  title?: string
): Citation {
  return {
    id: `app:${appId ?? 'unknown'}:${intent}`,
    source: 'app',
    title: title ?? intent,
    appInstanceId: instanceId,
  };
}

export function mergeCitations(...lists: (Citation[] | undefined)[]): Citation[] {
  const byId = new Map<string, Citation>();
  for (const list of lists) {
    for (const c of list ?? []) byId.set(c.id, c);
  }
  return [...byId.values()];
}
