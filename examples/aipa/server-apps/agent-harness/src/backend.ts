import type { Application } from 'express';
import type { Server } from 'http';
import { runHarnessTurn, type ChatMessage } from './llm.js';

function parseMessages(body: {
  text?: string;
  messages?: unknown;
}): ChatMessage[] {
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

/**
 * HTTP surface for the FDC3 Agent harness browser app.
 * The Desktop Agent PrivateChannel carries fdc3.ai.* contexts; this route is the
 * ordinary fetch path to the LLM (L in the fdc3.ai README).
 */
export default function backend(
  app: Application,
  _server: Server,
  _opts: { port: number; appRoot: string; packageRoot: string }
): void {
  app.post('/api/query', async (req, res) => {
    const body = (req.body ?? {}) as { text?: string; model?: string; messages?: unknown };
    const messages = parseMessages(body);
    const model = typeof body.model === 'string' ? body.model : undefined;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const ac = new AbortController();
    // Do not use req 'close' — it fires when the POST body is fully read, which
    // aborts the LLM mid-stream. Only cancel if the client drops the response.
    res.on('close', () => {
      if (!res.writableEnded) ac.abort();
    });

    const send = (event: string, data: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await runHarnessTurn(messages, model, {
        signal: ac.signal,
        onStatus: message => send('status', { message }),
        onText: delta => send('text', { delta }),
        onDone: (markdown, suggestions) => send('done', { markdown, suggestions }),
        onError: message => send('error', { message }),
      });
    } catch (e) {
      send('error', { message: e instanceof Error ? e.message : String(e) });
    } finally {
      if (!res.writableEnded) res.end();
    }
  });
}
