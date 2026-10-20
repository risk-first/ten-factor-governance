/**
 * Resolve JSON Schema documents for FDC3 context types from local
 * fdc3-extensions schemas, with a CDN fallback for published standard types.
 */
import fs from 'fs';
import path from 'path';
import type { ContextSchemaReply } from '../../../common/src/contexts/types.ts';
import { CONTEXT_TYPES } from '../../../common/src/contexts/types.ts';

export type ResolvedContextSchema = Omit<ContextSchemaReply, 'type'> & {
  contextType: string;
};

type SchemaIndexEntry = {
  schema: Record<string, unknown>;
  schemaUrl?: string;
  filePath: string;
};

let cachedIndex: Map<string, SchemaIndexEntry> | null = null;

function extractContextType(schema: Record<string, unknown>): string | null {
  const direct = (schema.properties as { type?: { const?: unknown } } | undefined)?.type?.const;
  if (typeof direct === 'string' && direct) return direct;

  const allOf = schema.allOf;
  if (!Array.isArray(allOf)) return null;
  for (const part of allOf) {
    if (!part || typeof part !== 'object') continue;
    const c = (part as { properties?: { type?: { const?: unknown } } }).properties?.type?.const;
    if (typeof c === 'string' && c) return c;
  }
  return null;
}

function buildIndex(extensionsRoot: string): Map<string, SchemaIndexEntry> {
  const index = new Map<string, SchemaIndexEntry>();
  if (!fs.existsSync(extensionsRoot)) return index;

  for (const extDir of fs.readdirSync(extensionsRoot, { withFileTypes: true })) {
    if (!extDir.isDirectory()) continue;
    const schemasDir = path.join(extensionsRoot, extDir.name, 'schemas');
    if (!fs.existsSync(schemasDir)) continue;
    for (const file of fs.readdirSync(schemasDir)) {
      if (!file.endsWith('.schema.json') || file === 'context.schema.json') continue;
      const filePath = path.join(schemasDir, file);
      try {
        const schema = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
        const contextType = extractContextType(schema);
        if (!contextType) continue;
        const schemaUrl =
          typeof schema.$id === 'string' && schema.$id.startsWith('http')
            ? schema.$id
            : undefined;
        index.set(contextType, { schema, schemaUrl, filePath });
      } catch {
        /* skip unreadable schema */
      }
    }
  }
  return index;
}

function getIndex(extensionsRoot: string): Map<string, SchemaIndexEntry> {
  if (!cachedIndex) cachedIndex = buildIndex(extensionsRoot);
  return cachedIndex;
}

/** Published standard / extension schema URL pattern used by FDC3. */
export function canonicalSchemaUrl(contextType: string): string | undefined {
  if (!contextType.startsWith('fdc3.')) return undefined;
  const rest = contextType.slice('fdc3.'.length);
  return `https://fdc3.finos.org/schemas/next/context/${rest}.schema.json`;
}

async function fetchRemoteSchema(
  contextType: string
): Promise<SchemaIndexEntry | null> {
  const schemaUrl = canonicalSchemaUrl(contextType);
  if (!schemaUrl) return null;
  try {
    const res = await fetch(schemaUrl);
    if (!res.ok) return null;
    const schema = (await res.json()) as Record<string, unknown>;
    if (!schema || typeof schema !== 'object') return null;
    return { schema, schemaUrl, filePath: schemaUrl };
  } catch {
    return null;
  }
}

export async function resolveContextSchema(
  contextType: string,
  extensionsRoot: string
): Promise<ResolvedContextSchema> {
  const trimmed = contextType.trim();
  if (!trimmed) {
    return { contextType: '', error: 'contextType is required' };
  }

  const local = getIndex(extensionsRoot).get(trimmed);
  if (local) {
    return {
      contextType: trimmed,
      schemaUrl: local.schemaUrl ?? canonicalSchemaUrl(trimmed),
      schema: local.schema,
    };
  }

  const remote = await fetchRemoteSchema(trimmed);
  if (remote) {
    return {
      contextType: trimmed,
      schemaUrl: remote.schemaUrl,
      schema: remote.schema,
    };
  }

  return {
    contextType: trimmed,
    schemaUrl: canonicalSchemaUrl(trimmed),
    error: `No JSON Schema registered for context type ${trimmed}`,
  };
}

/** Types we always know about for the Schema preview UI. */
export function knownSchemaContextTypes(extensionsRoot: string): string[] {
  const fromIndex = [...getIndex(extensionsRoot).keys()];
  const suite = Object.values(CONTEXT_TYPES);
  return [...new Set([...fromIndex, ...suite])].sort();
}
