/**
 * AG-UI AbstractAgent transport over an FDC3 PrivateChannel.
 * Speaks only AG-UI: `RunAgentInput` out, `Event` stream in.
 * AskAgent / agentQuery is connection setup (how the channel is obtained), not protocol.
 */

import {
  AbstractAgent,
  EventType,
  type AgentConfig,
  type BaseEvent,
  type RunAgentInput,
} from '@ag-ui/client';
import type { DesktopAgent, Listener, PrivateChannel } from '@finos/fdc3';
import { Observable } from 'rxjs';
import { CONTEXT_TYPES, INTENTS } from '../../../common/src/contexts/types.ts';
import {
  createOrderedEventApplicator,
  encodeAgentQuery,
  encodeAguiRun,
  isAguiEvent,
} from '../../../common/src/agui/envelopes.ts';

export type StagedFileBytes = {
  fileId: string;
  name: string;
  format: string;
  content_b64: string;
};

export type Fdc3PrivateChannelAgentConfig = AgentConfig & {
  fdc3: DesktopAgent;
  /** AppIdentifier or appId for the harness AskAgent target. */
  harnessAppId?: string;
  /**
   * Optional attachments for the next run, placed on `RunAgentInput.forwardedProps`
   * (AG-UI). Not a separate FDC3 protocol.
   */
  takePendingFiles?: () => StagedFileBytes[];
};

type Session = {
  channel: PrivateChannel;
  threadId: string;
  listeners: Listener[];
};

function newThreadId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveHarnessTarget(
  fdc3: DesktopAgent,
  harnessAppId: string
): Promise<{ appId: string; instanceId?: string }> {
  const app = { appId: harnessAppId };
  try {
    const instances = await fdc3.findInstances(app);
    if (instances[0]) return instances[0];
  } catch {
    /* fall through */
  }
  return app;
}

export class Fdc3PrivateChannelAgent extends AbstractAgent {
  private readonly fdc3: DesktopAgent;
  private readonly harnessAppId: string;
  private readonly takePendingFiles?: () => StagedFileBytes[];
  private session: Session | null = null;
  private connecting: Promise<Session> | null = null;
  private activeAbort: AbortController | null = null;

  constructor(config: Fdc3PrivateChannelAgentConfig) {
    super(config);
    this.fdc3 = config.fdc3;
    this.harnessAppId = config.harnessAppId ?? 'aipa-agent-harness';
    this.takePendingFiles = config.takePendingFiles;
  }

  clone(): Fdc3PrivateChannelAgent {
    const cloned = super.clone() as Fdc3PrivateChannelAgent;
    (cloned as unknown as { fdc3: DesktopAgent }).fdc3 = this.fdc3;
    (cloned as unknown as { harnessAppId: string }).harnessAppId = this.harnessAppId;
    (cloned as unknown as { takePendingFiles?: () => StagedFileBytes[] }).takePendingFiles =
      this.takePendingFiles;
    (cloned as unknown as { session: Session | null }).session = this.session;
    (cloned as unknown as { connecting: Promise<Session> | null }).connecting = this.connecting;
    return cloned;
  }

  /** Local abort only — same as cancelling an HTTP/SSE read. */
  abortRun(): void {
    this.activeAbort?.abort();
    super.abortRun();
  }

  async disconnectSession(): Promise<void> {
    const session = this.session;
    this.session = null;
    this.connecting = null;
    if (!session) return;
    for (const l of session.listeners) {
      try {
        await l.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    try {
      await session.channel.disconnect();
    } catch {
      /* ignore */
    }
  }

  async ensureSession(): Promise<Session> {
    if (this.session) return this.session;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const target = await resolveHarnessTarget(this.fdc3, this.harnessAppId);
      const threadId = this.threadId?.trim() || newThreadId();
      const query = encodeAgentQuery({ threadId });
      const resolution = await this.fdc3.raiseIntent(INTENTS.AskAgent, query as never, target);
      const result = await resolution.getResult();
      if (!result || typeof result !== 'object' || !('broadcast' in result)) {
        throw new Error('AskAgent did not return a PrivateChannel');
      }
      const channel = result as PrivateChannel;
      const session: Session = { channel, threadId, listeners: [] };
      this.threadId = threadId;
      this.session = session;
      return session;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>(subscriber => {
      const abort = new AbortController();
      this.activeAbort = abort;
      let eventListener: Listener | null = null;
      let disconnectListener: Listener | null = null;
      let finished = false;

      const fail = (err: unknown) => {
        if (finished) return;
        finished = true;
        const message = err instanceof Error ? err.message : String(err);
        subscriber.next({
          type: EventType.RUN_ERROR,
          message,
        } as BaseEvent);
        subscriber.error(err instanceof Error ? err : new Error(message));
      };

      const complete = () => {
        if (finished) return;
        finished = true;
        subscriber.complete();
      };

      const applicator = createOrderedEventApplicator({
        onEvent: (event, _seq) => {
          if (finished || abort.signal.aborted) return;
          subscriber.next(event);
          if (event.type === EventType.RUN_FINISHED || event.type === EventType.RUN_ERROR) {
            complete();
          }
        },
      });

      void (async () => {
        try {
          const session = await this.ensureSession();
          if (abort.signal.aborted) {
            complete();
            return;
          }

          const pendingFiles = this.takePendingFiles?.() ?? [];
          const runInput: RunAgentInput = {
            ...input,
            threadId: session.threadId || input.threadId,
            forwardedProps: {
              ...(typeof input.forwardedProps === 'object' && input.forwardedProps
                ? input.forwardedProps
                : {}),
              ...(pendingFiles.length
                ? {
                    fileIds: pendingFiles.map(f => f.fileId),
                    files: pendingFiles.map(f => ({
                      id: f.fileId,
                      fileId: f.fileId,
                      name: f.name,
                      format: f.format,
                      content_b64: f.content_b64,
                    })),
                  }
                : {}),
            },
          };

          eventListener = await session.channel.addContextListener(
            CONTEXT_TYPES.aguiEvent,
            ctx => {
              if (!isAguiEvent(ctx) || finished || abort.signal.aborted) return;
              const ev = ctx.event as BaseEvent & { runId?: string };
              if (
                ev.runId &&
                ev.runId !== runInput.runId &&
                (ev.type === EventType.RUN_STARTED ||
                  ev.type === EventType.RUN_FINISHED ||
                  ev.type === EventType.RUN_ERROR)
              ) {
                return;
              }
              applicator.push(ctx.seq, ctx.event);
            }
          );
          session.listeners.push(eventListener);

          disconnectListener = await session.channel.addEventListener('disconnect', () => {
            fail(new Error('PrivateChannel disconnected'));
            void this.disconnectSession();
          });
          session.listeners.push(disconnectListener);

          abort.signal.addEventListener('abort', () => {
            if (!finished) {
              subscriber.next({
                type: EventType.RUN_ERROR,
                message: 'Cancelled',
              } as BaseEvent);
              complete();
            }
          });

          await session.channel.broadcast(encodeAguiRun(runInput) as never);
        } catch (e) {
          fail(e);
        }
      })();

      return () => {
        abort.abort();
        void eventListener?.unsubscribe().catch(() => undefined);
        void disconnectListener?.unsubscribe().catch(() => undefined);
        if (this.activeAbort === abort) this.activeAbort = null;
      };
    });
  }
}
