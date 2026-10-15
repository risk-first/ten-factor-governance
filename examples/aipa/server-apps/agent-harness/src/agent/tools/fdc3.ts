/**
 * Generic FDC3 Desktop Agent tools — schemas only (no execute).
 * The browser harness runs the matching DesktopAgent / Channel API and re-POSTs results.
 */

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

const contextSchema = z
  .record(z.string(), z.unknown())
  .describe('FDC3 Context object (must include type).');

const appIdentifierSchema = z
  .object({
    appId: z.string(),
    instanceId: z.string().optional(),
  })
  .describe('AppIdentifier');

/** Tool names that require browser DesktopAgent execution. */
export const FDC3_TOOL_NAMES = [
  'fdc3_get_info',
  'fdc3_get_app_metadata',
  'fdc3_find_intent',
  'fdc3_find_intents_by_context',
  'fdc3_find_instances',
  'fdc3_raise_intent',
  'fdc3_raise_intent_for_context',
  'fdc3_open',
  'fdc3_broadcast',
  'fdc3_get_user_channels',
  'fdc3_join_user_channel',
  'fdc3_leave_current_channel',
  'fdc3_get_current_channel',
  'fdc3_get_or_create_channel',
  'fdc3_channel_broadcast',
  'fdc3_channel_get_current_context',
  'fdc3_get_current_channel_context',
  'fdc3_discover_apps',
  'fdc3_discover_intents',
  'fdc3_discover_context_types',
] as const;

export type Fdc3ToolName = (typeof FDC3_TOOL_NAMES)[number];

export function isFdc3Tool(name: string): name is Fdc3ToolName {
  return (FDC3_TOOL_NAMES as readonly string[]).includes(name);
}

/**
 * Register FDC3 tools without `execute` so streamText pauses on tool-call
 * and the browser can fulfill them via re-POST.
 */
export function makeFdc3Tools(): ToolSet {
  return {
    fdc3_get_info: tool({
      description: 'DesktopAgent.getInfo() — implementation metadata and optionalFeatures.',
      inputSchema: z.object({}),
    }),

    fdc3_get_app_metadata: tool({
      description: 'DesktopAgent.getAppMetadata(app) — App Directory metadata for display.',
      inputSchema: z.object({ app: appIdentifierSchema }),
    }),

    fdc3_find_intent: tool({
      description: 'DesktopAgent.findIntent — discover apps that handle an intent.',
      inputSchema: z.object({
        intent: z.string(),
        context: contextSchema.optional(),
        resultType: z.string().optional(),
      }),
    }),

    fdc3_find_intents_by_context: tool({
      description: 'DesktopAgent.findIntentsByContext — discover intents for a context.',
      inputSchema: z.object({
        context: contextSchema,
        resultType: z.string().optional(),
      }),
    }),

    fdc3_find_instances: tool({
      description: 'DesktopAgent.findInstances — running instances of an app.',
      inputSchema: z.object({ app: appIdentifierSchema }),
    }),

    fdc3_raise_intent: tool({
      description:
        'DesktopAgent.raiseIntent + getResult(). Prefer findIntent first when the target is unknown.',
      inputSchema: z.object({
        intent: z.string(),
        context: contextSchema.nullable().optional(),
        target: appIdentifierSchema.nullable().optional(),
        newInstance: z.boolean().nullable().optional(),
      }),
    }),

    fdc3_raise_intent_for_context: tool({
      description: 'DesktopAgent.raiseIntentForContext + getResult().',
      inputSchema: z.object({
        context: contextSchema,
        target: appIdentifierSchema.nullable().optional(),
        newInstance: z.boolean().nullable().optional(),
      }),
    }),

    fdc3_open: tool({
      description: 'DesktopAgent.open(app, context?) — launch or focus an app with optional seed context.',
      inputSchema: z.object({
        app: appIdentifierSchema,
        context: contextSchema.nullable().optional(),
      }),
    }),

    fdc3_broadcast: tool({
      description: 'DesktopAgent.broadcast — publish context on the joined user channel.',
      inputSchema: z.object({ context: contextSchema }),
    }),

    fdc3_get_user_channels: tool({
      description: 'DesktopAgent.getUserChannels().',
      inputSchema: z.object({}),
    }),

    fdc3_join_user_channel: tool({
      description: 'DesktopAgent.joinUserChannel(channelId).',
      inputSchema: z.object({ channelId: z.string() }),
    }),

    fdc3_leave_current_channel: tool({
      description: 'DesktopAgent.leaveCurrentChannel().',
      inputSchema: z.object({}),
    }),

    fdc3_get_current_channel: tool({
      description: 'DesktopAgent.getCurrentChannel() — current user channel metadata.',
      inputSchema: z.object({}),
    }),

    fdc3_get_or_create_channel: tool({
      description: 'DesktopAgent.getOrCreateChannel(channelId) — app channel.',
      inputSchema: z.object({ channelId: z.string() }),
    }),

    fdc3_channel_broadcast: tool({
      description: 'Channel.broadcast on a named/app channel (by id).',
      inputSchema: z.object({
        channelId: z.string(),
        context: contextSchema,
      }),
    }),

    fdc3_channel_get_current_context: tool({
      description: 'Channel.getCurrentContext on a named/app channel.',
      inputSchema: z.object({
        channelId: z.string(),
        contextType: z.string().optional(),
      }),
    }),

    fdc3_get_current_channel_context: tool({
      description:
        'Return last-seen user-channel contexts cached by the harness (e.g. fdc3.portfolio).',
      inputSchema: z.object({
        contextType: z.string().optional().describe('Optional filter by context type.'),
      }),
    }),

    fdc3_discover_apps: tool({
      description:
        'fdc3.discoverability: broadcast discoverApps on app channel fdc3.discoverability and wait for appDirectory (AppD records). Prefer this for catalog planning before findIntent/open.',
      inputSchema: z.object({
        timeoutMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Max wait for reply (default 8000).'),
      }),
    }),

    fdc3_discover_intents: tool({
      description:
        'fdc3.discoverability: broadcast discoverIntents on app channel fdc3.discoverability and wait for intentList. Prefer this to learn raisable intents before findIntent.',
      inputSchema: z.object({
        timeoutMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Max wait for reply (default 8000).'),
      }),
    }),

    fdc3_discover_context_types: tool({
      description:
        'fdc3.discoverability: broadcast discoverContextTypes on app channel fdc3.discoverability and wait for contextTypeList.',
      inputSchema: z.object({
        timeoutMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Max wait for reply (default 8000).'),
      }),
    }),
  };
}
