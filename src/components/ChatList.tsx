"use client";

import type { ChatSummary } from "@shared/types";
import {
  excerpt,
  formatNumber,
  formatRelativeTime,
  initials,
} from "@/lib/format";
import { Icon } from "./ui/Icon";

export interface ChatListProps {
  chats: ChatSummary[] | null;
  activeId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRetry: () => void;
}

export function ChatList({
  chats,
  activeId,
  loading,
  error,
  onSelect,
  onNewChat,
  onRetry,
}: ChatListProps) {
  return (
    <section
      aria-busy={loading || undefined}
      aria-labelledby="sohbetler-baslik"
      className="flex h-full max-h-[22rem] min-h-0 flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] xl:max-h-none"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--border)] px-3 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold" id="sohbetler-baslik">
            Sohbetler
          </h2>
          {chats ? (
            <span className="text-[11px] tabular-nums text-[color:var(--muted)]">
              {formatNumber(chats.length)}
            </span>
          ) : null}
        </div>
        <button
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[color:var(--accent)] hover:bg-[color:var(--accent-soft)]"
          onClick={onNewChat}
          type="button"
        >
          <Icon name="plus" size={14} />
          Yeni
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {error ? (
          <div className="m-2 rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] p-3 text-xs text-[color:var(--danger-text)]">
            <p>{error}</p>
            <button
              className="mt-2 font-medium underline underline-offset-2"
              onClick={onRetry}
              type="button"
            >
              Tekrar dene
            </button>
          </div>
        ) : null}

        {loading && !chats ? (
          <div aria-hidden="true" className="space-y-1.5 p-1">
            {[0, 1, 2].map((item) => (
              <div className="flex gap-2.5 rounded-lg p-2" key={item}>
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-[color:var(--soft)]" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-2.5 w-2/3 animate-pulse rounded bg-[color:var(--soft)]" />
                  <div className="h-2 w-full animate-pulse rounded bg-[color:var(--soft)]" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && chats && chats.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <Icon name="chat" size={20} />
            </span>
            <p className="mt-3 text-sm font-medium">Henüz sohbet yok</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
              İlk sohbeti açıp aynı görseli birkaç kez paylaş.
            </p>
            <button
              className="mt-3 text-xs font-medium text-[color:var(--accent)] underline underline-offset-2"
              onClick={onNewChat}
              type="button"
            >
              Sohbet oluştur
            </button>
          </div>
        ) : null}

        <ul className="space-y-0.5">
          {chats?.map((chat) => {
            const active = chat.id === activeId;
            const last = chat.lastMessage;
            const preview = last
              ? last.body.trim().length > 0
                ? excerpt(last.body)
                : last.hasBlob
                  ? "Görsel"
                  : "Mesaj"
              : "Henüz mesaj yok";

            return (
              <li key={chat.id}>
                <button
                  aria-current={active ? "true" : undefined}
                  className={[
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                    active
                      ? "bg-[color:var(--accent-soft)]"
                      : "hover:bg-[color:var(--soft)]",
                  ].join(" ")}
                  onClick={() => onSelect(chat.id)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
                      active
                        ? "bg-[color:var(--accent)] text-white"
                        : "bg-[color:var(--soft)] text-[color:var(--muted)]",
                    ].join(" ")}
                  >
                    {initials(chat.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">
                        {chat.name}
                      </span>
                      {last ? (
                        <span className="shrink-0 text-[10px] text-[color:var(--muted)]">
                          {formatRelativeTime(last.createdAt)}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[color:var(--muted)]">
                      {last?.hasBlob ? <Icon name="image" size={11} /> : null}
                      <span className="truncate">{preview}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="shrink-0 border-t border-[color:var(--border)] px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[10px] leading-4 text-[color:var(--muted)]">
          <Icon className="text-[color:var(--accent)]" name="copy" size={12} />
          Gerçek mesajlar, tek görsel dosyası.
        </p>
      </div>
    </section>
  );
}
