import { useEffect, useMemo, useRef, useState } from 'react';
import type { DesktopAgent } from '@finos/fdc3';
import { CopilotKit, CopilotChat } from '@copilotkit/react-core/v2';
import '@copilotkit/react-core/v2/styles.css';
import { connectAgent } from '../../../common/src/fdc3/agent.ts';
import type { FileFormat } from '../../../common/src/contexts/types.ts';
import { Fdc3PrivateChannelAgent } from './Fdc3PrivateChannelAgent.ts';

type AttachedFile = {
  fileId: string;
  name: string;
  format: FileFormat;
  content_b64: string;
};

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatFromName(name: string): FileFormat | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'txt') return 'txt';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'html' || ext === 'htm') return 'html';
  return null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Thin Agent UI: CopilotKit CopilotChat + FDC3 PrivateChannel AG-UI transport.
 * Conversation never goes UI → harness HTTP — only AskAgent / PrivateChannel.
 */
export function AgentUiApp() {
  const [fdc3, setFdc3] = useState<DesktopAgent | null>(null);
  const [status, setStatusLine] = useState('Connecting to Desktop Agent…');
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const agentRef = useRef<Fdc3PrivateChannelAgent | null>(null);
  const pendingFilesRef = useRef<AttachedFile[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const agent = await connectAgent(null);
      if (cancelled || !agent) {
        setStatusLine('Desktop Agent unavailable');
        return;
      }
      setFdc3(agent);
      setStatusLine('Ready — chat over FDC3 / AG-UI');
    })();
    return () => {
      cancelled = true;
      void agentRef.current?.disconnectSession();
    };
  }, []);

  const transportAgent = useMemo(() => {
    if (!fdc3) return null;
    const agent = new Fdc3PrivateChannelAgent({
      fdc3,
      agentId: 'default',
      description: 'Agent UI → harness over FDC3 PrivateChannel',
      harnessAppId: 'aipa-agent-harness',
      takePendingFiles: () => {
        const files = pendingFilesRef.current;
        pendingFilesRef.current = [];
        setAttachments([]);
        return files;
      },
    });
    agentRef.current = agent;
    return agent;
  }, [fdc3]);

  const onPickFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const next: AttachedFile[] = [];
    for (const file of Array.from(list)) {
      const format = formatFromName(file.name);
      if (!format) {
        setStatusLine(`Unsupported type: ${file.name}`);
        continue;
      }
      const content_b64 = await readFileAsBase64(file);
      next.push({ fileId: uid(), name: file.name, format, content_b64 });
    }
    if (!next.length) return;
    setAttachments(prev => {
      const merged = [...prev, ...next];
      pendingFilesRef.current = merged;
      return merged;
    });
    setStatusLine(`Attached ${next.map(f => f.name).join(', ')}`);
  };

  if (!fdc3 || !transportAgent) {
    return (
      <div className="container">
        <div className="box">
          <p className="note">{status}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div
        className="box"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid #e4e7ec',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ fontSize: 14 }}>Agent</strong>
          <span className="note" style={{ margin: 0, flex: 1 }}>
            {status}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.html,.htm,.pdf,.docx"
            style={{ display: 'none' }}
            onChange={e => {
              void onPickFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Attach
          </button>
          {attachments.length > 0 ? (
            <span className="note" style={{ margin: 0 }}>
              {attachments.map(a => a.name).join(', ')}
            </span>
          ) : null}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CopilotKit
            agents__unsafe_dev_only={{ default: transportAgent }}
            agent="default"
            enableInspector={false}
            showDevConsole={false}
          >
            <CopilotChat
              className="aipa-copilot-chat"
              labels={{
                welcomeMessageText: 'Send a message to the agent. Attach files if needed.',
                chatInputPlaceholder: 'Message the agent…',
              }}
              inspectorTools={false}
            />
          </CopilotKit>
        </div>
      </div>
    </div>
  );
}
