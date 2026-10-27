import type { SailExtensionStorage } from "@finos/sail-extension"
import type { FDC3ServerInstance } from "@finos/sail-headless-agent"

import { buildEnforcementLog, buildEvaluationLog } from "./receipts.js"
import {
  GOVERNANCE_SETTINGS_KEY,
  resolveSettings,
  type GovernanceSettings,
} from "./settings.js"

const SUBMIT_ORDER = "demo.SubmitOrder"
const GET_APPROVAL = "GetApproval"
const LOG_EVALUATION = "LogEvaluation"
const LOG_ENFORCEMENT = "LogEnforcement"
const APPROVALS_APP_ID = "aipa-approvals"
const CONSOLE_APP_ID = "aipa-governance-console"
const APPROVALS_JWKS = "http://localhost:4110/.well-known/jwks.json"

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

async function findAppInstance(
  instance: FDC3ServerInstance,
  appId: string,
): Promise<string | undefined> {
  const apps = await instance.getConnectedApps()
  return apps.find(app => app.appId === appId && app.instanceId)?.instanceId
}

async function waitForIntentListener(
  instance: FDC3ServerInstance,
  appId: string,
  instanceId: string,
  intentName: string,
  timeoutMs = 15_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ready = instance
      .getIntentListeners()
      .some(
        listener =>
          listener.appId === appId &&
          listener.instanceId === instanceId &&
          listener.intentName === intentName,
      )
    if (ready) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

async function ensureAppWithListener(
  instance: FDC3ServerInstance,
  appId: string,
  intentName: string,
  timeoutMs?: number,
): Promise<string | undefined> {
  let instanceId = await findAppInstance(instance, appId)
  if (!instanceId) {
    try {
      instanceId = await instance.open(appId)
    } catch (error) {
      instance.log(
        `[sail-governance] Could not open ${appId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return undefined
    }
  }
  const ready = await waitForIntentListener(instance, appId, instanceId, intentName, timeoutMs)
  if (!ready) {
    instance.log(`[sail-governance] ${appId} never registered ${intentName}`)
    return undefined
  }
  return instanceId
}

async function postIntentEvent(
  instance: FDC3ServerInstance,
  toInstanceId: string,
  intent: string,
  context: Record<string, unknown>,
  source: { appId: string; instanceId: string },
  raiseIntentRequestUuid?: string,
): Promise<void> {
  await instance.post(
    {
      type: "intentEvent",
      payload: {
        context,
        intent,
        metadata: {
          source,
          timestamp: new Date(),
          traceId: instance.createUUID(),
        },
        raiseIntentRequestUuid: raiseIntentRequestUuid ?? instance.createUUID(),
      },
      meta: {
        eventUuid: instance.createUUID(),
        timestamp: new Date(),
      },
    },
    toInstanceId,
  )
}

/**
 * ALLOW still goes through `receive()` so approvals get a normal
 * raiseIntentResponse / getResult. Target the live Execution instance
 * (or open it) first — a singleton already running never fires
 * addIntentListener again, so an appId-only raise would park forever.
 */
async function forwardAllowedSubmitOrder(
  instance: FDC3ServerInstance,
  message: Parameters<FDC3ServerInstance["receive"]>[0],
  from: string,
  payload: Record<string, unknown>,
  intent: string,
): Promise<void> {
  const target = asRecord(payload.app)
  const targetAppId = typeof target?.appId === "string" ? target.appId : "aipa-execution"
  const instanceId =
    typeof target?.instanceId === "string"
      ? target.instanceId
      : await ensureAppWithListener(instance, targetAppId, intent)
  if (!instanceId) {
    return instance.receive(message, from)
  }
  return instance.receive(
    {
      ...message,
      payload: {
        ...payload,
        app: { appId: targetAppId, instanceId },
      },
    } as typeof message,
    from,
  )
}

async function recordDecision(
  instance: FDC3ServerInstance,
  input: {
    requestUuid: string
    actorAppId: string
    actorInstanceId: string
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

  const consoleInstance = await ensureAppWithListener(instance, CONSOLE_APP_ID, LOG_EVALUATION, 2_000)
  if (!consoleInstance) {
    instance.log("[sail-governance] Skipping Gemara log intents — Governance Console unavailable")
    return
  }

  const source = { appId: "sail-governance", instanceId: input.actorInstanceId }
  await postIntentEvent(instance, consoleInstance, LOG_EVALUATION, {
    type: "fdc3.gemara.evaluationLog",
    id: { logId: evaluation.metadata.id },
    name: evaluation.metadata.description,
    log: evaluation,
  }, source)
  await postIntentEvent(instance, consoleInstance, LOG_ENFORCEMENT, {
    type: "fdc3.gemara.enforcementLog",
    id: { logId: enforcement.metadata.id },
    name: enforcement.metadata.description,
    log: enforcement,
  }, source)
}

export function createGovernanceReceive(instance: FDC3ServerInstance, storage: SailExtensionStorage) {
  const parked = new Map<string, string>()

  return async (message: Parameters<FDC3ServerInstance["receive"]>[0], from: string) => {
    const settings = resolveSettings(await storage.get<GovernanceSettings>(GOVERNANCE_SETTINGS_KEY))
    if (settings.mode === "off") {
      return instance.receive(message, from)
    }

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
    if (intent !== SUBMIT_ORDER) {
      return instance.receive(message, from)
    }

    const raiser = instance.getInstanceDetails(from)
    const actorAppId = raiser?.appId ?? from
    const originalUuid = msg.meta?.requestUuid ?? instance.createUUID()
    if (raiser?.appId === APPROVALS_APP_ID || isSignedByApprovals(msg)) {
      void recordDecision(instance, {
        requestUuid: originalUuid,
        actorAppId,
        actorInstanceId: from,
        intent,
        decision: "ALLOW",
        message: `demo.SubmitOrder signed by ${APPROVALS_APP_ID} or raised from that app.`,
      })
      return forwardAllowedSubmitOrder(instance, message, from, payload ?? {}, intent)
    }

    if (!msg.meta?.requestUuid) {
      return instance.receive(message, from)
    }

    void recordDecision(instance, {
      requestUuid: originalUuid,
      actorAppId,
      actorInstanceId: from,
      intent,
      decision: "REQUIRE_APPROVAL",
      message: `Unsigned ${intent} from ${actorAppId} requires human approval.`,
    })

    const getApprovalUuid = instance.createUUID()
    parked.set(getApprovalUuid, originalUuid)

    const approvalsInstance = await ensureAppWithListener(instance, APPROVALS_APP_ID, GET_APPROVAL)
    if (!approvalsInstance) {
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
        app: { appId: "aipa-execution" },
      },
    }

    await postIntentEvent(
      instance,
      approvalsInstance,
      GET_APPROVAL,
      approval,
      { appId: raiser?.appId ?? from, instanceId: from },
      getApprovalUuid,
    )
  }
}
