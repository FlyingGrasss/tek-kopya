"use client";

import {
  MAX_BLOB_BYTES,
  MAX_MESSAGE_BODY,
  type ImageMime,
} from "@shared/constants";
import { useEffect, useId, useRef, useState } from "react";
import { formatBytes } from "@/lib/format";
import { Icon } from "./ui/Icon";
import { Spinner } from "./ui/Spinner";

export interface ComposerImage {
  dataUrl: string;
  mime: ImageMime;
  name: string;
  size: number;
}

export interface ComposerPayload {
  body: string;
  blob?: { dataUrl: string; mime: ImageMime };
}

export interface MessageComposerProps {
  chatName: string;
  onSend: (payload: ComposerPayload) => Promise<void>;
}

const ACCEPTED_MIMES: readonly ImageMime[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

function normalizeMime(raw: string): ImageMime | null {
  const value = raw.toLowerCase();
  if (value === "image/jpg") return "image/jpeg";
  return (ACCEPTED_MIMES as readonly string[]).includes(value)
    ? (value as ImageMime)
    : null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Dosya okunamadı."));
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

export function MessageComposer({ chatName, onSend }: MessageComposerProps) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<ComposerImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
  }, [text]);

  const canSend = !pending && (text.trim().length > 0 || image !== null);

  async function handleFile(file: File): Promise<void> {
    setError(null);
    const mime = normalizeMime(file.type);
    if (!mime) {
      setError("Yalnızca PNG, JPEG, WebP ve GIF görselleri ekleyebilirsin.");
      return;
    }
    if (file.size > MAX_BLOB_BYTES) {
      setError(`Görsel en fazla ${formatBytes(MAX_BLOB_BYTES)} olabilir.`);
      return;
    }

    try {
      const dataUrl = await readAsDataUrl(file);
      if (!dataUrl.startsWith("data:image/")) {
        setError("Dosya bir görsel gibi okunamadı.");
        return;
      }
      setImage({ dataUrl, mime, name: file.name, size: file.size });
    } catch {
      setError("Dosya okunamadı. Tekrar dene.");
    }
  }

  async function handleSubmit(): Promise<void> {
    if (pending) return;
    if (!canSend) {
      setError("Bir mesaj yaz veya görsel ekle.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      await onSend({
        body: text.trim(),
        ...(image
          ? { blob: { dataUrl: image.dataUrl, mime: image.mime } }
          : {}),
      });
      setText("");
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Mesaj gönderilemedi. Tekrar dene.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 pb-3 pt-2.5 sm:px-4">
      {image ? (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--soft)] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local FileReader preview */}
          <img
            alt="Seçilen görselin önizlemesi"
            className="h-14 w-14 shrink-0 rounded-md object-cover"
            src={image.dataUrl}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{image.name}</p>
            <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
              {formatBytes(image.size)} · gönderince içerik adıyla saklanacak
            </p>
          </div>
          <button
            aria-label="Seçilen görseli kaldır"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]"
            disabled={pending}
            onClick={() => setImage(null)}
            type="button"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2 transition-colors focus-within:border-[color:var(--border-strong)]">
        <button
          aria-label="Görsel ekle"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--soft)] hover:text-[color:var(--accent)] disabled:pointer-events-none disabled:opacity-45"
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
          title="Görsel ekle"
          type="button"
        >
          <Icon name="paperclip" size={18} />
        </button>
        <input
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          id={`${inputId}-file`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />

        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={inputId}>
            {chatName} sohbetine mesaj
          </label>
          <textarea
            aria-describedby={error ? errorId : hintId}
            aria-invalid={error ? true : undefined}
            className="max-h-36 min-h-6 w-full resize-none bg-transparent py-0.5 text-sm leading-6 outline-none placeholder:text-[color:var(--muted)] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending}
            id={inputId}
            maxLength={MAX_MESSAGE_BODY}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Bir mesaj yaz…"
            rows={1}
            value={text}
          />
        </div>

        <button
          aria-label="Mesajı gönder"
          aria-busy={pending || undefined}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[color:var(--accent)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[color:var(--accent-hover)] disabled:pointer-events-none disabled:opacity-45"
          disabled={!canSend}
          onClick={() => void handleSubmit()}
          type="button"
        >
          {pending ? <Spinner label="Gönderiliyor" /> : <Icon name="send" size={15} />}
          <span className="hidden sm:inline">Gönder</span>
        </button>
      </div>

      <div className="mt-1.5 flex min-h-4 items-start justify-between gap-3 text-[11px] text-[color:var(--muted)]">
        {error ? (
          <p className="flex min-w-0 items-start gap-1.5 text-[color:var(--danger-text)]" id={errorId} role="alert">
            <Icon className="mt-0.5 shrink-0" name="alert" size={12} />
            <span>{error}</span>
          </p>
        ) : pending ? (
          <p id={hintId} role="status">
            Görsel içerik adına göre tek dosyaya indirgeniyor…
          </p>
        ) : (
          <p className="min-w-0 truncate" id={hintId}>
            Enter ile gönder · Shift+Enter yeni satır · görsel en fazla 2 MB
          </p>
        )}
        {text.length > 1800 ? (
          <span className="shrink-0 tabular-nums">
            {text.length}/{MAX_MESSAGE_BODY}
          </span>
        ) : null}
      </div>
    </div>
  );
}
