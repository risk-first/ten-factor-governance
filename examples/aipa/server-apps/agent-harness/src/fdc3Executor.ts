/**
 * Browser-side executor for deferred fdc3_* tools.
 */
import type { Channel, Context, DesktopAgent, Listener } from '@finos/fdc3';
import {
  CONTEXT_TYPES,
  DISCOVERABILITY_CHANNEL,
} from '../../../common/src/contexts/types.ts';
import { summarizeDiscoverApps } from './agent/discover-summary.ts';

export type ContextCache = Map<string, Context>;

const DEFAULT_DISCOVER_TIMEOUT_MS = 8000;

async function discoverabilityRequest(
  fdc3: DesktopAgent,
  channelCache: Map<string, Channel>,
  opts: {
    requestType: string;
    replyType: string;
    timeoutMs?: number;
    /** Extra fields on the request context (e.g. contextType). */
    request?: Record<string, unknown>;
    /** Accept only matching replies (e.g. same contextType). */
    matchReply?: (ctx: Context) => boolean;
  }
): Promise<Context> {
  const timeoutMs =
    typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0
      ? opts.timeoutMs
      : DEFAULT_DISCOVER_TIMEOUT_MS;

  let ch = channelCache.get(DISCOVERABILITY_CHANNEL);
  if (!ch) {
    ch = await fdc3.getOrCreateChannel(DISCOVERABILITY_CHANNEL);
    channelCache.set(ch.id, ch);
    channelCache.set(DISCOVERABILITY_CHANNEL, ch);
  }

  const hold: { listener: Listener | null; timer?: ReturnType<typeof setTimeout> } = {
    listener: null,
  };
  try {
    const replyPromise = new Promise<Context>((resolve, reject) => {
      hold.timer = setTimeout(() => {
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for ${opts.replyType} on ${DISCOVERABILITY_CHANNEL}`
          )
        );
      }, timeoutMs);
      void ch!
        .addContextListener(opts.replyType, (ctx: Context) => {
          if (opts.matchReply && !opts.matchReply(ctx)) return;
          if (hold.timer) clearTimeout(hold.timer);
          resolve(ctx);
        })
        .then(async l => {
          hold.listener = l;
          await ch!.broadcast({ type: opts.requestType, ...(opts.request ?? {}) } as Context);
        })
        .catch(err => {
          if (hold.timer) clearTimeout(hold.timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
    return await replyPromise;
  } finally {
    if (hold.timer) clearTimeout(hold.timer);
    void hold.listener?.unsubscribe();
  }
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
    return {
      kind: 'error',
      source,
      message: e instanceof Error ? e.message : String(e),
    };
  }
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
      const resolution = await fdc3.raiseIntent(
        String(args.intent),
        args.context == null ? null : asContext(args.context),
        args.target == null ? null : asAppId(args.target),
        typeof args.newInstance === 'boolean' ? args.newInstance : undefined
      );
      return serializeIntentResult(resolution);
    }

    case 'fdc3_raise_intent_for_context': {
      const resolution = await fdc3.raiseIntentForContext(
        asContext(args.context),
        args.target == null ? null : asAppId(args.target),
        typeof args.newInstance === 'boolean' ? args.newInstance : undefined
      );
      return serializeIntentResult(resolution);
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
      const reply = await discoverabilityRequest(fdc3, channelCache, {
        requestType: CONTEXT_TYPES.discoverApps,
        replyType: CONTEXT_TYPES.appDirectory,
        timeoutMs: typeof args.timeoutMs === 'number' ? args.timeoutMs : undefined,
      });
      // Full AppD stays on the wire; LLM gets a compact catalog.
      return summarizeDiscoverApps(reply);
    }

    case 'fdc3_discover_intents':
      return discoverabilityRequest(fdc3, channelCache, {
        requestType: CONTEXT_TYPES.discoverIntents,
        replyType: CONTEXT_TYPES.intentList,
        timeoutMs: typeof args.timeoutMs === 'number' ? args.timeoutMs : undefined,
      });

    case 'fdc3_discover_context_types':
      return discoverabilityRequest(fdc3, channelCache, {
        requestType: CONTEXT_TYPES.discoverContextTypes,
        replyType: CONTEXT_TYPES.contextTypeList,
        timeoutMs: typeof args.timeoutMs === 'number' ? args.timeoutMs : undefined,
      });

    case 'fdc3_discover_context_schema': {
      const contextType = String(args.contextType ?? '').trim();
      if (!contextType) throw new Error('contextType required');
      return discoverabilityRequest(fdc3, channelCache, {
        requestType: CONTEXT_TYPES.discoverContextSchema,
        replyType: CONTEXT_TYPES.contextSchema,
        request: { contextType },
        matchReply: ctx =>
          typeof (ctx as { contextType?: unknown }).contextType === 'string' &&
          (ctx as { contextType: string }).contextType === contextType,
        timeoutMs: typeof args.timeoutMs === 'number' ? args.timeoutMs : undefined,
      });
    }

    default:
      throw new Error(`Unknown FDC3 tool: ${toolName}`);
  }
}
