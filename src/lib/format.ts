const BYTE_FORMAT = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${new Intl.NumberFormat("tr-TR").format(Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${BYTE_FORMAT.format(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${BYTE_FORMAT.format(bytes / (1024 * 1024))} MB`;
  }
  return `${BYTE_FORMAT.format(bytes / (1024 * 1024 * 1024))} GB`;
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return "%0";
  return `%${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 1,
  }).format(ratio * 100)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "az önce";
  if (diff < hour) return `${Math.floor(diff / minute)} dk önce`;
  if (diff < day) return `${Math.floor(diff / hour)} sa önce`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} gün önce`;
  return formatDateTime(timestamp);
}

export function initials(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase("tr-TR") : "?";
}

export function excerpt(value: string, max = 54): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}
