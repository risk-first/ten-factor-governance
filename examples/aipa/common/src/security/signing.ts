/**
 * Trusted-backend signing for AIPA apps using `@finos/fdc3-security`.
 *
 * Same pattern as `encrypted-channel-receiver` / `signed-sender`:
 * - `createJosePrivateFDC3Security` holds private keys in Node
 * - `setupWebsocketServer` + `exchangeData('sign-context')` for browser calls
 * - JWKS published at `/.well-known/jwks.json`
 */
import type { Application } from 'express';
import type { Server as HttpServer } from 'node:http';
import type { Context } from '@finos/fdc3-context';
import {
  createJosePrivateFDC3Security,
  DefaultFDC3Handlers,
  JosePrivateFDC3Security,
  provisionJWKS,
  setupWebsocketServer,
} from '@finos/fdc3-security';
import type { WebSocket } from 'ws';
import type { AntiReplay, DetachedSignature, SignedEnvelope } from './envelope.js';

export type { AntiReplay, DetachedSignature, SignedEnvelope } from './envelope.js';
export { toSignedResult } from './envelope.js';

export const SIGN_CONTEXT = 'sign-context';

export type AppSigner = {
  jku: string;
  kid: string;
  security: JosePrivateFDC3Security;
  getPublicJwks: () => { keys: object[] };
  signContext: (context: Record<string, unknown>) => Promise<SignedEnvelope>;
};

const signerCache = new Map<string, AppSigner>();

class SigningBackendHandlers extends DefaultFDC3Handlers {
  constructor(private readonly security: JosePrivateFDC3Security) {
    super();
  }

  async exchangeData(purpose: string, payload: unknown): Promise<unknown> {
    if (purpose === SIGN_CONTEXT) {
      const context = (payload as { context?: Context })?.context;
      if (!context || typeof context !== 'object') {
        throw new Error('sign-context requires { context }');
      }
      return this.security.sign(context);
    }
    return super.exchangeData(purpose, payload);
  }
}

export async function createAppSigner(appId: string, baseUrl: string): Promise<AppSigner> {
  const cached = signerCache.get(appId);
  if (cached) return cached;

  const security = await createJosePrivateFDC3Security(
    baseUrl,
    url => provisionJWKS(url),
    () => true
  );

  const keys = security.getPublicKeys();
  const kid = String((keys[0] as { kid?: string } | undefined)?.kid ?? `${appId}-demo-1`);
  const jku = `${baseUrl}/.well-known/jwks.json`;

  const signer: AppSigner = {
    jku,
    kid,
    security,
    getPublicJwks: () => ({ keys }),
    signContext: async context => {
      const signed = await security.sign(context as Context);
      return {
        context,
        signature: signed.signature as DetachedSignature,
        antiReplay: signed.antiReplay as AntiReplay,
        jku,
        kid,
      };
    },
  };

  signerCache.set(appId, signer);
  return signer;
}

/**
 * Mount JWKS + HTTP sign + `@finos/fdc3-security` WebSocket boundary.
 */
export function mountSigningRoutes(
  app: Application,
  signer: AppSigner,
  server?: HttpServer
): void {
  app.get('/.well-known/jwks.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(signer.getPublicJwks());
  });

  app.post('/api/sign', async (req, res) => {
    try {
      const context = req.body?.context;
      if (!context || typeof context !== 'object') {
        res.status(400).json({ error: 'body.context required' });
        return;
      }
      const envelope = await signer.signContext(context as Record<string, unknown>);
      res.json(envelope);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  if (server) {
    setupWebsocketServer(
      server,
      () => {},
      (_ws: WebSocket) => new SigningBackendHandlers(signer.security)
    );
  }
}
