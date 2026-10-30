import type { FDC3ServerInstance } from "@finos/sail-headless-agent"

import { asRecord } from "./dacp.js"

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

export async function ensureAppWithListener(
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

export async function postIntentEvent(
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
export async function forwardAllowedSubmitOrder(
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

export async function denySubmitOrder(
  instance: FDC3ServerInstance,
  from: string,
  originalUuid: string,
): Promise<void> {
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
}
