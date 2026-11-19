"use client";

import type { MetricsResponse } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  formatBytes,
  formatNumber,
  formatPercent,
  formatClock,
} from "@/lib/format";
import { useDeviceCacheStats } from "@/lib/use-device-cache";
import { BlobImage } from "./BlobImage";
import { Icon } from "./ui/Icon";

export interface StoragePanelProps {
  refreshSignal: number;
}

export function StoragePanel({ refreshSignal }: StoragePanelProps) {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const cache = useDeviceCacheStats();

  const load = useCallback(async (signal?: AbortSignal) => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setRefreshing(true);
    try {
      const next = await apiFetch<MetricsResponse>("/api/metrics", { signal });
      if (seq !== requestSeq.current) return;
      setMetrics(next);
      setError(null);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (seq !== requestSeq.current) return;
      setError(
        caught instanceof Error ? caught.message : "Metrikler yüklenemedi.",
      );
    } finally {
      if (seq === requestSeq.current && !signal?.aborted) {
        setRefreshing(false);
        setInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => {
      void load(controller.signal);
    }, 5_000);

    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [load, refreshSignal]);

  const stored = metrics?.totalBytesStored ?? 0;
  const saved = metrics?.bytesSaved ?? 0;
  const logical = stored + saved;
  const savedShare = logical > 0 ? saved / logical : 0;
  const cacheShare =
    cache.maxBytes > 0 ? Math.min(1, cache.bytes / cache.maxBytes) : 0;

  return (
    <section
      aria-busy={refreshing || undefined}
      aria-labelledby="depolama-baslik"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] px-4 py-3">
        <span
          aria-hidden="true"
          className="relative flex h-2 w-2 items-center justify-center"
        >
          <span className="absolute inline-flex h-2 w-2 rounded-full bg-[color:var(--accent)]" />
          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[color:var(--accent)] opacity-30 motion-reduce:animate-none" />
        </span>
        <h2 className="text-sm font-semibold" id="depolama-baslik">
          Depolama
        </h2>
        <span className="ml-auto text-[10px] text-[color:var(--muted)]">
          5 sn&apos;de bir canlı
        </span>
        <button
          aria-label="Metrikleri yenile"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[color:var(--soft)] hover:text-[color:var(--text)]"
          onClick={() => void load()}
          type="button"
        >
          <Icon
            className={refreshing ? "animate-spin motion-reduce:animate-none" : ""}
            name="refresh"
            size={14}
          />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {initialLoading ? (
          <div aria-hidden="true" className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((item) => (
              <div
                className="h-[74px] animate-pulse rounded-lg bg-[color:var(--soft)]"
                key={item}
              />
            ))}
          </div>
        ) : null}

        {metrics ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Metric
                label="Tek kopya"
                sub="benzersiz dosya"
                value={formatNumber(metrics.totalBlobs)}
              />
              <Metric
                label="Toplam boyut"
                sub="diskte"
                value={formatBytes(metrics.totalBytesStored)}
              />
              <Metric
                accent
                label="Kazanılan"
                sub="tekrar eden görseller"
                value={formatBytes(metrics.bytesSaved)}
              />
              <Metric
                label="Dedupe"
                sub="bayt tasarrufu"
                value={formatPercent(metrics.dedupeRate)}
              />
            </div>

            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-2 text-[10px] text-[color:var(--muted)]">
                <span>Mantıksal boyut</span>
                <span className="tabular-nums">{formatBytes(logical)}</span>
              </div>
              <div
                aria-label={`Depolanan ${formatBytes(stored)}, kazanılan ${formatBytes(saved)}`}
                className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[color:var(--soft)]"
                role="img"
              >
                <span
                  className="h-full bg-[color:var(--border-strong)]"
                  style={{ width: `${Math.max(0, 100 - savedShare * 100)}%` }}
                />
                <span
                  className="h-full bg-[color:var(--accent)]"
                  style={{ width: `${savedShare * 100}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[color:var(--muted)]">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--border-strong)]" />
                  diskte {formatBytes(stored)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                  kazanılan {formatBytes(saved)}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--soft)] px-2.5 py-2 text-[11px]">
              <Icon className="shrink-0 text-[color:var(--accent)]" name="download" size={14} />
              <span>
                Son 24 saatte{" "}
                <strong className="font-semibold tabular-nums">
                  {formatNumber(metrics.fetches24h)}
                </strong>{" "}
                görsel açıldı
              </span>
              <span className="ml-auto text-[10px] text-[color:var(--muted)]">
                {formatClock(metrics.generatedAt)}
              </span>
            </div>

            <div className="mt-3 rounded-lg border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--accent-dark)]">
                <Icon name="copy" size={13} />
                Aynı görsel, tek dosya
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[color:var(--text)]">
                Aynı görsel 3 sohbette 4 kez paylaşılsa da diskte tek dosya
                durur. Alıcı yalnızca açtığı görseli indirir; cihazda LRU
                önbellek tutulur.
              </p>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  En çok paylaşılanlar
                </h3>
                <span className="text-[10px] text-[color:var(--muted)]">
                  {formatNumber(metrics.totalReferences)} bağlantı
                </span>
              </div>

              {metrics.topBlobs.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-[color:var(--border)] px-3 py-4 text-center text-[11px] text-[color:var(--muted)]">
                  Henüz medya yok. İlk görseli bir sohbete ekle.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {metrics.topBlobs.map((blob) => (
                    <li
                      className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] p-1.5"
                      key={blob.id}
                    >
                      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-[color:var(--soft)]">
                        <BlobImage alt="En çok paylaşılan görsel" id={blob.id} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-[11px] font-medium">
                          {formatNumber(blob.refCount)} paylaşım
                          {blob.refCount > 1 ? (
                            <span className="rounded bg-[color:var(--accent-soft)] px-1 py-0.5 text-[9px] font-semibold text-[color:var(--accent-dark)]">
                              tek dosya
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-[color:var(--muted)]">
                          {formatBytes(blob.size)} ·{" "}
                          {formatBytes(blob.wouldBeBytes - blob.size)} kazanç
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[9px] text-[color:var(--muted)]">
                        {blob.id.slice(0, 6)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-[color:var(--border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <Icon name="database" size={13} />
                  Cihaz önbelleği
                </h3>
                <span className="text-[10px] tabular-nums text-[color:var(--muted)]">
                  {formatBytes(cache.bytes)} / {formatBytes(cache.maxBytes)}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--soft)]">
                <span
                  className="block h-full rounded-full bg-[color:var(--accent)] transition-[width]"
                  style={{ width: `${Math.max(cache.bytes > 0 ? 2 : 0, cacheShare * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-[color:var(--muted)]">
                {formatNumber(cache.entries)} öğe · en son kullanılmayan önce
                silinir (LRU)
                {cache.evictions > 0
                  ? ` · ${formatNumber(cache.evictions)} çıkarıldı`
                  : ""}
              </p>
            </div>
          </>
        ) : null}

        {error ? (
          <div
            className="mt-3 rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-2.5 py-2 text-[11px] text-[color:var(--danger-text)]"
            role="status"
          >
            <p>{error}</p>
            <button
              className="mt-1.5 font-medium underline underline-offset-2"
              onClick={() => void load()}
              type="button"
            >
              Tekrar dene
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({
  label,
  sub,
  value,
  accent = false,
}: {
  label: string;
  sub: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-lg border p-2.5",
        accent
          ? "border-[color:var(--accent-border)] bg-[color:var(--accent-soft)]"
          : "border-[color:var(--border)]",
      ].join(" ")}
    >
      <p className="text-[10px] font-medium text-[color:var(--muted)]">{label}</p>
      <p
        className={[
          "mt-0.5 truncate text-lg font-semibold tracking-tight tabular-nums",
          accent ? "text-[color:var(--accent-dark)]" : "text-[color:var(--text)]",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[9px] text-[color:var(--muted)]">{sub}</p>
    </div>
  );
}
