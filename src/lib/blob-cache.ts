import {
  DEVICE_CACHE_MAX_BYTES,
  DEVICE_CACHE_MAX_ENTRIES,
} from "@shared/constants";

export type CacheMode = "preview" | "full";

export interface DeviceCacheStats {
  bytes: number;
  entries: number;
  maxBytes: number;
  maxEntries: number;
  evictions: number;
  hits: number;
  misses: number;
}

interface CacheEntry {
  id: string;
  url: string;
  size: number;
  pins: number;
  lastUsed: number;
}

type Listener = () => void;

function emptyStats(): DeviceCacheStats {
  return {
    bytes: 0,
    entries: 0,
    maxBytes: DEVICE_CACHE_MAX_BYTES,
    maxEntries: DEVICE_CACHE_MAX_ENTRIES,
    evictions: 0,
    hits: 0,
    misses: 0,
  };
}

/**
 * Session-scoped LRU cache of object URLs. The server owns the bytes; this
 * cache models the recipient device so reopening a thumbnail never hits the
 * network again. Full-size opens intentionally bypass the cache to count as
 * a real download in the demo metrics.
 */
class DeviceBlobCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<string>>();
  private readonly listeners = new Set<Listener>();
  private stats: DeviceCacheStats = emptyStats();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): DeviceCacheStats => this.stats;

  async load(id: string, mode: CacheMode): Promise<string> {
    if (mode === "preview") {
      const cached = this.entries.get(id);
      if (cached) {
        this.touch(cached);
        this.stats = { ...this.stats, hits: this.stats.hits + 1 };
        this.emit();
        return cached.url;
      }
    }

    const key = `${mode}:${id}`;
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = this.fetchBlob(id, mode).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, request);
    return request;
  }

  retain(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.pins += 1;
    this.touch(entry);
    this.emit();
  }

  release(id: string): void {
    const entry = this.entries.get(id);
    if (!entry || entry.pins === 0) return;
    entry.pins -= 1;
    this.evict();
    this.emit();
  }

  private async fetchBlob(id: string, mode: CacheMode): Promise<string> {
    this.stats = { ...this.stats, misses: this.stats.misses + 1 };
    this.emit();

    const url =
      mode === "full"
        ? `/api/blobs/${id}?open=1`
        : `/api/blobs/${id}?preview=1`;
    const response = await fetch(url, {
      cache: mode === "full" ? "no-store" : "default",
      credentials: "same-origin",
      headers: { Accept: "image/*" },
    });

    if (!response.ok) {
      throw new Error(`Görsel yüklenemedi (${response.status}).`);
    }

    const blob = await response.blob();
    const existing = this.entries.get(id);

    if (existing) {
      existing.pins += 0;
      existing.lastUsed = Date.now();
      this.touch(existing);
      this.emit();
      return existing.url;
    }

    const objectUrl = URL.createObjectURL(blob);
    const entry: CacheEntry = {
      id,
      url: objectUrl,
      size: blob.size,
      pins: 0,
      lastUsed: Date.now(),
    };
    this.entries.set(id, entry);
    this.evict();
    this.emit();
    return entry.url;
  }

  private touch(entry: CacheEntry): void {
    entry.lastUsed = Date.now();
    this.entries.delete(entry.id);
    this.entries.set(entry.id, entry);
  }

  private evict(): void {
    let changed = false;
    let bytes = this.sumBytes();

    while (
      this.entries.size > DEVICE_CACHE_MAX_ENTRIES ||
      bytes > DEVICE_CACHE_MAX_BYTES
    ) {
      let candidate: CacheEntry | undefined;
      for (const entry of this.entries.values()) {
        if (entry.pins === 0) {
          candidate = entry;
          break;
        }
      }
      if (!candidate) break;

      this.entries.delete(candidate.id);
      URL.revokeObjectURL(candidate.url);
      this.stats = {
        ...this.stats,
        evictions: this.stats.evictions + 1,
      };
      bytes -= candidate.size;
      changed = true;
    }

    if (changed) this.emit();
  }

  private sumBytes(): number {
    let total = 0;
    for (const entry of this.entries.values()) total += entry.size;
    return total;
  }

  private emit(): void {
    this.stats = {
      ...this.stats,
      bytes: this.sumBytes(),
      entries: this.entries.size,
      maxBytes: DEVICE_CACHE_MAX_BYTES,
      maxEntries: DEVICE_CACHE_MAX_ENTRIES,
    };
    for (const listener of this.listeners) listener();
  }
}

export const deviceBlobCache = new DeviceBlobCache();
