import type { ImageMime } from "./constants";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    field?: string;
    retryAfterMs?: number;
  };
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "ORIGIN_REJECTED"
  | "CHAT_EXISTS"
  | "INTERNAL_ERROR";

export interface BlobMeta {
  id: string;
  mime: ImageMime;
  size: number;
  refCount: number;
  createdAt: number;
}

export interface MessageDto {
  id: number;
  chatId: string;
  sender: string;
  body: string;
  createdAt: number;
  blob: BlobMeta | null;
}

export interface ChatLastMessage {
  id: number;
  sender: string;
  body: string;
  createdAt: number;
  hasBlob: boolean;
}

export interface ChatSummary {
  id: string;
  name: string;
  createdAt: number;
  messageCount: number;
  lastMessage: ChatLastMessage | null;
}

export interface ChatsResponse {
  chats: ChatSummary[];
}

export interface MessagesResponse {
  chat: { id: string; name: string; createdAt: number };
  messages: MessageDto[];
}

export interface CreateChatResponse {
  chat: ChatSummary;
}

export interface CreateMessageResponse {
  messageId: number;
  blobId: string | null;
  deduped: boolean;
}

export interface DeleteMessageResponse {
  messageId: number;
  blobId: string | null;
  blobDeleted: boolean;
  refCount: number | null;
}

export interface TopBlob extends BlobMeta {
  wouldBeBytes: number;
}

export interface MetricsResponse {
  totalBlobs: number;
  totalReferences: number;
  totalBytesStored: number;
  bytesSaved: number;
  dedupeRate: number;
  fetches24h: number;
  topBlobs: TopBlob[];
  generatedAt: number;
}
