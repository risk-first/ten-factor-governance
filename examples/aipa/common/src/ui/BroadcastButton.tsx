import { BROADCAST_ICON_SVG } from './broadcast-icon.ts';

type Props = {
  title?: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
};

/** Shared broadcast control used across apps. */
export function BroadcastButton({
  title = 'Broadcast instrument',
  disabled,
  onClick,
  className,
}: Props) {
  return (
    <button
      type="button"
      className={`icon-btn broadcast-btn${className ? ` ${className}` : ''}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: BROADCAST_ICON_SVG }}
    />
  );
}
