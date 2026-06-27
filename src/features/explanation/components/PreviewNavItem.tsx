import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

export function PreviewNavItem({
  active,
  description,
  icon: Icon,
  index,
  onClick,
  progress = 0,
  title,
}: {
  active: boolean;
  description: string;
  icon: LucideIcon;
  index: number;
  onClick: () => void;
  progress?: number;
  title: string;
}) {
  return (
    <button
      aria-current={active ? "step" : undefined}
      className={active ? "active" : ""}
      onClick={onClick}
      style={{ "--tab-progress": `${progress}%` } as CSSProperties}
      type="button"
    >
      <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
      <span className="step-icon">
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="step-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}
