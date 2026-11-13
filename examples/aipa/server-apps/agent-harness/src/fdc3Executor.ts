/**
 * Browser-side executor for deferred fdc3_* tools.
 */
import type { AppMetadata, Channel, Context, DesktopAgent } from '@finos/fdc3';
import {
  CONTEXT_TYPES,
  INTENTS,
  type CapabilityRequest,
} from '../../../common/src/contexts/types.ts';
import { isApprovalRequiredError, submitOrderErrorMessage } from '../../../common/src/governance/refs.ts';
import { summarizeDiscoverApps } from './agent/discover-summary.ts';

export type ContextCache = Map<string, Context>;

/** Per-intent round-robin cursor for multi-app GetCapabilities (and similar). */
const roundRobinByIntent = new Map<string, number>();

function pickRoundRobin(intent: string, apps: AppMetadata[]): AppMetadata {
  if (!apps.length) throw new Error(`No apps for ${intent}`);
  const next = roundRobinByIntent.get(intent) ?? 0;
  const target = apps[next % apps.length]!;
  roundRobinByIntent.set(intent, next + 1);
  return target;
}

async function getCapabilities(
  fdc3: DesktopAgent,
  request: CapabilityRequest
): Promise<Context> {
  const intent = INTENTS.GetCapabilities;
  const appIntent = await fdc3.findIntent(intent, request as Context);
  const apps = appIntent.apps ?? [];
  if (!apps.length) {
    throw new Error(`No apps handle ${intent} for capability=${request.capability}`);
  }
  const target = pickRoundRobin(intent, apps);
  const appTarget = target.instanceId
    ? { appId: target.appId, instanceId: target.instanceId }
    : { appId: target.appId };
  const resolution = await fdc3.raiseIntent(intent, request as Context, appTarget);
  const result = await resolution.getResult();
  if (!result || typeof result !== 'object' || typeof (result as Context).type !== 'string') {
    throw new Error(`${intent} did not return a context for capability=${request.capability}`);
  }
  if (result && typeof result === 'object' && 'broadcast' in result && 'id' in result) {
    throw new Error(`${intent} returned a channel; expected a catalog context`);
  }
  return result as Context;
}

function asAppId(raw: unknown): { appId: string; instanceId?: string } {
  const o = (raw ?? {}) as { appId?: string; instanceId?: string };
  if (!o.appId) throw new Error('app.appId required');
  return { appId: o.appId, instanceId: o.instanceId };
}

function asContext(raw: unknown): Context {
  const o = raw as Context | null | undefined;
  if (!o || typeof o !== 'object' || typeof o.type !== 'string') {
    throw new Error('context with type string required');
  }
  return o;
}

async function serializeIntentResult(
  resolution: Awaited<ReturnType<DesktopAgent['raiseIntent']>>
): Promise<unknown> {
  const source = resolution.source;
  try {
    const result = await resolution.getResult();
    if (result && typeof result === 'object' && 'broadcast' in result && 'id' in result) {
      const ch = result as Channel;
      return {
        kind: 'channel',
        channelId: ch.id,
        channelType: (ch as { type?: string }).type,
        source,
      };
    }
    return { kind: 'context', context: result ?? null, source };
  } catch (e) {
    return { ...serializeRaiseError(e), source };
  }
}

function serializeRaiseError(error: unknown): { kind: 'error'; message: string } {
  return {
    kind: 'error',
    message: isApprovalRequiredError(error)
      ? submitOrderErrorMessage(error)
      : error instanceof Error
        ? error.message
        : String(error),
  };
}

