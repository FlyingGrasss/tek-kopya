"use client";

import { useSyncExternalStore } from "react";
import { deviceBlobCache, type DeviceCacheStats } from "@/lib/blob-cache";

export function useDeviceCacheStats(): DeviceCacheStats {
  return useSyncExternalStore(
    deviceBlobCache.subscribe,
    deviceBlobCache.getSnapshot,
    deviceBlobCache.getSnapshot,
  );
}
