import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to common/fixtures */
export const FIXTURES_DIR = path.resolve(here, '../../fixtures');

/** Runtime book owned by the portfolio app (gitignored). */
export const LIVE_PORTFOLIO_DIR = path.resolve(here, '../../../server-apps/portfolio/temp');

export function fixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name);
}

export function livePortfolioPath(): string {
  return path.join(LIVE_PORTFOLIO_DIR, 'portfolio.json');
}
