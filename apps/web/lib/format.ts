const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** 1536 → "1.5 KB". `digits` applies from KB upward. */
export function formatBytes(bytes: number, digits = 1): string {
  if (bytes < 1024) return `${bytes} B`;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 100 ? 0 : digits)} ${UNITS[exponent]}`;
}
