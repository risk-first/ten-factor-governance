import type { ModelMessage } from 'ai';
import type { StagedFile } from './types.js';

export type AgentSession = {
  messages: ModelMessage[];
  files: Map<string, StagedFile>;
  updatedAt: number;
};

const sessions = new Map<string, AgentSession>();
const TTL_MS = 60 * 60 * 1000;

function sweep(): void {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.updatedAt > TTL_MS) sessions.delete(id);
  }
}

export function getSession(id: string): AgentSession | undefined {
  sweep();
  return sessions.get(id);
}

export function saveSession(id: string, session: Omit<AgentSession, 'updatedAt'>): void {
  sessions.set(id, { ...session, updatedAt: Date.now() });
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}
