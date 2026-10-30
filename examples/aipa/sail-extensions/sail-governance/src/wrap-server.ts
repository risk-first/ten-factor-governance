import type { SailExtensionStorage } from "@finos/sail-extension"
import type { FDC3ServerInstance } from "@finos/sail-headless-agent"

import { INTENTS } from "../../../common/src/contexts/types.ts"
import { createApproval } from "./approval.js"
import { asRecord, type DacpMessage } from "./dacp.js"
import { denySubmitOrder, forwardAllowedSubmitOrder } from "./instances.js"
import { createPdp } from "./pdp.js"
import { GOVERNANCE_SETTINGS_KEY, resolveSettings, type GovernanceSettings } from "./settings.js"

export function createGovernanceWrap(instance: FDC3ServerInstance, storage: SailExtensionStorage) {
  const pdp = createPdp(instance)
  const approval = createApproval(instance)

  const post: FDC3ServerInstance["post"] = async (message, to) => {
    if (pdp.consumeResultResponse(message as DacpMessage)) return
    return instance.post(message, to)
  }

  const receive: FDC3ServerInstance["receive"] = async (message, from) => {
    const msg = message as DacpMessage

    if (pdp.consumeIntentResult(msg)) {
      return instance.receive(message, from)
    }

    const settings = resolveSettings(await storage.get<GovernanceSettings>(GOVERNANCE_SETTINGS_KEY))
    if (settings.mode === "off") {
      return instance.receive(message, from)
    }

    const parked = approval.rewriteParkedResult(msg)
    if (parked) {
      return instance.receive(parked as typeof message, from)
    }

    if (msg.type !== "raiseIntentRequest") {
      return instance.receive(message, from)
    }

    const payload = asRecord(msg.payload)
    const intent = typeof payload?.intent === "string" ? payload.intent : ""
    if (intent !== INTENTS.SubmitOrder) {
      return instance.receive(message, from)
    }

    const raiser = instance.getInstanceDetails(from)
    const actorAppId = raiser?.appId ?? from
    const originalUuid = msg.meta?.requestUuid ?? instance.createUUID()
    if (!msg.meta?.requestUuid) {
      return instance.receive(message, from)
    }

    const decision = await pdp.decide(from, originalUuid, actorAppId, payload ?? {}, msg, settings.mode)
    if (decision === "ALLOW") {
      return forwardAllowedSubmitOrder(instance, message, from, payload ?? {}, intent)
    }
    if (decision === "DENY") {
      return denySubmitOrder(instance, from, originalUuid)
    }
    return approval.escalate(from, payload ?? {}, originalUuid, actorAppId, settings)
  }

  return { receive, post }
}
