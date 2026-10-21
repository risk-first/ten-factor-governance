import { useEffect, useState } from 'react';

type Props = {
  message: string;
  initiallyOpen?: boolean;
};

/** React pull-up status drawer (same chrome as vanilla `status-drawer.ts`). */
export function StatusDrawer({ message, initiallyOpen = false }: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  const summary = message.trim().split('\n').filter(Boolean).at(-1) ?? message;

  useEffect(() => {
    document.body.style.paddingBottom = '56px';
  }, []);

  return (
    <div className="status-drawer" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="status-drawer__handle"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className="status-drawer__pill" aria-hidden="true" />
        <span className="status-drawer__summary">{summary}</span>
        <span className="status-drawer__chevron" aria-hidden="true">
          ▲
        </span>
      </button>
      <div className="status-drawer__panel">
        <div id="status" className="status">
          {message}
        </div>
      </div>
    </div>
  );
}
