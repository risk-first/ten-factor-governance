import fs from 'node:fs';
import { fixturePath } from './paths.js';
import type { Fdc3Portfolio } from '../contexts/types.js';

export type FixturePosition = Fdc3Portfolio['positions'][number] & { sector?: string };

export type FixturePortfolio = Omit<Fdc3Portfolio, 'positions'> & {
  positions: FixturePosition[];
};

export function loadPortfolioFixture(): FixturePortfolio {
  return JSON.parse(fs.readFileSync(fixturePath('portfolio.json'), 'utf-8')) as FixturePortfolio;
}

export function toFdc3Portfolio(p: FixturePortfolio): Fdc3Portfolio {
  return {
    type: 'fdc3.portfolio',
    id: p.id,
    name: p.name,
    positions: p.positions.map(pos => ({
      type: 'fdc3.position',
      instrument: pos.instrument,
      holding: pos.holding,
      weight: pos.weight,
    })),
  };
}
