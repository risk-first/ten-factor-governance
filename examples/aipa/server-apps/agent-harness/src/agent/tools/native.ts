/**
 * Native in-process tools adapted from OpenBB Agent Rita (MIT) — no SQL / table-from-text.
 */

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type { Artifact } from '../types.js';

export function makeNativeTools(opts: {
  onStatus: (message: string) => void;
  onArtifact: (artifact: Artifact) => void;
  setSuggestions: (suggestions: string[]) => void;
}): ToolSet {
  return {
    _llm_think: tool({
      description:
        'Surface a short plan before complex multi-step FDC3 workflows. Use at most once per user request.',
      inputSchema: z.object({
        plan: z.string().min(1).describe('User-facing multi-line plan (bullets).'),
        summary: z.string().default('Planning').describe('One-sentence status line.'),
      }),
      execute: async ({ plan, summary }) => {
        opts.onStatus(summary || 'Planning…');
        return { plan, summary };
      },
    }),

    enhance_prompt: tool({
      description: 'Rewrite a vague user question into a clearer analysis prompt. Optional helper.',
      inputSchema: z.object({
        draft: z.string().min(1).describe('Improved prompt text for the user question.'),
      }),
      execute: async ({ draft }) => {
        opts.onStatus('Enhanced prompt');
        return { enhanced: draft };
      },
    }),

    create_html_artifact: tool({
      description: 'Create a small HTML artifact for the UI (charts/snippets). Keep HTML simple.',
      inputSchema: z.object({
        name: z.string().min(1),
        html: z.string().min(1),
      }),
      execute: async ({ name, html }) => {
        const artifact: Artifact = {
          type: 'html',
          uuid: `art-${Date.now()}`,
          name,
          content: html,
        };
        opts.onArtifact(artifact);
        return { ok: true, uuid: artifact.uuid };
      },
    }),

    suggest_followups: tool({
      description:
        'Call exactly once at the END of your turn with 2–3 short follow-up questions in the user’s voice. Do not call again or regenerate the answer.',
      inputSchema: z.object({
        suggestions: z.array(z.string().min(1).max(80)).min(1).max(3),
      }),
      execute: async ({ suggestions }) => {
        opts.setSuggestions(suggestions);
        return { ok: true, done: true };
      },
    }),
  };
}
