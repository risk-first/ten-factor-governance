import type { Application } from 'express';
import type { Server } from 'http';
import { getQuote } from '../../../common/src/data/finnhub.js';
import { getDailyOhlc } from '../../../common/src/data/yahooCharts.js';

export default function backend(
  app: Application,
  _server: Server,
  _opts: { port: number; appRoot: string; packageRoot: string }
): void {
  app.get('/api/quote/:symbol', async (req, res) => {
    const symbol = String(req.params.symbol || 'SHEL').toUpperCase();
    res.json(await getQuote(symbol));
  });

  app.get('/api/chart/:symbol', async (req, res) => {
    const symbol = String(req.params.symbol || 'SHEL').toUpperCase();
    const days = Number(req.query.days ?? 60);
    const [quote, chart] = await Promise.all([getQuote(symbol), getDailyOhlc(symbol, days)]);
    res.json({ symbol, quote, chart });
  });
}
