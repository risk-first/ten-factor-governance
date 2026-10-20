/**
 * Generic FDC3 Desktop Agent tools — schemas only (no execute).
 * The browser harness runs the matching DesktopAgent / Channel API and re-POSTs results.
 *
 * Tool descriptions are when/when-not oriented so the model can route correctly.
 * Edit freely — they are the main signal for tool choice.
 */

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

const contextSchema = z
  .object({
    type: z
      .string()
      .min(1)
      .describe(
        'FDC3 context type (e.g. fdc3.portfolio, fdc3.instrument, fdc3.data.markdown).'
      ),
  })
  .passthrough()
  .describe(
    'FDC3 Context object. type is required; other fields (id, name, …) depend on the type.'
  );

const appIdentifierSchema = z
  .object({
    appId: z.string().describe('App Directory appId (e.g. aipa-portfolio).'),
    instanceId: z.string().optional().describe('Optional running instance id.'),
  })
  .describe('AppIdentifier');

const intentNameSchema = z
  .string()
  .describe(
    'Exact FDC3 intent name from fdc3_discover_intents or a known suite intent (e.g. GetPortfolio, ViewChart, demo.GetResearch, demo.GetPortfolioRisk, AskAgent). Never invent names.'
  );

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
  'fdc3_discover_context_schema',
  'fdc3_discover_app_directory_record',
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
      description:
        'Platform metadata (Desktop Agent name, version, optionalFeatures). Use rarely. Not for listing apps or intents.',
      inputSchema: z.object({}),
    }),

    fdc3_get_app_metadata: tool({
      description:
        'Display metadata for one known appId (title, icons, etc.). Use when you already have an appId. For “what apps exist?”, use fdc3_discover_apps instead.',
      inputSchema: z.object({ app: appIdentifierSchema }),
    }),

    fdc3_find_intent: tool({
      description:
        'Runtime resolve: given an intent name you already know, which apps can handle it right now? Good: “who handles ViewChart?”. Bad: “what apps exist?” (use fdc3_discover_apps) or “what intents exist?” (use fdc3_discover_intents).',
      inputSchema: z.object({
        intent: intentNameSchema,
        context: contextSchema.optional(),
        resultType: z.string().optional().describe('Optional IntentResult type filter.'),
      }),
    }),

    fdc3_find_intents_by_context: tool({
      description:
        'Runtime resolve: given a concrete context object, which intents can be raised for it? Good: have fdc3.instrument and want matching intents. Bad: full intent catalog (use fdc3_discover_intents).',
      inputSchema: z.object({
        context: contextSchema,
        resultType: z.string().optional().describe('Optional IntentResult type filter.'),
      }),
    }),

    fdc3_find_instances: tool({
      description:
        'List running instances of one appId (for targeting raiseIntent/open). Not an app catalog.',
      inputSchema: z.object({ app: appIdentifierSchema }),
    }),

    fdc3_raise_intent: tool({
      description:
        'Invoke an intent and await IntentResult (context or channel). Need a concrete intent name + a context whose type is in that intent’s catalog contexts (from fdc3_discover_intents). Prefer fdc3_get_current_channel_context first if a portfolio/instrument may already be on the user channel. If find_intent returns no apps, fix the context type (e.g. ViewChart accepts instrument / instrumentList / portfolio) — do not conclude the app is missing. Prefer fdc3_find_intent only when the handler/target is unknown. Not for catalog listing.',
      inputSchema: z.object({
        intent: intentNameSchema,
        context: contextSchema.nullable().optional(),
        target: appIdentifierSchema.nullable().optional(),
        newInstance: z.boolean().nullable().optional(),
      }),
    }),

    fdc3_raise_intent_for_context: tool({
      description:
        'Raise whatever intents match a context (DesktopAgent.raiseIntentForContext + getResult). Use when you have context but not a specific intent name. Prefer fdc3_raise_intent when you know the intent.',
      inputSchema: z.object({
        context: contextSchema,
        target: appIdentifierSchema.nullable().optional(),
        newInstance: z.boolean().nullable().optional(),
      }),
    }),

    fdc3_open: tool({
      description:
        'Launch or focus an app by appId with optional seed context. Last resort only — prefer fdc3_raise_intent whenever a matching intent exists (e.g. ViewData, ViewChart). Fetch field names via fdc3_discover_context_schema before building context.',
      inputSchema: z.object({
        app: appIdentifierSchema,
        context: contextSchema.nullable().optional(),
      }),
    }),

    fdc3_broadcast: tool({
      description:
        'Broadcast context on the joined user channel (peers listening). Not for discoverability catalogs — use fdc3_discover_*. Not for raising intents.',
      inputSchema: z.object({ context: contextSchema }),
    }),

    fdc3_get_user_channels: tool({
      description:
        'List available user channels (id + display metadata). Rarely needed; prefer fdc3_get_current_channel_context for data already on the channel.',
      inputSchema: z.object({}),
    }),

    fdc3_join_user_channel: tool({
      description:
        'Join a user channel by id. Advanced; usually the host already placed the app on a channel.',
      inputSchema: z.object({ channelId: z.string() }),
    }),

    fdc3_leave_current_channel: tool({
      description: 'Leave the current user channel. Advanced / rarely needed.',
      inputSchema: z.object({}),
    }),

    fdc3_get_current_channel: tool({
      description:
        'Metadata for the current user channel (id, type). For context payloads on that channel, use fdc3_get_current_channel_context instead.',
      inputSchema: z.object({}),
    }),

    fdc3_get_or_create_channel: tool({
      description:
        'Get/create a named app channel by id. Advanced. Do not use for fdc3.discoverability — use fdc3_discover_* which already owns that channel loop.',
      inputSchema: z.object({ channelId: z.string() }),
    }),

    fdc3_channel_broadcast: tool({
      description:
        'Broadcast on a named/app channel by id. Advanced. Do not use for discoverability catalogs — use fdc3_discover_*.',
      inputSchema: z.object({
        channelId: z.string(),
        context: contextSchema,
      }),
    }),

    fdc3_channel_get_current_context: tool({
      description:
        'Read current context from a named/app channel by id. For the user channel cache (portfolio etc.), use fdc3_get_current_channel_context instead.',
      inputSchema: z.object({
        channelId: z.string(),
        contextType: z.string().optional(),
      }),
    }),

    fdc3_get_current_channel_context: tool({
      description:
        'Read last-seen user-channel contexts cached by the harness (e.g. fdc3.portfolio). Prefer this before raising GetPortfolio when the user may already have shared a portfolio on the channel.',
      inputSchema: z.object({
        contextType: z
          .string()
          .optional()
          .describe('Optional filter by context type (e.g. fdc3.portfolio).'),
      }),
    }),

    fdc3_discover_apps: tool({
      description:
        'Catalog: list App Directory apps in this environment (fdc3.discoverability). Use for “what apps do you know?” / planning. Requires Discoverability app running. Not for resolving who handles a specific intent (use fdc3_find_intent) and not for invoking apps (use raise/open).',
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
        'Catalog: list raisable intents with purpose, accepted context types, and optional IntentResult type. Use purpose to pick the intent, then raise with a context whose type is listed under that intent’s contexts (e.g. ViewChart → fdc3.instrument, fdc3.instrumentList, or fdc3.portfolio).',
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
        'Catalog: list known context types (contextType, name, description, optional schemaUrl) used across the applications available.',
      inputSchema: z.object({
        timeoutMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Max wait for reply (default 8000).'),
      }),
    }),

    fdc3_discover_context_schema: tool({
      description:
        'Catalog: fetch the JSON Schema for one context type (fdc3.discoverability). Call this before building a context payload (e.g. fdc3.data.markdown) and copy property names from the schema — do not guess fields. Also use after fdc3_discover_context_types. Pass an exact contextType string (e.g. fdc3.instrument, fdc3.data.markdown).',
      inputSchema: z.object({
        contextType: z
          .string()
          .min(1)
          .describe('Exact FDC3 context type string, e.g. fdc3.portfolio or fdc3.data.markdown.'),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Max wait for reply (default 8000).'),
      }),
    }),

    fdc3_discover_app_directory_record: tool({
      description:
        'Catalog: fetch the full FDC3 App Directory Application record for one appId (fdc3.discoverability). Use after fdc3_discover_apps when you need launch details, declared intents, or hostManifests. Not the slim {appId,title,description} list, and not runtime getAppMetadata.',
      inputSchema: z.object({
        appId: z.string().min(1).describe('Exact App Directory appId from fdc3_discover_apps.'),
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
