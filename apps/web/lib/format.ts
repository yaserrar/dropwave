const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** 1536 → "1.5 KB". `digits` applies from KB upward. */
export function formatBytes(bytes: number, digits = 1): string {
  if (bytes < 1024) return `${bytes} B`;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 100 ? 0 : digits)} ${UNITS[exponent]}`;
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 hours ago", "in 2 days", "just now". */
export function formatRelativeTime(date: string | Date, now = Date.now()): string {
  const seconds = Math.round((new Date(date).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** Short label for a file type: the extension ("PDF"), else the MIME subtype. */
export function fileTypeLabel(filename: string, contentType: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop() : undefined;
  if (ext && ext.length <= 5) return ext.toUpperCase();
  return contentType.split("/").pop()?.toUpperCase() ?? "FILE";
}
