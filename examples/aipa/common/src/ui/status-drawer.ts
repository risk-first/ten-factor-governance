/**
 * Bottom pull-up status drawer shared by all AIPA apps.
 * Call `mountStatusDrawer()` once after DOM is ready; use returned `setStatus`.
 */

export type StatusDrawer = {
  root: HTMLElement;
  statusEl: HTMLElement;
  setStatus: (msg: string) => void;
  open: () => void;
  close: () => void;
};

export function mountStatusDrawer(
  initial = 'Connecting…',
  parent: HTMLElement = document.body
): StatusDrawer {
  const existing = parent.querySelector<HTMLElement>('.status-drawer');
  if (existing) {
    const statusEl = existing.querySelector<HTMLElement>('#status')!;
    const summary = existing.querySelector<HTMLElement>('.status-drawer__summary')!;
    return wrap(existing, statusEl, summary);
  }

  const root = document.createElement('div');
  root.className = 'status-drawer';
  root.dataset.open = 'false';
  root.innerHTML = `
    <button type="button" class="status-drawer__handle" aria-expanded="false">
      <span class="status-drawer__pill" aria-hidden="true"></span>
      <span class="status-drawer__summary">${escapeHtml(initial)}</span>
      <span class="status-drawer__chevron" aria-hidden="true">▲</span>
    </button>
    <div class="status-drawer__panel">
      <div id="status" class="status">${escapeHtml(initial)}</div>
    </div>
  `;
  parent.appendChild(root);

  const handle = root.querySelector<HTMLButtonElement>('.status-drawer__handle')!;
  handle.addEventListener('click', () => {
    const open = root.dataset.open === 'true';
    root.dataset.open = open ? 'false' : 'true';
    handle.setAttribute('aria-expanded', open ? 'false' : 'true');
  });

  const statusEl = root.querySelector<HTMLElement>('#status')!;
  const summary = root.querySelector<HTMLElement>('.status-drawer__summary')!;
  return wrap(root, statusEl, summary);
}

function wrap(root: HTMLElement, statusEl: HTMLElement, summary: HTMLElement): StatusDrawer {
  const setStatus = (msg: string) => {
    statusEl.textContent = msg;
    const line = msg.trim().split('\n').filter(Boolean).at(-1) ?? msg;
    summary.textContent = line;
  };
  return {
    root,
    statusEl,
    setStatus,
    open: () => {
      root.dataset.open = 'true';
      root.querySelector('.status-drawer__handle')?.setAttribute('aria-expanded', 'true');
    },
    close: () => {
      root.dataset.open = 'false';
      root.querySelector('.status-drawer__handle')?.setAttribute('aria-expanded', 'false');
    },
  };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
