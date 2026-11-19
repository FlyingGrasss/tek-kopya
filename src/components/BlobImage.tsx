"use client";

import type { CacheMode } from "@/lib/blob-cache";
import { useBlobUrl } from "@/lib/use-blob-url";
import { Icon } from "./ui/Icon";

export interface BlobImageProps {
  id: string;
  alt: string;
  mode?: CacheMode;
  className?: string;
}

export function BlobImage({
  id,
  alt,
  mode = "preview",
  className = "",
}: BlobImageProps) {
  const { state } = useBlobUrl(id, mode);

  if (state.status === "ready") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob object URLs cannot use next/image
      <img
        alt={alt}
        className={["h-full w-full object-cover", className].filter(Boolean).join(" ")}
        decoding="async"
        draggable={false}
        src={state.url}
      />
    );
  }

  if (state.status === "error") {
    return (
      <span
        className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[color:var(--soft)] px-2 text-center text-[11px] text-[color:var(--muted)]"
        role="img"
        aria-label={`${alt}: görsel yüklenemedi`}
      >
        <Icon name="alert" size={16} />
        Yüklenemedi
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center bg-[color:var(--soft)]"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--border-strong)] border-r-transparent" />
    </span>
  );
}
