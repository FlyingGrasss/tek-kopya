"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useOverlay(
  open: boolean,
  onClose: () => void,
  dismissible = true,
): RefObject<HTMLDivElement | null> {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;

    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const frame = window.requestAnimationFrame(() => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const preferred = surface.querySelector<HTMLElement>("[data-autofocus]");
      const first = preferred ?? surface.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? surface).focus();
    });

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        if (dismissibleRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== "Tab") return;
      const surface = surfaceRef.current;
      if (!surface) return;

      const focusable = Array.from(
        surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        surface.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (!surface.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      if (opener?.isConnected && opener !== document.body) opener.focus();
    };
  }, [open]);

  return surfaceRef;
}
