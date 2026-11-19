"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useOverlay } from "./use-overlay";

export type ModalSize = "sm" | "md" | "lg";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: ModalSize;
  dismissible?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  dismissible = true,
  footer,
  children,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const surfaceRef = useOverlay(open, () => onOpenChange(false), dismissible);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(24,24,27,0.42)] p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) {
          onOpenChange(false);
        }
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={[
          "flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl focus:outline-none",
          sizeClasses[size],
        ].join(" ")}
        ref={surfaceRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[color:var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p
                className="mt-1 text-sm leading-6 text-[color:var(--muted)]"
                id={descriptionId}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Kapat"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[color:var(--soft)] hover:text-[color:var(--text)] disabled:pointer-events-none disabled:opacity-45"
            disabled={!dismissible}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        {children ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        ) : null}

        {footer ? (
          <div className="flex shrink-0 flex-col gap-2 border-t border-[color:var(--border)] px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
