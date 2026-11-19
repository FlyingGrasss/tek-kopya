import type { ReactNode } from "react";

export type IconName =
  | "alert"
  | "arrow-right"
  | "chat"
  | "check"
  | "copy"
  | "database"
  | "download"
  | "image"
  | "lock"
  | "paperclip"
  | "plus"
  | "refresh"
  | "send"
  | "spark"
  | "trash"
  | "x"
  | "zoom";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}

const paths: Record<IconName, ReactNode> = {
  alert: (
    <>
      <path d="M10.3 3.9 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  chat: (
    <>
      <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-3.9-.9L3 21l1.9-5.6a9 9 0 0 1-.9-3.9A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  paperclip: <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l8.9-8.9a4 4 0 0 1 5.7 5.7l-8.9 8.9a2 2 0 0 1-2.8-2.8l8.2-8.2" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v6h-6" />
    </>
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  spark: (
    <>
      <path d="M12 2.5 13.8 8l5.5 1.8-5.5 1.8L12 17l-1.8-5.4L4.7 9.8 10.2 8Z" />
      <path d="M19 15.5 20 18l2.5 1L20 20l-1 2.5L18 20l-2.5-1L18 18Z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  zoom: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
      <path d="M8 11h6M11 8v6" />
    </>
  ),
};
