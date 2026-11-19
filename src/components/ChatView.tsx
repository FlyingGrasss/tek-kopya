"use client";

import type { MessageDto } from "@shared/types";
import { useEffect, useRef } from "react";
import {
  formatBytes,
  formatClock,
  formatDateTime,
  formatNumber,
  initials,
  plural,
} from "@/lib/format";
import type { ComposerPayload } from "./MessageComposer";
import { MessageComposer } from "./MessageComposer";
import { BlobImage } from "./BlobImage";
import { Icon } from "./ui/Icon";

export interface ChatViewProps {
  chat: { id: string; name: string } | null;
  messages: MessageDto[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSend: (payload: ComposerPayload) => Promise<void>;
  onDelete: (message: MessageDto) => void;
  onOpenImage: (message: MessageDto) => void;
}

export function ChatView({
  chat,
  messages,
  loading,
  error,
  onRetry,
  onSend,
  onDelete,
  onOpenImage,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || loading) return;
    element.scrollTop = element.scrollHeight;
  }, [chat?.id, loading, messages?.length]);

  return (
    <section
      aria-label={chat ? `${chat.name} sohbeti` : "Sohbet"}
      className="flex h-[min(74dvh,46rem)] min-h-[30rem] flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] xl:h-full xl:min-h-0"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-[color:var(--border)] px-4 py-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--accent-soft)] text-sm font-semibold text-[color:var(--accent)]"
        >
          {chat ? initials(chat.name) : <Icon name="chat" size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">
            {chat ? chat.name : "Tek Kopya"}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[color:var(--muted)]">
            {messages
              ? plural(messages.length, "mesaj", "mesaj")
              : loading
                ? "Yükleniyor…"
                : "Sohbet seç"}
            {messages && messages.some((message) => message.blob) ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="copy" size={10} />
                  paylaşılan görseller tek dosya
                </span>
              </>
            ) : null}
          </p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-md border border-[color:var(--border)] px-2 py-1 text-[10px] font-medium text-[color:var(--muted)] sm:inline-flex">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
          sha256
        </span>
      </header>

      <div
        aria-busy={loading || undefined}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4"
        ref={scrollRef}
      >
        {error ? (
          <div className="mx-auto max-w-md rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] p-4 text-sm text-[color:var(--danger-text)]">
            <p className="flex items-start gap-2">
              <Icon className="mt-0.5 shrink-0" name="alert" size={16} />
              {error}
            </p>
            <button
              className="mt-2 text-xs font-medium underline underline-offset-2"
              onClick={onRetry}
              type="button"
            >
              Tekrar dene
            </button>
          </div>
        ) : null}

        {loading && !messages ? (
          <div aria-hidden="true" className="space-y-5">
            {[0, 1, 2].map((item) => (
              <div className="flex gap-3" key={item}>
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[color:var(--soft)]" />
                <div className="w-full max-w-sm space-y-2">
                  <div className="h-2.5 w-24 animate-pulse rounded bg-[color:var(--soft)]" />
                  <div className="h-3 w-full animate-pulse rounded bg-[color:var(--soft)]" />
                  <div className="h-24 w-44 animate-pulse rounded-lg bg-[color:var(--soft)]" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && messages && messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <Icon name="chat" size={22} />
            </span>
            <p className="mt-3 text-sm font-medium">İlk mesajı sen yaz</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[color:var(--muted)]">
              Bir görsel ekle, aynı görseli başka sohbette tekrar gönder.
              Depolama panelinde nasıl tek dosyada kaldığını gör.
            </p>
          </div>
        ) : null}

        {!loading && !chat ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--soft)] text-[color:var(--muted)]">
              <Icon name="copy" size={22} />
            </span>
            <p className="mt-3 text-sm font-medium">Bir sohbet seç</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[color:var(--muted)]">
              Soldan bir sohbet aç veya yeni bir sohbet oluştur. Aynı görseli
              birden fazla sohbette paylaşarak tek kopya tasarrufunu gör.
            </p>
          </div>
        ) : null}

        <ul className="space-y-4">
          {messages?.map((message) => {
            const hasBody = message.body.trim().length > 0;
            return (
              <li className="group flex gap-2.5 sm:gap-3" key={message.id}>
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--soft)] text-xs font-semibold text-[color:var(--muted)]"
                >
                  {initials(message.sender)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{message.sender}</span>
                    <time
                      className="text-[10px] text-[color:var(--muted)]"
                      dateTime={new Date(message.createdAt).toISOString()}
                      title={formatDateTime(message.createdAt)}
                    >
                      {formatClock(message.createdAt)}
                    </time>
                    <button
                      aria-label={`${message.sender} mesajını sil`}
                      className="ml-auto inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-[color:var(--muted)] opacity-60 transition-opacity hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger-text)] group-hover:opacity-100 focus:opacity-100"
                      onClick={() => onDelete(message)}
                      type="button"
                    >
                      <Icon name="trash" size={11} />
                      Sil
                    </button>
                  </div>

                  {hasBody ? (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-6 text-[color:var(--text)]">
                      {message.body}
                    </p>
                  ) : null}

                  {message.blob ? (
                    <div className="mt-2">
                      <button
                        aria-label={`${message.sender} görselini büyüt, ${formatBytes(message.blob.size)}`}
                        className="relative block h-32 w-48 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--soft)] text-left transition-colors hover:border-[color:var(--border-strong)] sm:h-36 sm:w-56"
                        onClick={() => onOpenImage(message)}
                        type="button"
                      >
                        <BlobImage
                          alt={`${message.sender} tarafından gönderilen görsel`}
                          id={message.blob.id}
                        />
                        <span className="pointer-events-none absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded bg-[rgba(255,255,255,0.9)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--text)]">
                          <Icon name="zoom" size={11} />
                          Aç
                        </span>
                      </button>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[color:var(--muted)]">
                        <span className="inline-flex items-center gap-1">
                          <Icon name="copy" size={10} />
                          {message.blob.refCount > 1
                            ? `${formatNumber(message.blob.refCount)} mesajda aynı dosya`
                            : "Tek referans"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatBytes(message.blob.size)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{message.blob.id.slice(0, 8)}</span>
                      </p>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {chat ? (
        <MessageComposer chatName={chat.name} onSend={onSend} />
      ) : (
        <div className="border-t border-[color:var(--border)] px-4 py-3 text-xs text-[color:var(--muted)]">
          Mesaj göndermek için bir sohbet seç.
        </div>
      )}
    </section>
  );
}
