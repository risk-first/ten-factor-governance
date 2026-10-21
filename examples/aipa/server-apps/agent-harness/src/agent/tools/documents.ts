/**
 * Local document tools — Phase 1 substitute for Rita MCP query_documents.
 */

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { listStagedSummary, queryStagedFiles } from '../documents.js';
import { citationFromFile } from '../citations.js';
import type { Citation, StagedFile } from '../types.js';

export function makeDocumentTools(opts: {
  files: Map<string, StagedFile>;
  onCitation: (c: Citation) => void;
}): ToolSet {
  return {
    list_documents: tool({
      description: 'List files staged in this agent session (from fdc3.data.file).',
      inputSchema: z.object({}),
      execute: async () => ({
        summary: listStagedSummary(opts.files),
        files: [...opts.files.values()].map(f => ({
          fileId: f.id,
          name: f.name,
          format: f.format,
          bytes: f.bytes.byteLength,
        })),
      }),
    }),

    query_documents: tool({
      description:
        'Search or read staged session files by id. Pass an empty query to return the start of each file.',
      inputSchema: z.object({
        query: z.string().default('').describe('Search string; empty returns leading excerpts.'),
        fileIds: z
          .array(z.string())
          .optional()
          .describe('Subset of file ids; omit for all staged files.'),
      }),
      execute: async ({ query, fileIds }) => {
        const hits = queryStagedFiles(opts.files, fileIds, query);
        for (const h of hits) {
          opts.onCitation(citationFromFile(h.fileId, h.name));
        }
        return { hits };
      },
    }),
  };
}
