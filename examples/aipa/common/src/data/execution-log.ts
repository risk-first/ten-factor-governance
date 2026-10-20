import fs from 'node:fs';
import { EXECUTION_LOG_DIR, executionLogPath } from './paths.js';

export type ExecutionLogEntry = {
  id: string;
  number: number;
  at: string;
  order: unknown;
  result: unknown;
};

export type ExecutionLog = {
  entries: ExecutionLogEntry[];
};

function emptyLog(): ExecutionLog {
  return { entries: [] };
}

export function loadExecutionLog(): ExecutionLog {
  const dest = executionLogPath();
  if (!fs.existsSync(dest)) {
    saveExecutionLog(emptyLog());
    return emptyLog();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(dest, 'utf-8')) as ExecutionLog;
    return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
  } catch {
    return emptyLog();
  }
}

export function saveExecutionLog(log: ExecutionLog): void {
  fs.mkdirSync(EXECUTION_LOG_DIR, { recursive: true });
  fs.writeFileSync(executionLogPath(), `${JSON.stringify(log, null, 2)}\n`, 'utf-8');
}

function nextOrderNumber(entries: ExecutionLogEntry[]): number {
  let max = 0;
  for (const entry of entries) {
    if (typeof entry.number === 'number' && entry.number > max) max = entry.number;
  }
  return max + 1;
}

export function appendExecutionLog(entry: Omit<ExecutionLogEntry, 'number'> & { number?: number }): ExecutionLog {
  const log = loadExecutionLog();
  const numbered: ExecutionLogEntry = {
    ...entry,
    number: entry.number ?? nextOrderNumber(log.entries),
  };
  log.entries.unshift(numbered);
  saveExecutionLog(log);
  return log;
}
