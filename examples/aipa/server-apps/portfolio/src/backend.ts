import type { Application } from 'express';
import type { Server } from 'http';
import { loadLivePortfolio, toFdc3Portfolio } from '../../../common/src/data/portfolio.js';

export default function backend(
  app: Application,
  _server: Server,
  _opts: { port: number; appRoot: string; packageRoot: string }
): void {
  app.get('/api/portfolio', (_req, res) => {
    const live = loadLivePortfolio();
    res.json({
      portfolio: toFdc3Portfolio(live),
      positions: live.positions,
    });
  });
}
