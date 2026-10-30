import type { LucideIcon } from "lucide-react";

export function PreviewNavItem({
  active,
  description,
  icon: Icon,
  onClick,
  progress = 0,
  title,
}: {
  active: boolean;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  progress?: number;
  title: string;
}) {
  return (
    <button
      aria-current={active ? "step" : undefined}
      className="lp-preview-step"
      onClick={onClick}
      type="button"
    >
      <span>
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {active ? (
        <span className="fd-bar is-thin" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </span>
      ) : null}
    </button>
  );
}
