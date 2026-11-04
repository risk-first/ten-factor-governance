/**
 * Serve the generated App Directory with host rewritten from the request.
 * Disk file keeps localhost; LAN / tunnel callers get their Host hostname
 * so app details.url / icons point at reachable addresses.
 */
import type { Application, Request, Response } from 'express';
import type { Server } from 'http';
import fs from 'node:fs';
import path from 'node:path';

const APPD_URL_PATH = '/static/generated/aipa-fdc3-apps.json';

type AppDirectoryRecord = {
  details?: { url?: string; [key: string]: unknown };
  icons?: Array<{ src?: string; [key: string]: unknown }>;
  screenshots?: Array<{ src?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

type AppDirectoryDoc = {
  applications?: AppDirectoryRecord[];
  message?: string;
  [key: string]: unknown;
};

function requestHostname(req: Request): string {
  const forwarded = req.headers['x-forwarded-host'];
  const raw =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
    (typeof req.headers.host === 'string' ? req.headers.host.trim() : undefined) ||
    'localhost';
  // Strip port — each app keeps its own port in the URL.
  return raw.replace(/:\d+$/, '') || 'localhost';
}

function rewriteLocalhostHostname(url: string, hostname: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return url;
    parsed.hostname = hostname;
    return parsed.toString();
  } catch {
    return url;
  }
}

function rewriteAppDirectory(doc: AppDirectoryDoc, hostname: string): AppDirectoryDoc {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return doc;
  const applications = (doc.applications ?? []).map(app => {
    const next: AppDirectoryRecord = {
      ...app,
      details: app.details ? { ...app.details } : app.details,
    };
    if (next.details?.url) {
      next.details.url = rewriteLocalhostHostname(next.details.url, hostname);
    }
    if (next.icons) {
      next.icons = next.icons.map(icon =>
        icon.src ? { ...icon, src: rewriteLocalhostHostname(icon.src, hostname) } : icon
      );
    }
    if (next.screenshots) {
      next.screenshots = next.screenshots.map(shot =>
        shot.src ? { ...shot, src: rewriteLocalhostHostname(shot.src, hostname) } : shot
      );
    }
    return next;
  });
  return { ...doc, applications };
}

export default function backend(
  app: Application,
  _server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): void {
  const generatedPath = path.join(opts.appRoot, 'static', 'generated', 'aipa-fdc3-apps.json');

  const sendAppd = (req: Request, res: Response) => {
    if (!fs.existsSync(generatedPath)) {
      res.status(404).json({ message: 'App Directory not generated yet', applications: [] });
      return;
    }
    try {
      const doc = JSON.parse(fs.readFileSync(generatedPath, 'utf-8')) as AppDirectoryDoc;
      const hostname = requestHostname(req);
      const body = rewriteAppDirectory(doc, hostname);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store');
      res.type('application/json').send(`${JSON.stringify(body, null, 4)}\n`);
    } catch (err) {
      res.status(500).json({
        message: err instanceof Error ? err.message : 'Failed to read App Directory',
        applications: [],
      });
    }
  };

  app.get(APPD_URL_PATH, sendAppd);
  app.options(APPD_URL_PATH, (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(204);
  });
}
