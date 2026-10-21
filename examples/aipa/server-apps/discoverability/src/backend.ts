/**
 * Serve discovery catalogs and context JSON Schema lookup from fdc3-extensions.
 */
import type { Express } from 'express';
import type { Server } from 'http';
import fs from 'fs';
import path from 'path';
import { CONTEXT_TYPES } from '../../../common/src/contexts/types.ts';
import {
  buildCatalog,
  findApplicationById,
  type AppDirectoryApplication,
} from './catalog.ts';
import {
  indexedContextTypeMeta,
  knownSchemaContextTypes,
  resolveContextSchema,
} from './schemaLookup.ts';

type BackendOpts = { port: number; appRoot: string; packageRoot: string };

function loadApplications(appdPath: string): AppDirectoryApplication[] {
  if (!fs.existsSync(appdPath)) {
    throw new Error('App Directory not generated yet; restart aipa:dev');
  }
  const raw = JSON.parse(fs.readFileSync(appdPath, 'utf-8')) as {
    applications?: AppDirectoryApplication[];
  };
  return Array.isArray(raw.applications) ? raw.applications : [];
}

export default function backend(app: Express, _server: Server, opts: BackendOpts): void {
  const appdPath = path.join(
    opts.packageRoot,
    'directory',
    'static',
    'generated',
    'aipa-fdc3-apps.json'
  );
  const extensionsRoot = path.join(opts.packageRoot, 'fdc3-extensions');

  app.get('/api/catalog', (_req, res) => {
    try {
      const catalog = buildCatalog(loadApplications(appdPath), indexedContextTypeMeta(extensionsRoot));
      res.json(catalog);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(msg.includes('not generated') ? 503 : 500).json({ error: msg });
    }
  });

  app.get('/api/context-schema-types', (_req, res) => {
    try {
      res.json({ contextTypes: knownSchemaContextTypes(extensionsRoot) });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get('/api/context-schema', async (req, res) => {
    try {
      const contextType =
        typeof req.query.contextType === 'string' ? req.query.contextType : '';
      const resolved = await resolveContextSchema(contextType, extensionsRoot);
      res.json({
        type: CONTEXT_TYPES.contextSchema,
        ...resolved,
      });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get('/api/app-directory-record', (req, res) => {
    try {
      const appId = typeof req.query.appId === 'string' ? req.query.appId : '';
      const trimmed = appId.trim();
      if (!trimmed) {
        res.json({
          type: CONTEXT_TYPES.appDirectoryRecord,
          appId: '',
          error: 'appId is required',
        });
        return;
      }
      const record = findApplicationById(loadApplications(appdPath), trimmed);
      if (!record) {
        res.json({
          type: CONTEXT_TYPES.appDirectoryRecord,
          appId: trimmed,
          error: `No App Directory record for appId ${trimmed}`,
        });
        return;
      }
      res.json({
        type: CONTEXT_TYPES.appDirectoryRecord,
        appId: trimmed,
        record,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(msg.includes('not generated') ? 503 : 500).json({ error: msg });
    }
  });
}
