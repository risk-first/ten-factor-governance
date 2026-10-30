export type DacpMessage = {
  type?: string
  meta?: { requestUuid?: string; timestamp?: Date | string }
  payload?: Record<string, unknown>
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function decodeProtectedHeader(protectedB64: string): Record<string, unknown> | undefined {
  try {
    const normalized = protectedB64.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    const json = JSON.parse(atob(padded)) as unknown
    return asRecord(json)
  } catch {
    return undefined
  }
}

export function jkuFromSignature(signature: unknown): string | undefined {
  const protectedB64 = asRecord(signature)?.protected
  if (typeof protectedB64 !== "string") {
    return undefined
  }
  const jku = decodeProtectedHeader(protectedB64)?.jku
  return typeof jku === "string" ? jku : undefined
}

export function jkuFromDacp(message: DacpMessage): string | undefined {
  const metadata = asRecord(asRecord(message.payload)?.metadata)
  return jkuFromSignature(metadata?.signature)
}

export function contextFromIntentResult(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const intentResult = asRecord(payload?.intentResult)
  const nested = asRecord(intentResult?.context)
  if (nested) return nested
  if (intentResult && typeof intentResult.type === "string") return intentResult
  return undefined
}
