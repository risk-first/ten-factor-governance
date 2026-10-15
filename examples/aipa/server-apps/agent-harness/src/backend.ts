import type { Application } from 'express';
import type { Server } from 'http';
import { runHarnessTurn, type ChatMessage } from './llm.js';
import type { FileInput } from './agent/documents.js';
import type { ToolResultPayload } from './agent/types.js';

function parseMessages(body: { text?: string; messages?: unknown }): ChatMessage[] {
  if (Array.isArray(body.messages)) {
    const out: ChatMessage[] = [];
    for (const m of body.messages) {
      if (!m || typeof m !== 'object') continue;
      const role = (m as { role?: unknown }).role;
      const content = (m as { content?: unknown }).content;
      if ((role === 'user' || role === 'assistant') && typeof content === 'string') {
        out.push({ role, content });
      }
    }
    if (out.length) return out;
  }
  const text = typeof body.text === 'string' ? body.text : '';
  return [{ role: 'user', content: text }];
}

function parseFiles(raw: unknown): FileInput[] {
  if (!Array.isArray(raw)) return [];
  const out: FileInput[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const id = String((f as { id?: string }).id ?? (f as { fileId?: string }).fileId ?? '');
    const name = String((f as { name?: string }).name ?? '');
    const format = (f as { format?: string }).format;
    if (!id || !name) continue;
    if (format !== 'pdf' && format !== 'docx' && format !== 'txt' && format !== 'md' && format !== 'html') {
      continue;
    }
    out.push({
      id,
      name,
      format,
      content_b64: typeof (f as { content_b64?: string }).content_b64 === 'string'
        ? (f as { content_b64: string }).content_b64
        : undefined,
      url: typeof (f as { url?: string }).url === 'string' ? (f as { url: string }).url : undefined,
    });
  }
  return out;
}

function parseToolResults(raw: unknown): ToolResultPayload[] {
  if (!Array.isArray(raw)) return [];
  const out: ToolResultPayload[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const toolCallId = String((t as { toolCallId?: string }).toolCallId ?? '');
    const toolName = String((t as { toolName?: string }).toolName ?? '');
    if (!toolCallId || !toolName) continue;
    out.push({
      toolCallId,
      toolName,
      result: (t as { result?: unknown }).result,
      isError: Boolean((t as { isError?: boolean }).isError),
    });
  }
  return out;
}

/**
 * HTTP surface for the FDC3 Agent harness browser app.
 * Supports agent-loop SSE including function_call for browser FDC3 re-POST.
 */
export default function backend(
  app: Application,
  _server: Server,
  _opts: { port: number; appRoot: string; packageRoot: string }
): void {
  app.post('/api/query', async (req, res) => {
    const body = (req.body ?? {}) as {
      text?: string;
      model?: string;
      messages?: unknown;
      sessionId?: string;
      files?: unknown;
      toolResults?: unknown;
    };
    const messages = parseMessages(body);
    const model = typeof body.model === 'string' ? body.model : undefined;
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : `anon-${Date.now()}`;
    const files = parseFiles(body.files);
    const toolResults = parseToolResults(body.toolResults);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const ac = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) ac.abort();
    });

    const send = (event: string, data: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await runHarnessTurn({
        sessionId,
        messages,
        modelHint: model,
        files,
        toolResults,
        handlers: {
          signal: ac.signal,
          onStatus: message => send('status', { message }),
          onText: delta => send('text', { delta }),
          onArtifact: artifact => send('artifact', { artifact }),
          onCitation: citation => send('citation', { citation }),
          onFunctionCall: call => {
            send('function_call', call);
          },
          onDone: (markdown, meta) =>
            send('done', {
              markdown,
              suggestions: meta?.suggestions,
              citations: meta?.citations,
              artifacts: meta?.artifacts,
            }),
          onError: message => send('error', { message }),
        },
      });
    } catch (e) {
      send('error', { message: e instanceof Error ? e.message : String(e) });
    } finally {
      if (!res.writableEnded) res.end();
    }
  });
}
