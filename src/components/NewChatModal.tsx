"use client";

import { MAX_CHAT_NAME } from "@shared/constants";
import type { ChatSummary } from "@shared/types";
import { useEffect, useId, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

export interface NewChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (chat: ChatSummary) => void;
}

export function NewChatModal({ open, onOpenChange, onCreated }: NewChatModalProps) {
  const inputId = useId();
  const errorId = useId();
  const hintId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
    setPending(false);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Sohbet adı gerekli.");
      return;
    }
    if (trimmed.length > MAX_CHAT_NAME) {
      setError(`Sohbet adı en fazla ${MAX_CHAT_NAME} karakter olabilir.`);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await apiFetch<{ chat: ChatSummary }>("/api/chats", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      onCreated(response.chat);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Sohbet oluşturulamadı.",
      );
      setPending(false);
    }
  }

  return (
    <Modal
      description="Sohbet yalnızca bu tarayıcıdaki yerel demoya eklenir."
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
          <Button form="yeni-sohbet-form" loading={pending} type="submit">
            Sohbet oluştur
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      open={open}
      title="Yeni sohbet"
    >
      <form
        className="space-y-3"
        id="yeni-sohbet-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div>
          <label className="text-xs font-medium" htmlFor={inputId}>
            Sohbet adı
          </label>
          <input
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            className="mt-1.5 h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm outline-none transition-colors placeholder:text-[color:var(--muted)] focus:border-[color:var(--border-strong)]"
            data-autofocus
            disabled={pending}
            id={inputId}
            maxLength={MAX_CHAT_NAME}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Örn. Kamp grubu"
            value={name}
          />
          <p className="mt-1.5 text-[11px] text-[color:var(--muted)]" id={hintId}>
            1-{MAX_CHAT_NAME} karakter. Aynı ad iki kez kullanılamaz.
          </p>
          {error ? (
            <p className="mt-1.5 text-[11px] text-[color:var(--danger-text)]" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
