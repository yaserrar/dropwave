const UNITS = ['B', 'KB', 'MB', 'GB'];

/** 1536 → "1.5 KB", like formatBytes in the web app. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${UNITS[exponent]}`;
}
