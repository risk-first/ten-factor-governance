/**
 * Serve discovery catalogs derived from the generated AIPA App Directory.
 */
import type { Express } from 'express';
import type { Server } from 'http';
import fs from 'fs';
import path from 'path';
import { buildCatalog, type AppDirectoryApplication } from './catalog.ts';

type BackendOpts = { port: number; appRoot: string; packageRoot: string };

export default function backend(app: Express, _server: Server, opts: BackendOpts): void {
  const appdPath = path.join(
    opts.packageRoot,
    'directory',
    'static',
    'generated',
    'aipa-fdc3-apps.json'
  );

  app.get('/api/catalog', (_req, res) => {
    try {
      if (!fs.existsSync(appdPath)) {
        res.status(503).json({ error: 'App Directory not generated yet; restart aipa:dev' });
        return;
      }
      const raw = JSON.parse(fs.readFileSync(appdPath, 'utf-8')) as {
        applications?: AppDirectoryApplication[];
      };
      const catalog = buildCatalog(Array.isArray(raw.applications) ? raw.applications : []);
      res.json(catalog);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });
}
