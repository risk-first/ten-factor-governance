import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to common/fixtures */
export const FIXTURES_DIR = path.resolve(here, '../../fixtures');

export function fixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name);
}
