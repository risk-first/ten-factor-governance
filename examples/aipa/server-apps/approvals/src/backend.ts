import type { Application } from 'express';
import type { Server } from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { createAppSigner, mountSigningRoutes } from '../../../common/src/security/signing.js';
import { loadApprovalsLog, saveApprovalsLog } from '../../../common/src/data/approvals-log.js';
import { loadEntraConfig } from './config.js';
import { JWTValidator } from './jwt-validator.js';

type SessionUser = { email: string; name: string };

export default async function backend(
  app: Application,
  server: Server,
  opts: { port: number; appRoot: string; packageRoot: string }
): Promise<void> {
  dotenv.config({ path: path.join(opts.appRoot, '.env') });
  const entraConfig = loadEntraConfig(opts.appRoot);
  const validator = new JWTValidator(entraConfig);
  const signer = await createAppSigner('aipa-approvals', `http://localhost:${opts.port}`);
  mountSigningRoutes(app, signer, server);

  let user: SessionUser | null = null;

  app.get('/api/config', (_req, res) => {
    res.json(entraConfig);
  });

  app.get('/api/session', (_req, res) => {
    res.json({ user });
  });

  app.post('/api/session', async (req, res) => {
    const jwt = typeof req.body?.wrappedJwt === 'string' ? req.body.wrappedJwt : '';
    const { valid, claims, error } = await validator.validateToken(jwt);
    if (!valid || !claims) {
      res.status(401).json({ error: error ?? 'Invalid Entra token' });
      return;
    }
    user = {
      email: (claims.email as string) || (claims.preferred_username as string) || '',
      name: (claims.name as string) || (claims.given_name as string) || '',
    };
    res.json({ user });
  });

  app.post('/api/logout', (_req, res) => {
    user = null;
    res.json({ user: null });
  });

  app.get('/api/approvals', (_req, res) => {
    res.json(loadApprovalsLog());
  });

  app.put('/api/approvals', (req, res) => {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const log = { entries };
    saveApprovalsLog(log);
    res.json(log);
  });
}
