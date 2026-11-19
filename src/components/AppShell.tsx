"use client";

import type {
  ChatSummary,
  ChatsResponse,
  CreateMessageResponse,
  MessageDto,
  MessagesResponse,
} from "@shared/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ChatList } from "./ChatList";
import { ChatView } from "./ChatView";
import { DeleteMessageModal } from "./DeleteMessageModal";
import { ImageModal, type ImageView } from "./ImageModal";
import type { ComposerPayload } from "./MessageComposer";
import { NewChatModal } from "./NewChatModal";
import { StoragePanel } from "./StoragePanel";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

export function AppShell() {
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [messages, setMessages] = useState<MessageDto[] | null>(null);
  const [messagesChatId, setMessagesChatId] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messagesRevision, setMessagesRevision] = useState(0);

  const [metricsSignal, setMetricsSignal] = useState(0);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MessageDto | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [imageView, setImageView] = useState<ImageView | null>(null);

  const refreshChats = useCallback(async (initial = false) => {
    if (initial) setChatsLoading(true);
    try {
      const response = await apiFetch<ChatsResponse>("/api/chats");
      setChats(response.chats);
      setChatsError(null);
      setActiveId((current) => {
        if (current && response.chats.some((chat) => chat.id === current)) {
          return current;
        }
        return response.chats[0]?.id ?? null;
      });
    } catch (caught) {
      setChatsError(
        caught instanceof Error ? caught.message : "Sohbetler yüklenemedi.",
      );
    } finally {
      if (initial) setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshChats(true);
  }, [refreshChats]);

  useEffect(() => {
    if (!activeId) {
      setMessages(null);
      setMessagesChatId(null);
      setMessagesError(null);
      setMessagesLoading(false);
      return;
    }

    const controller = new AbortController();
    setMessagesLoading(true);
    setMessagesError(null);

    apiFetch<MessagesResponse>(
      `/api/chats/${encodeURIComponent(activeId)}/messages`,
      { signal: controller.signal },
    )
      .then((response) => {
        setMessages(response.messages);
        setMessagesChatId(response.chat.id);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setMessagesError(
          caught instanceof Error ? caught.message : "Mesajlar yüklenemedi.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setMessagesLoading(false);
      });

    return () => controller.abort();
  }, [activeId, messagesRevision]);

  const activeChat = useMemo(
    () => chats?.find((chat) => chat.id === activeId) ?? null,
    [activeId, chats],
  );

  const visibleMessages = activeId && messagesChatId === activeId ? messages : null;

  const handleSend = useCallback(
    async (payload: ComposerPayload): Promise<void> => {
      if (!activeId) throw new Error("Önce bir sohbet seç.");
      await apiFetch<CreateMessageResponse>(
        `/api/chats/${encodeURIComponent(activeId)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            sender: "Sen",
            body: payload.body,
            ...(payload.blob ? { blob: payload.blob } : {}),
          }),
        },
      );
      setMessagesRevision((current) => current + 1);
      setMetricsSignal((current) => current + 1);
      void refreshChats();
    },
    [activeId, refreshChats],
  );

  const handleDeleteRequest = useCallback((message: MessageDto) => {
    setDeleteError(null);
    setDeleteTarget(message);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deletePending) return;
    setDeletePending(true);
    setDeleteError(null);

    try {
      await apiFetch(`/api/messages/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setMessagesRevision((current) => current + 1);
      setMetricsSignal((current) => current + 1);
      void refreshChats();
    } catch (caught) {
      setDeleteError(
        caught instanceof Error ? caught.message : "Mesaj silinemedi.",
      );
    } finally {
      setDeletePending(false);
    }
  }, [deletePending, deleteTarget, refreshChats]);

  const handleChatCreated = useCallback(
    (chat: ChatSummary) => {
      setChats((current) => [
        chat,
        ...(current ?? []).filter((item) => item.id !== chat.id),
      ]);
      setActiveId(chat.id);
      setNewChatOpen(false);
      void refreshChats();
    },
    [refreshChats],
  );

  const handleDownloadCounted = useCallback(() => {
    setMetricsSignal((current) => current + 1);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col xl:h-dvh xl:overflow-hidden">
      <header className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto flex w-full max-w-[94rem] items-center gap-3 px-3 py-2.5 sm:px-4">
          <span
            aria-hidden="true"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent)] text-white"
          >
            <Icon name="copy" size={20} />
            <span className="absolute -right-1.5 -top-1.5 rounded bg-[color:var(--text)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
              1×
            </span>
          </span>

          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Tek Kopya</p>
            <p className="hidden text-[11px] text-[color:var(--muted)] sm:block">
              Bir görsel, tek dosya. Her sohbette aynı içerik.
            </p>
          </div>

          <span className="ml-2 hidden items-center gap-1.5 rounded-md border border-[color:var(--border)] px-2 py-1 text-[10px] font-medium text-[color:var(--muted)] md:inline-flex">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
            Yerel demo · SQLite
          </span>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-[10px] text-[color:var(--muted)] sm:flex">
              <Icon name="lock" size={11} />
              Sunucuda şifreleme yok
            </span>
            <Button onClick={() => setNewChatOpen(true)} size="sm">
              <Icon name="plus" size={14} />
              Yeni sohbet
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[94rem] flex-1 flex-col px-3 pb-4 pt-3 sm:px-4 xl:min-h-0">
        <div className="grid flex-1 gap-3 xl:min-h-0 xl:grid-cols-[16.5rem_minmax(0,1fr)_21rem]">
          <ChatList
            activeId={activeId}
            chats={chats}
            error={chatsError}
            loading={chatsLoading}
            onNewChat={() => setNewChatOpen(true)}
            onRetry={() => void refreshChats(true)}
            onSelect={setActiveId}
          />

          <ChatView
            chat={activeChat ? { id: activeChat.id, name: activeChat.name } : null}
            error={messagesError}
            loading={messagesLoading || (chatsLoading && !activeChat)}
            messages={visibleMessages}
            onDelete={handleDeleteRequest}
            onOpenImage={(message) => {
              if (message.blob) {
                setImageView({ blob: message.blob, sender: message.sender });
              }
            }}
            onRetry={() => setMessagesRevision((current) => current + 1)}
            onSend={handleSend}
          />

          <div className="min-h-0 xl:h-full">
            <StoragePanel refreshSignal={metricsSignal} />
          </div>
        </div>
      </main>

      <NewChatModal
        onCreated={handleChatCreated}
        onOpenChange={setNewChatOpen}
        open={newChatOpen}
      />

      <DeleteMessageModal
        error={deleteError}
        message={deleteTarget}
        onConfirm={() => void handleDeleteConfirm()}
        onOpenChange={(open) => {
          if (!open && !deletePending) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        pending={deletePending}
      />

      <ImageModal
        onClose={() => setImageView(null)}
        onFetched={handleDownloadCounted}
        view={imageView}
      />
    </div>
  );
}
