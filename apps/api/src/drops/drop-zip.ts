import { once } from 'node:events';
import type { Readable, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { ZipArchive } from 'archiver';

export type ZipEntry = {
  key: string;
  /** Path inside the zip, already normalized ("photos/a.jpg"). */
  path: string;
  contentType: string;
  date: Date;
};

// Already-compressed formats: deflating them again costs CPU and saves almost nothing.
const COMPRESSED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'application/pdf',
  'application/zip',
  'application/gzip',
  'application/x-7z-compressed',
  'application/vnd.rar',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export function isCompressedType(contentType: string): boolean {
  return (
    COMPRESSED_TYPES.has(contentType) ||
    contentType.startsWith('video/') ||
    contentType.startsWith('audio/')
  );
}

/**
 * Streams `entries` into `out` as a zip. Each body is opened only when its turn
 * comes and piped through with backpressure, so memory stays flat whatever the
 * total size, and no S3 connection sits idle waiting for its turn.
 *
 * The first body is opened before anything is written: if that fails, `out` is
 * untouched and the caller can still answer with a normal error. Resolves once
 * `out` has received the whole archive; rejects on any failure or when `signal`
 * aborts (the client went away).
 */
export async function writeZip(
  entries: ZipEntry[],
  openBody: (key: string) => Promise<Readable>,
  out: Writable,
  signal: AbortSignal,
): Promise<void> {
  if (entries.length === 0) throw new Error('A zip needs at least one entry');

  const archive = new ZipArchive({ zlib: { level: 6 } });
  let body: Readable | undefined;

  // Settles (rejects) as soon as the archive or a body fails, or the client goes
  // away; every wait below races it, so nothing hangs on a stream that will never
  // move again.
  let fail: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => (fail = reject));
  archive.on('error', fail);
  signal.addEventListener('abort', () => fail(signal.reason as Error), {
    once: true,
  });
  stopped.catch(() => {
    body?.destroy();
    archive.abort();
  });
  const untilStopped = <T>(promise: Promise<T>) =>
    Promise.race([promise, stopped]);

  const open = async (key: string) => {
    const opening = openBody(key);
    // If we stop while S3 is answering, close the body that arrives late.
    opening.then(
      (late) => signal.aborted && late.destroy(),
      () => {},
    );
    body = await untilStopped(opening);
    // archiver doesn't listen for errors on its sources: a broken S3 read would
    // otherwise be an uncaught error.
    body.on('error', fail);
    return body;
  };

  const first = await open(entries[0]!.key);
  archive.pipe(out);
  for (const [index, entry] of entries.entries()) {
    const source = index === 0 ? first : await open(entry.key);
    const appended = once(archive, 'entry');
    archive.append(source, {
      name: entry.path,
      date: entry.date,
      store: isCompressedType(entry.contentType),
    });
    await untilStopped(appended);
  }
  await untilStopped(Promise.all([archive.finalize(), finished(out)]));
}
