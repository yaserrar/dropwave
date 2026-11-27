import { PassThrough, Readable } from 'node:stream';
import { readZip } from '../../test/support/read-zip.js';
import { isCompressedType, writeZip, type ZipEntry } from './drop-zip.js';

const date = new Date('2026-11-21T12:00:00Z');

function collect(stream: PassThrough): Promise<Buffer> {
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  return new Promise((resolve) =>
    stream.on('end', () => resolve(Buffer.concat(chunks))),
  );
}

describe('writeZip', () => {
  it('zips every entry under its path, opening bodies one at a time', async () => {
    const bodies: Record<string, Buffer> = {
      'uploads/1': Buffer.from('hello '.repeat(1000)),
      'uploads/2': Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
      'uploads/3': Buffer.from('{"ok":true}'),
    };
    const entries: ZipEntry[] = [
      {
        key: 'uploads/1',
        path: 'notes/hello.txt',
        contentType: 'text/plain',
        date,
      },
      {
        key: 'uploads/2',
        path: 'photos/a.jpg',
        contentType: 'image/jpeg',
        date,
      },
      {
        key: 'uploads/3',
        path: 'data.json',
        contentType: 'application/json',
        date,
      },
    ];

    let open = 0;
    let maxOpen = 0;
    const openBody = async (key: string) => {
      open += 1;
      maxOpen = Math.max(maxOpen, open);
      const body = Readable.from([bodies[key]!]);
      body.on('close', () => (open -= 1));
      return body;
    };

    const out = new PassThrough();
    const zip = collect(out);
    await writeZip(entries, openBody, out, new AbortController().signal);

    const files = readZip(await zip);
    expect(files.map((f) => f.name)).toEqual([
      'notes/hello.txt',
      'photos/a.jpg',
      'data.json',
    ]);
    for (const [index, file] of files.entries()) {
      expect(file.data.equals(bodies[entries[index]!.key]!)).toBe(true);
    }
    // JPEGs are stored as they are; text is deflated.
    expect(files[1]!.stored).toBe(true);
    expect(files[0]!.stored).toBe(false);
    expect(maxOpen).toBe(1);
  });

  it('fails before writing anything when the first body cannot be opened', async () => {
    const out = new PassThrough();
    let written = 0;
    out.on('data', (chunk: Buffer) => (written += chunk.length));

    await expect(
      writeZip(
        [{ key: 'uploads/x', path: 'x.txt', contentType: 'text/plain', date }],
        () => Promise.reject(new Error('NoSuchKey')),
        out,
        new AbortController().signal,
      ),
    ).rejects.toThrow('NoSuchKey');
    expect(written).toBe(0);
  });

  it('rejects when a body breaks mid-stream', async () => {
    const broken = new Readable({
      read() {
        this.destroy(new Error('connection reset'));
      },
    });
    const out = new PassThrough();
    out.resume();
    await expect(
      writeZip(
        [{ key: 'uploads/x', path: 'x.txt', contentType: 'text/plain', date }],
        async () => broken,
        out,
        new AbortController().signal,
      ),
    ).rejects.toThrow('connection reset');
  });

  it('stops and closes the body when the client goes away', async () => {
    // A body that never ends, like a slow S3 read.
    const body = new Readable({ read() {} });
    body.push(Buffer.alloc(1024));
    const abort = new AbortController();
    const out = new PassThrough();
    out.resume();

    const writing = writeZip(
      [
        {
          key: 'uploads/x',
          path: 'x.bin',
          contentType: 'application/octet-stream',
          date,
        },
      ],
      async () => body,
      out,
      abort.signal,
    );
    setTimeout(() => abort.abort(new Error('Client went away')), 20);

    await expect(writing).rejects.toThrow('Client went away');
    expect(body.destroyed).toBe(true);
  });
});

describe('isCompressedType', () => {
  it('stores formats that are already compressed', () => {
    expect(isCompressedType('image/png')).toBe(true);
    expect(isCompressedType('video/mp4')).toBe(true);
    expect(
      isCompressedType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe(true);
    expect(isCompressedType('text/plain')).toBe(false);
    expect(isCompressedType('image/svg+xml')).toBe(false);
  });
});
