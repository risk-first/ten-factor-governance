/**
 * Resolve JSON Schema documents for FDC3 context types:
 * 1. Local fdc3-extensions (demo.*, fdc3.data, fdc3.ai, …)
 * 2. Published standard context schemas from `@finos/fdc3-context`
 *    (JSON Schema files live there; `@finos/fdc3-schema` is DACP/API, not context types)
 * 3. FDC3 CDN fallback for other `fdc3.*` types
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';
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

function indexSchemaFile(
  index: Map<string, SchemaIndexEntry>,
  filePath: string,
  overwrite: boolean
): void {
  try {
    const schema = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    const contextType = extractContextType(schema);
    if (!contextType) return;
    if (!overwrite && index.has(contextType)) return;
    const schemaUrl =
      typeof schema.$id === 'string' && schema.$id.startsWith('http') ? schema.$id : undefined;
    index.set(contextType, { schema, schemaUrl, filePath });
  } catch {
    /* skip unreadable schema */
  }
}

function indexSchemaDir(
  index: Map<string, SchemaIndexEntry>,
  schemasDir: string,
  overwrite: boolean
): void {
  if (!fs.existsSync(schemasDir)) return;
  for (const file of fs.readdirSync(schemasDir)) {
    if (!file.endsWith('.schema.json') || file === 'context.schema.json') continue;
    indexSchemaFile(index, path.join(schemasDir, file), overwrite);
  }
}

/** `dist/schemas/context` next to `@finos/fdc3-context` package entry. */
function standardContextSchemasDir(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve('@finos/fdc3-context');
    const dir = path.resolve(path.dirname(entry), '../schemas/context');
    return fs.existsSync(dir) ? dir : null;
  } catch {
    return null;
  }
}

function buildIndex(extensionsRoot: string): Map<string, SchemaIndexEntry> {
  const index = new Map<string, SchemaIndexEntry>();
  const standardDir = standardContextSchemasDir();
  if (standardDir) indexSchemaDir(index, standardDir, false);

  if (fs.existsSync(extensionsRoot)) {
    for (const extDir of fs.readdirSync(extensionsRoot, { withFileTypes: true })) {
      if (!extDir.isDirectory()) continue;
      indexSchemaDir(index, path.join(extensionsRoot, extDir.name, 'schemas'), true);
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

export type ContextTypeCatalogMeta = {
  name?: string;
  description?: string;
  schemaUrl?: string;
};

/** Title, description, and schemaUrl from locally indexed JSON Schemas. */
export function indexedContextTypeMeta(
  extensionsRoot: string
): Map<string, ContextTypeCatalogMeta> {
  const out = new Map<string, ContextTypeCatalogMeta>();
  for (const [contextType, entry] of getIndex(extensionsRoot)) {
    const name = typeof entry.schema.title === 'string' ? entry.schema.title : undefined;
    const description =
      typeof entry.schema.description === 'string' ? entry.schema.description : undefined;
    const schemaUrl = entry.schemaUrl ?? canonicalSchemaUrl(contextType);
    const meta: ContextTypeCatalogMeta = {};
    if (name) meta.name = name;
    if (description) meta.description = description;
    if (schemaUrl) meta.schemaUrl = schemaUrl;
    if (name || description || schemaUrl) out.set(contextType, meta);
  }
  return out;
}

/** Types we always know about for the Schema preview UI. */
export function knownSchemaContextTypes(extensionsRoot: string): string[] {
  const fromIndex = [...getIndex(extensionsRoot).keys()];
  const suite = Object.values(CONTEXT_TYPES);
  return [...new Set([...fromIndex, ...suite])].sort();
}
