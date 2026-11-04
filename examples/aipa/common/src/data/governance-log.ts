import fs from 'node:fs';
import {
  GOVERNANCE_CONSOLE_DIR,
  enforcementLogPath,
  evaluationLogPath,
} from './paths.js';

export type GovernanceLogFile = {
  entries: unknown[];
};

function emptyLog(): GovernanceLogFile {
  return { entries: [] };
}

function readLog(dest: string): GovernanceLogFile {
  if (!fs.existsSync(dest)) {
    writeLog(dest, emptyLog());
    return emptyLog();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(dest, 'utf-8')) as GovernanceLogFile;
    return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
  } catch {
    return emptyLog();
  }
}

function writeLog(dest: string, log: GovernanceLogFile): void {
  fs.mkdirSync(GOVERNANCE_CONSOLE_DIR, { recursive: true });
  fs.writeFileSync(dest, `${JSON.stringify(log, null, 2)}\n`, 'utf-8');
}

function prependEntry(dest: string, entry: unknown): GovernanceLogFile {
  const log = readLog(dest);
  const rec = entry && typeof entry === 'object' ? (entry as { metadata?: { id?: string } }) : undefined;
  const id = rec?.metadata?.id;
  log.entries = [entry, ...log.entries.filter(existing => {
    const existingId =
      existing && typeof existing === 'object'
        ? (existing as { metadata?: { id?: string } }).metadata?.id
        : undefined;
    return !id || existingId !== id;
  })];
  writeLog(dest, log);
  return log;
}

export function ensureGovernanceLogs(): void {
  readLog(evaluationLogPath());
  readLog(enforcementLogPath());
}

export function loadEvaluationLogs(): GovernanceLogFile {
  return readLog(evaluationLogPath());
}

export function loadEnforcementLogs(): GovernanceLogFile {
  return readLog(enforcementLogPath());
}

export function appendEvaluationLog(entry: unknown): GovernanceLogFile {
  return prependEntry(evaluationLogPath(), entry);
}

export function appendEnforcementLog(entry: unknown): GovernanceLogFile {
  return prependEntry(enforcementLogPath(), entry);
}
