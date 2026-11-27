import { inflateRawSync } from 'node:zlib';

export type ZipFileEntry = { name: string; stored: boolean; data: Buffer };

/**
 * Reads a whole zip from its central directory, like an unzip tool does, so tests
 * check the archive a user would really open. Enough for archiver's output: no
 * zip64, no encryption, "store" or "deflate" only.
 */
export function readZip(zip: Buffer): ZipFileEntry[] {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end === -1) throw new Error('No end of central directory: not a zip');
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);

  const entries: ZipFileEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Broken central directory');
    }
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);

    const dataStart =
      localOffset +
      30 +
      zip.readUInt16LE(localOffset + 26) +
      zip.readUInt16LE(localOffset + 28);
    const raw = zip.subarray(dataStart, dataStart + compressedSize);
    entries.push({
      name,
      stored: method === 0,
      data: method === 0 ? Buffer.from(raw) : inflateRawSync(raw),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
