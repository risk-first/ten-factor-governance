/** Shared broadcast icon markup (radio/waves). */

export const BROADCAST_ICON_SVG = `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="2.25" fill="currentColor"/>
  <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
  <path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
</svg>
`.trim();

export function createBroadcastButton(opts?: {
  title?: string;
  className?: string;
}): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `icon-btn broadcast-btn${opts?.className ? ` ${opts.className}` : ''}`;
  btn.title = opts?.title ?? 'Broadcast instrument';
  btn.setAttribute('aria-label', opts?.title ?? 'Broadcast instrument');
  btn.innerHTML = BROADCAST_ICON_SVG;
  return btn;
}
