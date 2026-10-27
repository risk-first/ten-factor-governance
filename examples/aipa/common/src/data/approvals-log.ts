import fs from 'node:fs';
import { APPROVALS_DIR, approvalsLogPath } from './paths.js';

export type ApprovalSnapshot = {
  type: 'fdc3.approval';
  id: { requestId?: string; approvalId?: string };
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  subject?: Record<string, unknown>;
  updatedAt?: string;
};

export type ApprovalsLog = {
  entries: ApprovalSnapshot[];
};

function emptyLog(): ApprovalsLog {
  return { entries: [] };
}

export function loadApprovalsLog(): ApprovalsLog {
  const dest = approvalsLogPath();
  if (!fs.existsSync(dest)) {
    saveApprovalsLog(emptyLog());
    return emptyLog();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(dest, 'utf-8')) as ApprovalsLog;
    return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
  } catch {
    return emptyLog();
  }
}

export function saveApprovalsLog(log: ApprovalsLog): void {
  fs.mkdirSync(APPROVALS_DIR, { recursive: true });
  fs.writeFileSync(approvalsLogPath(), `${JSON.stringify(log, null, 2)}\n`, 'utf-8');
}
