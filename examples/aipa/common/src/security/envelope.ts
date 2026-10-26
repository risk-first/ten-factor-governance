/** Browser-safe signed-context helpers (no node:crypto / no fdc3-security Node bits). */

import type { Context, ContextWithMetadata } from '@finos/fdc3';

/** Detached JWS shape from FDC3 Security / `@finos/fdc3-standard`. */
export type DetachedSignature = {
  protected: string;
  signature: string;
};

export type AntiReplay = { iat: number; exp: number; jti: string };

export type SignedEnvelope = {
  context: Record<string, unknown>;
  signature: DetachedSignature;
  antiReplay: AntiReplay;
  jku: string;
  kid: string;
};

/** Intent result: clean context plus FDC3 3.0 ContextMetadata signature fields. */
export function toSignedResult(envelope: SignedEnvelope): ContextWithMetadata {
  return {
    context: envelope.context as Context,
    metadata: {
      signature: envelope.signature,
      antiReplay: envelope.antiReplay,
    },
  } as ContextWithMetadata;
}
