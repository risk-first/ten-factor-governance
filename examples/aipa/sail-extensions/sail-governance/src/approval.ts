import type { FDC3ServerInstance } from "@finos/sail-headless-agent"

import { INTENTS } from "../../../common/src/contexts/types.ts"
import { APPROVALS_APP_ID, FLUXNOVA_APP_ID } from "../../../common/src/governance/refs.ts"
import { asRecord, type DacpMessage } from "./dacp.js"
import { ensureAppWithListener, postIntentEvent } from "./instances.js"
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
  const parkedApprovals = new Map<string, string>()

  /**
   * Remap a later `intentResultRequest` for the GetApproval uuid back to the
   * original raiser's parked `getResult()`.
   */
  function rewriteParkedResult(message: DacpMessage): DacpMessage | undefined {
    if (message.type !== "intentResultRequest") return undefined
    const approvalUuid = asRecord(message.payload)?.raiseIntentRequestUuid
    const originalUuid = typeof approvalUuid === "string" ? parkedApprovals.get(approvalUuid) : undefined
    if (!originalUuid || typeof approvalUuid !== "string") return undefined
    parkedApprovals.delete(approvalUuid)
    return {
      ...message,
      payload: { ...asRecord(message.payload), raiseIntentRequestUuid: originalUuid },
    }
  }

  async function escalate(
    from: string,
    payload: Record<string, unknown>,
    originalUuid: string,
    actorAppId: string,
    settings: GovernanceSettings,
  ): Promise<void> {
    const getApprovalUuid = instance.createUUID()
    parkedApprovals.set(getApprovalUuid, originalUuid)

    const target = await resolveApprovalTarget(instance, settings.approvalAppId)
    if (!target) {
      await instance.post(
        {
          meta: {
            responseUuid: instance.createUUID(),
            requestUuid: originalUuid,
            timestamp: new Date(),
          },
          type: "raiseIntentResponse",
          payload: { error: "TargetAppUnavailable" },
        },
        from,
      )
      parkedApprovals.delete(getApprovalUuid)
      return
    }

    const raiser = instance.getInstanceDetails(from)
    instance.addPendingResolution(originalUuid, {
      appId: raiser?.appId ?? from,
      instanceId: from,
    })

    await instance.post(
      {
        meta: {
          responseUuid: instance.createUUID(),
          requestUuid: originalUuid,
          timestamp: new Date(),
        },
        type: "raiseIntentResponse",
        payload: {
          intentResolution: {
            intent: INTENTS.SubmitOrder,
            source: { appId: target.appId, instanceId: target.instanceId },
          },
        },
      },
      from,
    )

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
      getApprovalUuid,
    )
  }

  return { rewriteParkedResult, escalate }
}

export type Approval = ReturnType<typeof createApproval>
