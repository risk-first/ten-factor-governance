import type { Application } from 'express';
import type { Server } from 'http';
import { loadPortfolioFixture, toFdc3Portfolio } from '../../../common/src/data/portfolio.js';

export default function backend(
  app: Application,
  _server: Server,
  _opts: { port: number; appRoot: string; packageRoot: string }
): void {
  app.get('/api/portfolio', (_req, res) => {
    const fixture = loadPortfolioFixture();
    res.json({
      portfolio: toFdc3Portfolio(fixture),
      positions: fixture.positions,
    });
  });
}
