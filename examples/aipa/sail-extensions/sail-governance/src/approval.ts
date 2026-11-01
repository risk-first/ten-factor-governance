import type { FDC3ServerInstance } from "@finos/sail-headless-agent"

import { INTENTS } from "../../../common/src/contexts/types.ts"
import { APPROVAL_REQUIRED_ERROR, APPROVALS_APP_ID, FLUXNOVA_APP_ID } from "../../../common/src/governance/refs.ts"
import { ensureAppWithListener, postIntentEvent, rejectSubmitOrder } from "./instances.js"
import type { ApprovalAppId, GovernanceSettings } from "./settings.js"

/** Platform-decides: pick any connected GetApproval listener (prefer fluxnova, then approvals). */
async function findAnyGetApprovalListener(
  instance: FDC3ServerInstance,
): Promise<{ appId: string; instanceId: string } | undefined> {
  const preferred = [FLUXNOVA_APP_ID, APPROVALS_APP_ID]
  const listeners = instance
    .getIntentListeners()
    .filter(listener => listener.intentName === INTENTS.GetApproval && listener.instanceId)

  for (const appId of preferred) {
    const match = listeners.find(listener => listener.appId === appId)
    if (match?.instanceId) {
      return { appId: match.appId, instanceId: match.instanceId }
    }
  }
  const first = listeners[0]
  if (first?.appId && first.instanceId) {
    return { appId: first.appId, instanceId: first.instanceId }
  }
  return undefined
}

async function resolveApprovalTarget(
  instance: FDC3ServerInstance,
  approvalAppId: ApprovalAppId,
): Promise<{ appId: string; instanceId: string } | undefined> {
  if (approvalAppId === "none") {
    return findAnyGetApprovalListener(instance)
  }
  const instanceId = await ensureAppWithListener(instance, approvalAppId, INTENTS.GetApproval)
  if (!instanceId) return undefined
  return { appId: approvalAppId, instanceId }
}

export function createApproval(instance: FDC3ServerInstance) {
  /**
   * Post GetApproval to the chosen inbox, then fail the original raise so the
   * caller sees that a human must finish the approval. Do not park getResult().
   */
  async function escalate(
    from: string,
    payload: Record<string, unknown>,
    originalUuid: string,
    actorAppId: string,
    settings: GovernanceSettings,
  ): Promise<void> {
    const target = await resolveApprovalTarget(instance, settings.approvalAppId)
    if (!target) {
      await rejectSubmitOrder(instance, from, originalUuid, "TargetAppUnavailable")
      return
    }

    await postIntentEvent(
      instance,
      target.instanceId,
      INTENTS.GetApproval,
      {
        type: "fdc3.approval",
        id: { requestId: originalUuid },
        status: "pending",
        approver: settings.approver,
        subject: {
          type: "fdc3.action",
          action: "raiseIntent",
          intent: INTENTS.SubmitOrder,
          context: payload.context,
          app: { appId: "aipa-execution" },
        },
      },
      { appId: actorAppId, instanceId: from },
    )

    await rejectSubmitOrder(instance, from, originalUuid, APPROVAL_REQUIRED_ERROR)
  }

  return { escalate }
}

export type Approval = ReturnType<typeof createApproval>
