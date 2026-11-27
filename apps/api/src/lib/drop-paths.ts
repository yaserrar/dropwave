import { MAX_PATH_LENGTH } from './consts.js';

const MAX_SEGMENT_LENGTH = 255; // most file systems' limit for one name

/**
 * A file's path inside its drop, as sent by the browser ("photos/2024/a.jpg"),
 * made safe to show and to use as a zip entry: forward slashes only, no empty,
 * "." or ".." segments, no control characters. Null when nothing valid is left,
 * or the path tries to leave its folder.
 */
export function normalizeRelativePath(input: string): string | null {
  // Control characters would hide parts of the name or break headers and logs.
  if (/\p{Cc}/u.test(input)) return null;

  const segments: string[] = [];
  for (const segment of input.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') return null;
    if (segment.trim() === '' || segment.length > MAX_SEGMENT_LENGTH)
      return null;
    segments.push(segment);
  }

  const path = segments.join('/');
  if (!path || path.length > MAX_PATH_LENGTH) return null;
  return path;
}

/** "photos/2024/a.jpg" → "a.jpg". */
export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** The folder every path starts with, when the drop is one folder ("photos"); else null. */
export function sharedFolder(paths: string[]): string | null {
  const [first] = paths;
  if (!first || !first.includes('/')) return null;
  const folder = first.slice(0, first.indexOf('/'));
  return paths.every((path) => path.startsWith(`${folder}/`)) ? folder : null;
}

/** How a drop is named in emails: the file's name, the folder's name, or "3 files". */
export function dropTitle(paths: string[]): string {
  if (paths.length === 1) return baseName(paths[0]!);
  return sharedFolder(paths) ?? `${paths.length} files`;
}

/** Name of the "Download all" zip: the folder's name, or one tied to the link. */
export function zipFileName(paths: string[], dropId: string): string {
  const folder = sharedFolder(paths);
  if (folder) return `${folder}.zip`;
  if (paths.length === 1) {
    const name = baseName(paths[0]!);
    const dot = name.lastIndexOf('.');
    return `${dot > 0 ? name.slice(0, dot) : name}.zip`;
  }
  return `dropwave-${dropId.slice(0, 8)}.zip`;
}

/** "photos/2024/a.jpg" → ["photos", "photos/2024"]. */
function foldersOf(path: string): string[] {
  const segments = path.split('/').slice(0, -1);
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
}

/**
 * Paths that can't sit side by side once the zip is extracted, ignoring case like
 * macOS and Windows do: the same path twice ("Photo.jpg" and "photo.jpg"), or a
 * file named like a folder of another file ("notes" and "notes/a.txt").
 */
export function findPathConflict(
  paths: string[],
): { path: string; kind: 'duplicate' | 'file-and-folder' } | null {
  const files = new Set<string>();
  const folders = new Set(
    paths.flatMap((path) => foldersOf(path.toLowerCase())),
  );
  for (const path of paths) {
    const key = path.toLowerCase();
    if (folders.has(key)) return { path, kind: 'file-and-folder' };
    if (files.has(key)) return { path, kind: 'duplicate' };
    files.add(key);
  }
  return null;
}

// `filename` is the ASCII fallback for old clients; `filename*` carries the real
// UTF-8 name so names like "résumé.pdf" survive the download.
export function contentDisposition(
  filename: string,
  disposition: 'attachment' | 'inline',
): string {
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
