import { spawn, type ChildProcess } from 'node:child_process';
import express, { type Request } from 'express';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { createServer, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_PORT = 4100;

function resolveWithinRoot(root: string, ...segments: string[]): string {
  const normalizedRoot = fs.realpathSync(root);
  const suffix = segments.join('/');
  const resolvedPath = path.normalize(suffix ? `${normalizedRoot}/${suffix}` : normalizedRoot);
  if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`Resolved path escapes app root: ${resolvedPath}`);
  }
  return resolvedPath;
}

/** When an app has no index.html (e.g. Approvals inbox at list.html), serve that at `/`. */
function rewriteRootToListHtml(appRoot: string): Plugin {
  return {
    name: 'aipa-rewrite-root-to-list',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const pathOnly = req.url?.split('?')[0] ?? '';
        if (pathOnly === '/' || pathOnly === '') {
          const hasIndex = fs.existsSync(path.join(appRoot, 'index.html'));
          const hasList = fs.existsSync(path.join(appRoot, 'list.html'));
          if (!hasIndex && hasList) {
            const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
            req.url = `/list.html${query}`;
          }
        }
        next();
      });
    },
  };
}

function discoverApps(baseDir: string) {
  if (!fs.existsSync(baseDir)) return [];
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter(dirent => {
      const appPath = resolveWithinRoot(baseDir, dirent.name);
      return (
        dirent.isDirectory() &&
        dirent.name !== 'node_modules' &&
        dirent.name !== 'dist' &&
        fs.readdirSync(appPath).some(name => name.endsWith('.html'))
      );
    })
    .map(dirent => ({
      name: dirent.name,
      root: resolveWithinRoot(baseDir, dirent.name),
    }));
}

const packageRoot = __dirname;
const frontEndAppsDir = path.join(packageRoot, 'front-end-apps');
const serverAppsDir = path.join(packageRoot, 'server-apps');
const commonDir = path.join(packageRoot, 'common');
const generatedAppdPath = path.join(packageRoot, 'directory', 'static', 'generated', 'aipa-fdc3-apps.json');

const allApps = [...discoverApps(frontEndAppsDir), ...discoverApps(serverAppsDir)].sort((a, b) =>
  a.name.localeCompare(b.name)
);

const apps = allApps.map((a, index) => {
  let port = BASE_PORT + index;
  const propPath = resolveWithinRoot(a.root, 'properties.json');
  if (fs.existsSync(propPath)) {
    try {
      const props = JSON.parse(fs.readFileSync(propPath, 'utf-8'));
      if (props.port) port = props.port;
    } catch (e) {
      console.error('Failed to read properties.json', { appName: a.name, error: e });
    }
  }
  return { ...a, port };
});

type AppWithPort = { name: string; root: string; port: number };

type AppDirectoryRecord = {
  details?: { url?: string };
  icons?: Array<{ src?: string }>;
  screenshots?: Array<{ src?: string }>;
};

/** Remap localhost URLs to this package's port. Leave other ports (e.g. Fluxnova :8080) alone. */
function rewriteLocalhostUrl(url: string, port: number): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return url;
    if (parsed.port && parsed.port !== String(port)) return url;
    parsed.port = String(port);
    return parsed.toString();
  } catch {
    /* keep original */
  }
  return url;
}

function applyPortToAppDirectoryRecords(applications: AppDirectoryRecord[], port: number): AppDirectoryRecord[] {
  const base = `http://localhost:${port}`;
  return applications.map(app => {
    const next: AppDirectoryRecord = { ...app, details: app.details ? { ...app.details } : {} };
    if (next.details) {
      if (app.details?.url) {
        next.details.url = rewriteLocalhostUrl(app.details.url, port);
      } else {
        next.details.url = `${base}/`;
      }
    }
    if (next.icons) {
      next.icons = next.icons.map(icon => (icon.src ? { ...icon, src: rewriteLocalhostUrl(icon.src, port) } : icon));
    }
    if (next.screenshots) {
      next.screenshots = next.screenshots.map(shot =>
        shot.src ? { ...shot, src: rewriteLocalhostUrl(shot.src, port) } : shot
      );
    }
    return next;
  });
}

