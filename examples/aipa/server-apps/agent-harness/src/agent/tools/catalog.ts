/**
 * List tools registered for the harness agent loop (for UI / debugging).
 */

import type { ToolSet } from 'ai';
import { makeNativeTools } from './native.js';
import { makeDocumentTools } from './documents.js';
import { makeFdc3Tools, isFdc3Tool } from './fdc3.js';

export type ToolCatalogEntry = {
  name: string;
  description: string;
  category: 'native' | 'documents' | 'fdc3';
};

function toolDescription(tool: unknown): string {
  if (!tool || typeof tool !== 'object') return '';
  const d = (tool as { description?: unknown }).description;
  return typeof d === 'string' ? d : '';
}

function categorize(name: string): ToolCatalogEntry['category'] {
  if (isFdc3Tool(name)) return 'fdc3';
  if (name === 'list_documents' || name === 'query_documents') return 'documents';
  return 'native';
}

/** Build the same tool set the agent loop registers (noop handlers for listing). */
export function buildToolSetForCatalog(): ToolSet {
  return {
    ...makeNativeTools({
      onStatus: () => undefined,
      onArtifact: () => undefined,
      setSuggestions: () => undefined,
    }),
    ...makeDocumentTools({
      files: new Map(),
      onCitation: () => undefined,
    }),
    ...makeFdc3Tools(),
  };
}

export function listToolCatalog(): ToolCatalogEntry[] {
  const tools = buildToolSetForCatalog();
  return Object.keys(tools)
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({
      name,
      description: toolDescription(tools[name]),
      category: categorize(name),
    }));
}
