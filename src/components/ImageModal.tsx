"use client";

import type { BlobMeta } from "@shared/types";
import { formatBytes, formatNumber } from "@/lib/format";
import { useBlobUrl } from "@/lib/use-blob-url";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";
import { Spinner } from "./ui/Spinner";

export interface ImageView {
  blob: BlobMeta;
  sender: string;
}

export interface ImageModalProps {
  view: ImageView | null;
  onClose: () => void;
  onFetched: () => void;
}

export function ImageModal({ view, onClose, onFetched }: ImageModalProps) {
  return (
    <Modal
      description={
        view
          ? `${view.sender} · ${formatBytes(view.blob.size)} · ${formatNumber(view.blob.refCount)} paylaşım`
          : undefined
      }
      footer={
        <Button onClick={onClose} type="button" variant="secondary">
          Kapat
        </Button>
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={view !== null}
      size="lg"
      title="Görsel"
    >
      {view ? (
        <ImageBody
          key={view.blob.id}
          onFetched={onFetched}
          view={view}
        />
      ) : null}
    </Modal>
  );
}

function ImageBody({ view, onFetched }: { view: ImageView; onFetched: () => void }) {
  const { state, retry } = useBlobUrl(view.blob.id, "full", onFetched);

  return (
    <div>
      <div className="flex min-h-[16rem] items-center justify-center overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--soft)]">
        {state.status === "ready" ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL from the device cache
          <img
            alt={`${view.sender} tarafından gönderilen görselin tam boyutu`}
            className="max-h-[60dvh] w-full object-contain"
            src={state.url}
          />
        ) : state.status === "error" ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-xs text-[color:var(--danger-text)]">
            <Icon name="alert" size={20} />
            <p>Görsel yüklenemedi.</p>
            <button
              className="font-medium underline underline-offset-2"
              onClick={retry}
              type="button"
            >
              Tekrar dene
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-xs text-[color:var(--muted)]">
            <Spinner label="Görsel indiriliyor" />
            <p>Tam boy görsel indiriliyor…</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[color:var(--muted)]">
        <p className="flex items-center gap-1.5">
          <Icon name="download" size={12} />
          {state.status === "ready"
            ? "Bu açılış indirme olarak sayıldı."
            : "Açmak indirme olarak sayılır."}
        </p>
        <p className="font-mono">{view.blob.id.slice(0, 16)}…</p>
      </div>

      {view.blob.refCount > 1 ? (
        <p className="mt-2 rounded-lg border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-3 py-2 text-[11px] leading-5 text-[color:var(--text)]">
          Bu görsel {formatNumber(view.blob.refCount)} mesajda aynı dosyayı
          kullanıyor. Yeni kopya oluşmadı.
        </p>
      ) : null}
    </div>
  );
}
