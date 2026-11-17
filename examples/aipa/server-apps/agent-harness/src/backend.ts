import type { Application } from 'express';
import type { Server } from 'http';
import {
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotExpressHandler,
} from '@copilotkit/runtime/v2';
import { listToolCatalog } from './agent/tools/catalog.js';
import { AipaLoopAgent } from './agui/AipaLoopAgent.js';

/**
 * HTTP surface for the FDC3 Agent harness browser app.
 * CopilotRuntime hosts AipaLoopAgent (AG-UI). Harness browser bridges
 * PrivateChannel ↔ this runtime over same-origin HTTP. UI never calls this.
 */
export default function backend(
  app: Application,
  _server: Server,
  _opts: { port: number; appRoot: string; packageRoot: string }
): void {
  app.get('/api/tools', (_req, res) => {
    try {
      res.json({ tools: listToolCatalog() });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  const runtime = new CopilotRuntime({
    agents: {
      default: new AipaLoopAgent({
        agentId: 'default',
        description: 'AIPA Portfolio Assistant harness agent',
      }),
    },
    runner: new InMemoryAgentRunner(),
    // Single-user demo harness; threads are not shared across tenants.
    threads: { access: 'open' },
  });

  app.use(
    createCopilotExpressHandler({
      runtime,
      basePath: '/api/copilotkit',
      cors: true,
    })
  );
}
