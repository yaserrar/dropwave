/**
 * Every value of the cookie `name` in a Cookie header. A browser sends several
 * cookies with the same name when their paths differ, so callers check each one.
 */
export function readCookies(
  header: string | undefined,
  name: string,
): string[] {
  if (!header) return [];
  const values: string[] = [];
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      values.push(decodeURIComponent(raw));
    } catch {
      // A malformed value can't be a token we issued; skip it.
    }
  }
  return values;
}
