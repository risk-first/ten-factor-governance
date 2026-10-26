import type { Application } from 'express';
import type { Server } from 'http';
import { WebSocket } from 'ws';
import type { Context } from '@finos/fdc3-context';
import {
  DefaultFDC3Handlers,
  emitToClient,
  EXCHANGE_DATA,
  setupWebsocketServer,
  type BackendIntentHandler,
} from '@finos/fdc3-security';
import {
  appendEnforcementLog,
  appendEvaluationLog,
  ensureGovernanceLogs,
  loadEnforcementLogs,
  loadEvaluationLogs,
} from '../../../common/src/data/governance-log.js';
import { CONTEXT_TYPES, INTENTS } from '../../../common/src/contexts/types.js';
import { LOAD_LOGS, LOGS_UPDATED } from './boundary.js';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function logFromContext(ctx: Context, expectedType: string): unknown {
  const rec = asRecord(ctx);
  if (!rec || rec.type !== expectedType) return undefined;
  const log = rec.log;
  return log && typeof log === 'object' ? log : undefined;
}

function snapshot() {
  return {
    evaluations: loadEvaluationLogs().entries,
    enforcements: loadEnforcementLogs().entries,
  };
}

class GovernanceConsoleHandlers extends DefaultFDC3Handlers {
  constructor(private readonly ws: WebSocket) {
    super();
  }

  private pushLogs(): void {
    emitToClient(this.ws, EXCHANGE_DATA, {
      purpose: LOGS_UPDATED,
      payload: snapshot(),
    });
  }

  async exchangeData(purpose: string, _payload: unknown): Promise<unknown> {
    if (purpose === LOAD_LOGS) {
      return snapshot();
    }
    return super.exchangeData(purpose, _payload);
  }

  async remoteIntentHandler(intent: string): Promise<BackendIntentHandler> {
    if (intent === INTENTS.LogEvaluation) {
      return async ctx => {
        const log = logFromContext(ctx, CONTEXT_TYPES.gemaraEvaluationLog);
        if (log) {
          appendEvaluationLog(log);
          this.pushLogs();
        }
      };
    }
    if (intent === INTENTS.LogEnforcement) {
      return async ctx => {
        const log = logFromContext(ctx, CONTEXT_TYPES.gemaraEnforcementLog);
        if (log) {
          appendEnforcementLog(log);
          this.pushLogs();
        }
      };
    }
    return super.remoteIntentHandler(intent);
  }
}

export default function backend(_app: Application, server: Server): void {
  ensureGovernanceLogs();
  setupWebsocketServer(server, () => {}, (ws: WebSocket) => new GovernanceConsoleHandlers(ws));
}
