import type { FDC3ServerInstance } from "@finos/sail-headless-agent"

import { INTENTS } from "../../../common/src/contexts/types.ts"
import { buildSkeletonLog } from "../../../common/src/governance/evaluation.ts"
import {
  DIRECT_APP_ID,
  JEV_APP_ID,
  evalResultToEnforcement,
  type EnforcementDecision,
} from "../../../common/src/governance/refs.ts"
import { asRecord, contextFromIntentResult, jkuFromDacp, type DacpMessage } from "./dacp.js"
import { ensureAppWithListener, postIntentEvent } from "./instances.js"
import type { GovernanceMode } from "./settings.js"

/** Clef local inference can take ~30s; leave a small buffer for /decide. */
const DECISION_TIMEOUT_MS = 35_000

function pdpAppId(mode: GovernanceMode): string | undefined {
  if (mode === "direct") return DIRECT_APP_ID
  if (mode === "jev") return JEV_APP_ID
  return undefined
}

function decisionFromLog(log: Record<string, unknown> | undefined): EnforcementDecision {
  const result = log?.result
  return evalResultToEnforcement(
    result === "Passed" || result === "Failed" || result === "Needs Review" ? result : undefined,
  )
}

export function createPdp(instance: FDC3ServerInstance) {
  const pendingDecisions = new Map<string, (ctx: Record<string, unknown> | undefined) => void>()
  const swallowedResults = new Set<string>()

  function waitForDecision(
    uuid: string,
    timeoutMs: number,
  ): Promise<Record<string, unknown> | undefined> {
    swallowedResults.add(uuid)
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        pendingDecisions.delete(uuid)
        resolve(undefined)
      }, timeoutMs)
      pendingDecisions.set(uuid, ctx => {
        clearTimeout(timer)
        resolve(ctx)
      })
    })
  }

  function settle(uuid: string, ctx: Record<string, unknown> | undefined): boolean {
    if (!swallowedResults.has(uuid)) return false
    const done = pendingDecisions.get(uuid)
    pendingDecisions.delete(uuid)
    done?.(ctx)
    return true
  }

  /** Swallow the PDP's `raiseIntentResultResponse` so it never reaches the original raiser. */
  function consumeResultResponse(message: DacpMessage): boolean {
    if (message.type !== "raiseIntentResultResponse") return false
    const uuid = message.meta?.requestUuid
    if (typeof uuid !== "string") return false
    return settle(uuid, contextFromIntentResult(asRecord(message.payload)))
  }

  /** Capture the PDP IntentResult from `intentResultRequest` (primary path). */
  function consumeIntentResult(message: DacpMessage): boolean {
    if (message.type !== "intentResultRequest") return false
    const uuid = asRecord(message.payload)?.raiseIntentRequestUuid
    if (typeof uuid !== "string") return false
    return settle(uuid, contextFromIntentResult(asRecord(message.payload)))
  }

  async function ask(
    from: string,
    originalUuid: string,
    actorAppId: string,
    payload: Record<string, unknown>,
    message: DacpMessage,
    appId: string,
  ): Promise<{ log: Record<string, unknown> | undefined; failSafe: boolean }> {
    const pdpInstance = await ensureAppWithListener(instance, appId, INTENTS.GetGovernanceDecision)
    const skeleton = buildSkeletonLog({
      id: originalUuid,
      actorAppId,
      intent: INTENTS.SubmitOrder,
    })
    if (!pdpInstance) {
      return { log: undefined, failSafe: true }
    }

    const decisionUuid = instance.createUUID()
    const wait = waitForDecision(decisionUuid, DECISION_TIMEOUT_MS)
    const target = asRecord(payload.app)
    await postIntentEvent(
      instance,
      pdpInstance,
      INTENTS.GetGovernanceDecision,
      {
        type: "demo.governanceDecision",
        id: { requestId: originalUuid },
        signatureJku: jkuFromDacp(message),
        subject: {
          type: "fdc3.action",
          action: "raiseIntent",
          intent: INTENTS.SubmitOrder,
          context: payload.context,
          app: {
            appId: typeof target?.appId === "string" ? target.appId : "aipa-execution",
            ...(typeof target?.instanceId === "string" ? { instanceId: target.instanceId } : {}),
          },
        },
        log: skeleton,
      },
      { appId: actorAppId, instanceId: from },
      decisionUuid,
    )
    const resultCtx = await wait
    const rec = asRecord(resultCtx)
    const log = rec?.type === "demo.governanceDecision" ? asRecord(rec.log) : rec
    if (!log || (log.result !== "Passed" && log.result !== "Needs Review" && log.result !== "Failed")) {
      return { log: undefined, failSafe: true }
    }
    return { log, failSafe: false }
  }

  async function decide(
    from: string,
    originalUuid: string,
    actorAppId: string,
    payload: Record<string, unknown>,
    message: DacpMessage,
    mode: GovernanceMode,
  ): Promise<EnforcementDecision> {
    const appId = pdpAppId(mode)
    if (!appId) return "REQUIRE_APPROVAL"
    const asked = await ask(from, originalUuid, actorAppId, payload, message, appId)
    return asked.failSafe ? "REQUIRE_APPROVAL" : decisionFromLog(asked.log)
  }

  return { consumeResultResponse, consumeIntentResult, decide }
}

export type Pdp = ReturnType<typeof createPdp>
