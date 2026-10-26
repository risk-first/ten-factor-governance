import type { FDC3ServerInstance } from "@finos/sail-headless-agent"

import { appendReceipts } from "./log-store.js"
import { buildEnforcementLog, buildEvaluationLog } from "./receipts.js"

const SUBMIT_ORDER = "demo.SubmitOrder"
const GET_APPROVAL = "GetApproval"
const APPROVALS_APP_ID = "aipa-approvals"
const APPROVALS_JWKS = "http://localhost:4110/.well-known/jwks.json"

const APPROVAL_INTENTS = new Set([
  "GetApproval",
  "UpdateApproval",
  "CancelApproval",
  "ViewApproval",
  "ReviewApproval",
])

type DacpMessage = {
  type?: string
  meta?: { requestUuid?: string; timestamp?: Date | string }
  payload?: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
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

function jkuFromSignature(signature: unknown): string | undefined {
  const protectedB64 = asRecord(signature)?.protected
  if (typeof protectedB64 !== "string") {
    return undefined
  }
  const jku = decodeProtectedHeader(protectedB64)?.jku
  return typeof jku === "string" ? jku : undefined
}

function isSignedByApprovals(message: DacpMessage): boolean {
  const payload = asRecord(message.payload)
  const metadata = asRecord(payload?.metadata)
  return jkuFromSignature(metadata?.signature) === APPROVALS_JWKS
}

async function findApprovalsInstance(instance: FDC3ServerInstance): Promise<string | undefined> {
  const apps = await instance.getConnectedApps()
  return apps.find(app => app.appId === APPROVALS_APP_ID && app.instanceId)?.instanceId
}

async function waitForGetApprovalListener(
  instance: FDC3ServerInstance,
  instanceId: string,
  timeoutMs = 15_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ready = instance
      .getIntentListeners()
      .some(
        listener =>
          listener.appId === APPROVALS_APP_ID &&
          listener.instanceId === instanceId &&
          listener.intentName === GET_APPROVAL,
      )
    if (ready) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

async function recordDecision(input: {
    requestUuid: string
    actorAppId: string
    intent: string
    decision: "ALLOW" | "REQUIRE_APPROVAL"
    message: string
  },
): Promise<void> {
  const evaluation = buildEvaluationLog({
    id: input.requestUuid,
    actorAppId: input.actorAppId,
    intent: input.intent,
    decision: input.decision,
    message: input.message,
  })
  const enforcement = buildEnforcementLog({
    id: input.requestUuid,
    actorAppId: input.actorAppId,
    intent: input.intent,
    decision: input.decision,
    evaluationId: evaluation.metadata.id,
  })
  appendReceipts(evaluation, enforcement)
}

export function createGovernanceReceive(instance: FDC3ServerInstance) {
  const parked = new Map<string, string>()

  return async (message: Parameters<FDC3ServerInstance["receive"]>[0], from: string) => {
    const msg = message as DacpMessage

    if (msg.type === "intentResultRequest") {
      const approvalUuid = asRecord(msg.payload)?.raiseIntentRequestUuid
      const originalUuid = typeof approvalUuid === "string" ? parked.get(approvalUuid) : undefined
      if (originalUuid && typeof approvalUuid === "string") {
        parked.delete(approvalUuid)
        const rewritten = {
          ...msg,
          payload: { ...asRecord(msg.payload), raiseIntentRequestUuid: originalUuid },
        }
        return instance.receive(rewritten as typeof message, from)
      }
    }

    if (msg.type !== "raiseIntentRequest") {
      return instance.receive(message, from)
    }

    const payload = asRecord(msg.payload)
    const intent = typeof payload?.intent === "string" ? payload.intent : ""
    if (APPROVAL_INTENTS.has(intent) || intent !== SUBMIT_ORDER) {
      return instance.receive(message, from)
    }

    const raiser = instance.getInstanceDetails(from)
    const actorAppId = raiser?.appId ?? from
    const originalUuid = msg.meta?.requestUuid ?? instance.createUUID()
    if (raiser?.appId === APPROVALS_APP_ID || isSignedByApprovals(msg)) {
      await recordDecision({
        requestUuid: originalUuid,
        actorAppId,
        intent,
        decision: "ALLOW",
        message: `demo.SubmitOrder signed by ${APPROVALS_APP_ID} or raised from that app.`,
      })
      return instance.receive(message, from)
    }

    if (!msg.meta?.requestUuid) {
      return instance.receive(message, from)
    }

    await recordDecision({
      requestUuid: originalUuid,
      actorAppId,
      intent,
      decision: "REQUIRE_APPROVAL",
      message: `Unsigned ${intent} from ${actorAppId} requires human approval.`,
    })

    const getApprovalUuid = instance.createUUID()
    parked.set(getApprovalUuid, originalUuid)

    let approvalsInstance = await findApprovalsInstance(instance)
    if (!approvalsInstance) {
      try {
        approvalsInstance = await instance.open(APPROVALS_APP_ID)
      } catch (error) {
        instance.log(
          `[sail-governance] Could not open ${APPROVALS_APP_ID}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
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
        parked.delete(getApprovalUuid)
        return
      }
    }

    const listenerReady = await waitForGetApprovalListener(instance, approvalsInstance)
    if (!listenerReady) {
      instance.log(`[sail-governance] ${APPROVALS_APP_ID} never registered ${GET_APPROVAL}`)
      await instance.post(
        {
          meta: {
            responseUuid: instance.createUUID(),
            requestUuid: originalUuid,
            timestamp: new Date(),
          },
          type: "raiseIntentResponse",
          payload: { error: "IntentDeliveryFailed" },
        },
        from,
      )
      parked.delete(getApprovalUuid)
      return
    }

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
            intent: SUBMIT_ORDER,
            source: { appId: APPROVALS_APP_ID, instanceId: approvalsInstance },
          },
        },
      },
      from,
    )

    const target = asRecord(payload?.app)
    const context = payload?.context
    const approval = {
      type: "fdc3.approval",
      id: { requestId: originalUuid },
      status: "pending",
      subject: {
        type: "fdc3.action",
        action: "raiseIntent",
        intent: SUBMIT_ORDER,
        context,
        app: target?.appId ? { appId: target.appId } : { appId: "aipa-execution" },
      },
    }

    await instance.post(
      {
        type: "intentEvent",
        payload: {
          context: approval,
          intent: GET_APPROVAL,
          metadata: {
            source: { appId: raiser?.appId ?? from, instanceId: from },
            timestamp: new Date(),
            traceId: instance.createUUID(),
          },
          raiseIntentRequestUuid: getApprovalUuid,
        },
        meta: {
          eventUuid: instance.createUUID(),
          timestamp: new Date(),
        },
      },
      approvalsInstance,
    )
  }
}
