import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to common/fixtures */
export const FIXTURES_DIR = path.resolve(here, '../../fixtures');

/** Runtime book owned by the portfolio app (gitignored). */
export const LIVE_PORTFOLIO_DIR = path.resolve(here, '../../../server-apps/portfolio/temp');

/** Runtime SubmitOrder log owned by the execution app (gitignored). */
export const EXECUTION_LOG_DIR = path.resolve(here, '../../../server-apps/execution/temp');

/** Runtime approval worklist owned by the approvals inbox (gitignored). */
export const APPROVALS_DIR = path.resolve(here, '../../../server-apps/approvals/temp');

/** Runtime Gemara logs owned by the Governance Console (gitignored). */
export const GOVERNANCE_CONSOLE_DIR = path.resolve(
  here,
  '../../../server-apps/governance-console/temp'
);

export function fixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name);
}

export function livePortfolioPath(): string {
  return path.join(LIVE_PORTFOLIO_DIR, 'portfolio.json');
}

export function executionLogPath(): string {
  return path.join(EXECUTION_LOG_DIR, 'submit-order.json');
}

export function approvalsLogPath(): string {
  return path.join(APPROVALS_DIR, 'approvals.json');
}

export function evaluationLogPath(): string {
  return path.join(GOVERNANCE_CONSOLE_DIR, 'evaluation-log.json');
}

export function enforcementLogPath(): string {
  return path.join(GOVERNANCE_CONSOLE_DIR, 'enforcement-log.json');
}