function buildCombinedAppDirectory(appsList: AppWithPort[]) {
  const combined = { applications: [] as AppDirectoryRecord[], message: 'OK' };
  for (const a of appsList) {
    const appdPath = resolveWithinRoot(a.root, 'static', 'appd.v2.json');
    if (fs.existsSync(appdPath)) {
      try {
        const content = JSON.parse(fs.readFileSync(appdPath, 'utf-8'));
        if (Array.isArray(content.applications)) {
          combined.applications.push(...applyPortToAppDirectoryRecords(content.applications, a.port));
        }
      } catch (e) {
        console.error('Failed to read appd.v2.json', { appName: a.name, error: e });
      }
    }
  }
  return combined;
}

function writeGeneratedAppDirectory(combined: { applications: unknown[]; message: string }) {
  const dir = path.dirname(generatedAppdPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(generatedAppdPath, `${JSON.stringify(combined, null, 4)}\n`, 'utf-8');
  console.info({ path: generatedAppdPath }, 'Wrote generated app directory');
}

function startSailGovernanceHost() {
  const root = path.join(packageRoot, 'sail-extensions', 'sail-governance');
  const cli = path.join(root, 'node_modules', '@finos', 'sail-extension-server', 'bin', 'sail-extension-server.mjs');
  if (!fs.existsSync(cli)) {
    console.warn('Sail governance host skipped — npm install in sail-extensions/sail-governance');
    return;
  }
  const child: ChildProcess = spawn(process.execPath, [cli, '--port', '9101'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  const stop = () => {
    if (child.exitCode == null && !child.killed) {
      child.kill();
    }
  };
  process.on('exit', stop);
}

async function startApp(appName: string, appRoot: string, port: number) {
  const normalizedAppRoot = fs.realpathSync(appRoot);
  const app = express();
  app.use(express.json({ limit: '32mb' }));

  const backendPath = resolveWithinRoot(normalizedAppRoot, 'src', 'backend.ts');
  const server = http.createServer(app);
  if (fs.existsSync(backendPath)) {
    try {
      const backendUrl = `file://${backendPath}`;
      const { default: backend } = await import(backendUrl);
      if (typeof backend === 'function') {
        const result = backend(app, server, { port, appRoot: normalizedAppRoot, packageRoot });
        if (result != null && typeof (result as Promise<void>).then === 'function') {
          await result;
        }
      }
    } catch (e) {
      console.error({ appName, error: e }, 'Failed to load backend extension');
    }
  }

  const staticPath = resolveWithinRoot(normalizedAppRoot, 'static');
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
  }

  const vite = await createServer({
    root: normalizedAppRoot,
    cacheDir: resolveWithinRoot(normalizedAppRoot, '.vite'),
    server: {
      middlewareMode: true,
      fs: {
        allow: [normalizedAppRoot, commonDir, packageRoot],
      },
      hmr: {
        port: port + 100,
      },
    },
    appType: 'spa',
    plugins: [react(), rewriteRootToListHtml(normalizedAppRoot)],
    resolve: {
      alias: {
        '@aipa/common': path.join(commonDir, 'src'),
      },
    },
  });

  app.use(vite.middlewares);

  const spaIndexLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => req.path.startsWith('/api') || req.path.startsWith('/.well-known'),
  });

  app.get('/{*splat}', spaIndexLimiter, (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/.well-known')) return next();
    const indexPath = resolveWithinRoot(normalizedAppRoot, 'index.html');
    const listPath = resolveWithinRoot(normalizedAppRoot, 'list.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile('index.html', { root: normalizedAppRoot });
    } else if (fs.existsSync(listPath)) {
      res.sendFile('list.html', { root: normalizedAppRoot });
    } else {
      next();
    }
  });

  server.listen(port, () => {
    console.info('Application online', { appName, url: `http://localhost:${port}` });
  });
}

(async () => {
  if (apps.length === 0) {
    console.warn('No apps found to start.');
    return;
  }

  startSailGovernanceHost();

  const combinedAppd = buildCombinedAppDirectory(apps);
  writeGeneratedAppDirectory(combinedAppd);

  for (const a of apps) {
    try {
      await startApp(a.name, a.root, a.port);
    } catch (err) {
      console.error({ appName: a.name, error: err }, 'Failed to start application server');
    }
  }

  const directoryRoot = path.join(packageRoot, 'directory');
  const directoryProps = JSON.parse(fs.readFileSync(path.join(directoryRoot, 'properties.json'), 'utf-8')) as {
    port: number;
  };
  await startApp('directory', directoryRoot, directoryProps.port);

  console.info(`Combined App Directory: http://localhost:${directoryProps.port}/static/generated/aipa-fdc3-apps.json`);
})();
