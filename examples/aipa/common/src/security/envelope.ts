/** Browser-safe signed-context helpers (no node:crypto / no fdc3-security Node bits). */

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

/** Attach FDC3-style app metadata for broadcast/result when we have a signature. */
export function toResultContext(
  envelope: SignedEnvelope | { unsigned: true; context: Record<string, unknown> }
) {
  if ('unsigned' in envelope && envelope.unsigned) {
    return envelope.context;
  }
  const signed = envelope as SignedEnvelope;
  return {
    ...signed.context,
    __appMeta: {
      signature: signed.signature,
      antiReplay: signed.antiReplay,
      jku: signed.jku,
      kid: signed.kid,
    },
  };
}
