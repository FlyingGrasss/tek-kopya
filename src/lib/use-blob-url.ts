"use client";

import { useEffect, useRef, useState } from "react";
import { deviceBlobCache, type CacheMode } from "@/lib/blob-cache";

export type BlobUrlState =
  | { status: "loading"; url: null }
  | { status: "ready"; url: string }
  | { status: "error"; url: null };

export interface UseBlobUrlResult {
  state: BlobUrlState;
  retry: () => void;
}

export function useBlobUrl(
  id: string | null,
  mode: CacheMode,
  onFullLoaded?: () => void,
): UseBlobUrlResult {
  const [state, setState] = useState<BlobUrlState>({ status: "loading", url: null });
  const [attempt, setAttempt] = useState(0);
  const callbackRef = useRef(onFullLoaded);

  callbackRef.current = onFullLoaded;

  useEffect(() => {
    if (!id) {
      setState({ status: "loading", url: null });
      return;
    }

    let cancelled = false;
    let pinned = false;
    setState({ status: "loading", url: null });

    deviceBlobCache
      .load(id, mode)
      .then((url) => {
        if (cancelled) return;
        deviceBlobCache.retain(id);
        pinned = true;
        setState({ status: "ready", url });
        if (mode === "full") callbackRef.current?.();
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", url: null });
      });

    return () => {
      cancelled = true;
      if (pinned) deviceBlobCache.release(id);
    };
  }, [id, mode, attempt]);

  return {
    state,
    retry: () => setAttempt((current) => current + 1),
  };
}
