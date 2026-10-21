/**
 * Document staging adapted from OpenBB Agent Rita `agent/documents.ts` (MIT).
 * Local text extract substitutes for Rita MCP query_documents in Phase 1.
 */

import type { StagedFile } from './types.js';

export const MAX_DOC_BYTES = 25 * 1024 * 1024;

export type FileInput = {
  id: string;
  name: string;
  format: StagedFile['format'];
  content_b64?: string;
  url?: string;
};

export async function loadFileBytes(doc: FileInput): Promise<Uint8Array> {
  if (doc.content_b64) {
    return Uint8Array.from(Buffer.from(doc.content_b64, 'base64'));
  }
  if (doc.url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(doc.url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${doc.url}`);
      return new Uint8Array(await res.arrayBuffer());
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`File ${doc.id} has neither content_b64 nor url`);
}

/** Extract text for model use. TXT/MD/HTML only in Phase 1; PDF/DOCX get a stub note. */
export function extractText(file: StagedFile): string {
  if (file.text) return file.text;
  if (file.format === 'txt' || file.format === 'md' || file.format === 'html') {
    return new TextDecoder('utf-8', { fatal: false }).decode(file.bytes);
  }
  return (
    `[Binary ${file.format.toUpperCase()} “${file.name}” (${file.bytes.byteLength} bytes) ` +
    `— full extract deferred to MCP phase. Filename and id are available for citation.]`
  );
}

export async function stageFile(doc: FileInput): Promise<StagedFile | null> {
  try {
    const bytes = await loadFileBytes(doc);
    if (bytes.byteLength > MAX_DOC_BYTES) {
      console.warn(`fdc3.ai: file ${doc.id} exceeds ${MAX_DOC_BYTES} bytes — skipping`);
      return null;
    }
    const staged: StagedFile = {
      id: doc.id,
      name: doc.name,
      format: doc.format,
      bytes,
    };
    staged.text = extractText(staged);
    return staged;
  } catch (e) {
    console.warn(`fdc3.ai: failed to stage file ${doc.id}:`, e);
    return null;
  }
}

export function listStagedSummary(files: Map<string, StagedFile>): string {
  if (files.size === 0) return 'No files staged in this session.';
  return [...files.values()]
    .map(f => `- ${f.id}: ${f.name} (${f.format}, ${f.bytes.byteLength} bytes)`)
    .join('\n');
}

export function queryStagedFiles(
  files: Map<string, StagedFile>,
  fileIds: string[] | undefined,
  query: string
): { fileId: string; name: string; excerpt: string }[] {
  const ids = fileIds?.length ? fileIds : [...files.keys()];
  const q = query.trim().toLowerCase();
  const out: { fileId: string; name: string; excerpt: string }[] = [];
  for (const id of ids) {
    const f = files.get(id);
    if (!f) continue;
    const text = f.text ?? extractText(f);
    if (!q) {
      out.push({ fileId: id, name: f.name, excerpt: text.slice(0, 4000) });
      continue;
    }
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx < 0) {
      out.push({
        fileId: id,
        name: f.name,
        excerpt: `(no match for “${query}”) ${text.slice(0, 800)}`,
      });
      continue;
    }
    const start = Math.max(0, idx - 200);
    out.push({
      fileId: id,
      name: f.name,
      excerpt: text.slice(start, start + 2000),
    });
  }
  return out;
}