export async function executeFdc3Tool(
  fdc3: DesktopAgent,
  toolName: string,
  args: Record<string, unknown>,
  opts: {
    contextCache: ContextCache;
    channelCache: Map<string, Channel>;
  }
): Promise<unknown> {
  const { contextCache, channelCache } = opts;

  switch (toolName) {
    case 'fdc3_get_info':
      return fdc3.getInfo();

    case 'fdc3_get_app_metadata':
      return fdc3.getAppMetadata(asAppId(args.app));

    case 'fdc3_find_intent':
      return fdc3.findIntent(
        String(args.intent),
        args.context ? asContext(args.context) : undefined,
        typeof args.resultType === 'string' ? args.resultType : undefined
      );

    case 'fdc3_find_intents_by_context':
      return fdc3.findIntentsByContext(
        asContext(args.context),
        typeof args.resultType === 'string' ? args.resultType : undefined
      );

    case 'fdc3_find_instances':
      return fdc3.findInstances(asAppId(args.app));

    case 'fdc3_raise_intent': {
      try {
        const resolution = await fdc3.raiseIntent(
          String(args.intent),
          args.context == null ? null : asContext(args.context),
          args.target == null ? null : asAppId(args.target),
          typeof args.newInstance === 'boolean' ? args.newInstance : undefined
        );
        return serializeIntentResult(resolution);
      } catch (error) {
        return serializeRaiseError(error);
      }
    }

    case 'fdc3_raise_intent_for_context': {
      try {
        const resolution = await fdc3.raiseIntentForContext(
          asContext(args.context),
          args.target == null ? null : asAppId(args.target),
          typeof args.newInstance === 'boolean' ? args.newInstance : undefined
        );
        return serializeIntentResult(resolution);
      } catch (error) {
        return serializeRaiseError(error);
      }
    }

    case 'fdc3_open':
      return fdc3.open(asAppId(args.app), args.context == null ? undefined : asContext(args.context));

    case 'fdc3_broadcast':
      await fdc3.broadcast(asContext(args.context));
      return { ok: true };

    case 'fdc3_get_user_channels': {
      const channels = await fdc3.getUserChannels();
      return channels.map(c => ({ id: c.id, type: c.type, displayMetadata: c.displayMetadata }));
    }

    case 'fdc3_join_user_channel':
      await fdc3.joinUserChannel(String(args.channelId));
      return { ok: true, channelId: args.channelId };

    case 'fdc3_leave_current_channel':
      await fdc3.leaveCurrentChannel();
      return { ok: true };

    case 'fdc3_get_current_channel': {
      const ch = await fdc3.getCurrentChannel();
      return ch ? { id: ch.id, type: ch.type, displayMetadata: ch.displayMetadata } : null;
    }

    case 'fdc3_get_or_create_channel': {
      const ch = await fdc3.getOrCreateChannel(String(args.channelId));
      channelCache.set(ch.id, ch);
      return { id: ch.id, type: ch.type };
    }

    case 'fdc3_channel_broadcast': {
      const id = String(args.channelId);
      let ch = channelCache.get(id);
      if (!ch) {
        ch = await fdc3.getOrCreateChannel(id);
        channelCache.set(id, ch);
      }
      await ch.broadcast(asContext(args.context));
      return { ok: true };
    }

    case 'fdc3_channel_get_current_context': {
      const id = String(args.channelId);
      let ch = channelCache.get(id);
      if (!ch) {
        ch = await fdc3.getOrCreateChannel(id);
        channelCache.set(id, ch);
      }
      return ch.getCurrentContext(
        typeof args.contextType === 'string' ? args.contextType : undefined
      );
    }

    case 'fdc3_get_current_channel_context': {
      const filter = typeof args.contextType === 'string' ? args.contextType : undefined;
      const out: Record<string, Context> = {};
      for (const [type, ctx] of contextCache) {
        if (!filter || type === filter) out[type] = ctx;
      }
      return out;
    }

    case 'fdc3_discover_apps': {
      const reply = await getCapabilities(fdc3, {
        type: CONTEXT_TYPES.capabilityRequest,
        capability: 'apps',
      });
      // Full AppD stays on the wire; LLM gets a compact catalog.
      return summarizeDiscoverApps(reply);
    }

    case 'fdc3_discover_intents':
      return getCapabilities(fdc3, {
        type: CONTEXT_TYPES.capabilityRequest,
        capability: 'intents',
      });

    case 'fdc3_discover_context_types':
      return getCapabilities(fdc3, {
        type: CONTEXT_TYPES.capabilityRequest,
        capability: 'contextTypes',
      });

    case 'fdc3_discover_context_schema': {
      const contextType = String(args.contextType ?? '').trim();
      if (!contextType) throw new Error('contextType required');
      return getCapabilities(fdc3, {
        type: CONTEXT_TYPES.capabilityRequest,
        capability: 'contextSchema',
        contextType,
      });
    }

    case 'fdc3_discover_app_directory_record': {
      const appId = String(args.appId ?? '').trim();
      if (!appId) throw new Error('appId required');
      return getCapabilities(fdc3, {
        type: CONTEXT_TYPES.capabilityRequest,
        capability: 'appDirectoryRecord',
        appId,
      });
    }

    default:
      throw new Error(`Unknown FDC3 tool: ${toolName}`);
  }
}
