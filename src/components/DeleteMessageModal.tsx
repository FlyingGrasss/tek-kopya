"use client";

import type { MessageDto } from "@shared/types";
import { excerpt } from "@/lib/format";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

export interface DeleteMessageModalProps {
  message: MessageDto | null;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function DeleteMessageModal({
  message,
  pending,
  error,
  onConfirm,
  onOpenChange,
}: DeleteMessageModalProps) {
  return (
    <Modal
      description={
        message?.blob
          ? "Görsel başka mesajlarda kullanılıyorsa dosya diskte kalır; son referans silinince temizlenir."
          : "Bu işlem geri alınamaz."
      }
      dismissible={!pending}
      footer={
        <>
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="secondary"
          >
            Vazgeç
          </Button>
          <Button
            loading={pending}
            onClick={onConfirm}
            type="button"
            variant="danger"
          >
            Mesajı sil
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      open={message !== null}
      size="sm"
      title="Mesajı sil"
    >
      {message ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--soft)] p-3">
            <p className="text-xs font-semibold">{message.sender}</p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--text)]">
              {message.body.trim().length > 0
                ? excerpt(message.body, 140)
                : "Görselli mesaj"}
            </p>
          </div>
          {error ? (
            <p className="text-xs text-[color:var(--danger-text)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
