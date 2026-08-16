export function formatDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(epochMs));
}

export function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

export function yearOf(epochMs: number): number {
  return new Date(epochMs).getFullYear();
}

/** For <input type="datetime-local">, which needs local-time "YYYY-MM-DDTHH:mm" with no timezone offset. */
export function toDatetimeLocalValue(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): number {
  return new Date(value).getTime();
}

/** Parses "mm:ss" or "h:mm:ss" into seconds. Returns undefined for blank/invalid input. */
export function parseClearTime(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(":").map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p) || p < 0)) return undefined;
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return undefined;
}

/** Inclusive range check against a pair of <input type="date"> string values ("" = unbounded on that side). */
export function isWithinDateRange(
  epochMs: number,
  fromDate: string,
  toDate: string,
): boolean {
  if (fromDate) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    if (epochMs < from.getTime()) return false;
  }
  if (toDate) {
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    if (epochMs > to.getTime()) return false;
  }
  return true;
}

export function formatClearTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
