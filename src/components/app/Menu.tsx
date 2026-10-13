"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@src/lib/utils";
import { useDismiss } from "./useDismiss";

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

/** Trigger button plus a keyboard-navigable dropdown anchored to its right edge. */
export function Menu({
  label,
  trigger,
  triggerClassName,
  items,
  header,
  footer,
  align = "right",
}: {
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
  items: MenuItem[];
  header?: ReactNode;
  footer?: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = useCallback(() => setOpen(false), []);
  const dismissRefs = useMemo(() => [anchorRef], []);
  useDismiss(dismissRefs, close, open);

  useEffect(() => {
    if (open) itemRefs.current.find((item) => item && !item.disabled)?.focus();
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled));
    const index = enabled.findIndex((item) => item === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      enabled[(index + 1) % enabled.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      enabled[index <= 0 ? enabled.length - 1 : index - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div
      ref={anchorRef}
      className="fd-menu-anchor"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          className="fd-menu"
          role="menu"
          aria-label={label}
          onKeyDown={handleKeyDown}
          style={align === "right" ? { top: "calc(100% + 6px)", right: 0 } : { top: "calc(100% + 6px)", left: 0, transformOrigin: "top left" }}
        >
          {header}
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              className={cn("fd-menu-item", item.danger && "is-danger")}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          {footer}
        </div>
      ) : null}
    </div>
  );
}
