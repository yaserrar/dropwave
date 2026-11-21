import { createHmac, randomInt } from 'node:crypto';
import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { MailService, type Email } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { S3Service } from '../src/s3/s3.service.js';
import { TasksService } from '../src/tasks/tasks.service.js';
import { readZip } from './support/read-zip.js';

const MB = 1024 * 1024;

/** S3 in memory: what the browser "uploaded", and what the API deleted. */
const objects = new Map<string, Buffer>();
const fakeS3: Partial<S3Service> = {
  buildFileKey: (id) => `uploads/${id}`,
  createUploadUrl: async ({ key }) => `https://s3.test/${key}?put`,
  createDownloadUrl: async ({ key, expiresIn }) =>
    `https://s3.test/${key}?expires=${expiresIn}`,
  getObjectInfo: async (key) => {
    const body = objects.get(key);
    return body ? { size: body.length, contentType: undefined } : null;
  },
  getObjectStream: async (key) => {
    const body = objects.get(key);
    if (!body) throw new Error(`NoSuchKey: ${key}`);
    return Readable.from([body]);
  },
  deleteObject: async (key) => void objects.delete(key),
  deleteObjects: async (keys) => {
    keys.forEach((key) => objects.delete(key));
    return { deleted: keys, errors: [] };
  },
};

const sentEmails: { to: string; email: Email }[] = [];
const fakeMail: Partial<MailService> = {
  send: async (to, email) => {
    sentEmails.push({ to, email });
    return 'message-id';
  },
};

/** A different client IP per call, so the per-IP throttles don't get in the way. */
const anyIp = () => `203.0.113.${randomInt(1, 255)}`;

type NewFile = { path: string; contentType?: string; body: Buffer };
type Created = {
  dropId: string;
  uploadToken: string;
  files: { id: string; path: string; uploadUrl: string }[];
};

describe.skipIf(!process.env.E2E_DATABASE_URL)('drops (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const created: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(S3Service)
      .useValue(fakeS3)
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma?.drop.deleteMany({ where: { id: { in: created } } });
    await app?.close();
  });

  const api = () => request(app.getHttpServer());

  async function createDrop(
    files: NewFile[],
    options: { password?: string; burnAfterDownload?: boolean } = {},
  ): Promise<Created> {
    const res = await api()
      .post('/api/drops')
      .set('cf-connecting-ip', anyIp())
      .send({
        files: files.map((file) => ({
          path: file.path,
          contentType: file.contentType ?? 'text/plain',
          size: file.body.length,
        })),
        ...options,
      })
      .expect(201);
    created.push(res.body.dropId);
    return res.body as Created;
  }

  /** The Lambda's verdict, signed like apps/file-check does. */
  async function scanResult(fileId: string, verdict: 'clean' | 'rejected') {
    const body = JSON.stringify({
      key: `uploads/${fileId}`,
      verdict,
      reason:
        verdict === 'rejected' ? 'Content does not match its type' : undefined,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', 'e2e-scan-result-secret')
      .update(`${timestamp}.${body}`)
      .digest('hex');
    await api()
      .post('/api/internal/scan-result')
      .set('content-type', 'application/json')
      .set('x-dropwave-timestamp', timestamp)
      .set('x-dropwave-signature', `sha256=${signature}`)
      .send(body)
      .expect(204);
  }

  /** Creates a drop and takes every file through upload, confirm and a clean check. */
  async function uploadDrop(
    files: NewFile[],
    options: { password?: string; burnAfterDownload?: boolean } = {},
  ) {
    const drop = await createDrop(files, options);
    for (const [index, file] of drop.files.entries()) {
      objects.set(`uploads/${file.id}`, files[index]!.body);
      await api()
        .post(`/api/drops/${drop.dropId}/files/${file.id}/confirm`)
        .set('x-upload-token', drop.uploadToken)
        .expect(201);
      await scanResult(file.id, 'clean');
    }
    return drop;
  }

  async function unlockCookie(dropId: string, password: string) {
    const res = await api()
      .post(`/api/drops/${dropId}/unlock`)
      .set('cf-connecting-ip', anyIp())
      .send({ password })
      .expect(200);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    return { res, cookie: cookie.split(';')[0]!, header: cookie };
  }

  const zipOf = (res: request.Response) => readZip(res.body as Buffer);
  const binary = (
    res: request.Response,
    done: (error: Error | null, body: Buffer) => void,
  ) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  };

  describe('bundles', () => {
    it('stays hidden until every file is confirmed, then lists them', async () => {
      const drop = await createDrop([
        { path: 'trip/notes.txt', body: Buffer.from('notes') },
        { path: 'trip/photos/a.txt', body: Buffer.from('a') },
      ]);
      const [first, second] = drop.files;

      await api().get(`/api/drops/${drop.dropId}`).expect(404);

      // The share link alone can't touch the upload routes.
      await api()
        .post(`/api/drops/${drop.dropId}/files/${first!.id}/upload-url`)
        .expect(401);
      await api()
        .post(`/api/drops/${drop.dropId}/files/${first!.id}/upload-url`)
        .set('x-upload-token', drop.uploadToken)
        .expect(201);

      objects.set(`uploads/${first!.id}`, Buffer.from('notes'));
      objects.set(`uploads/${second!.id}`, Buffer.from('a'));
      for (const file of drop.files) {
        await api()
          .post(`/api/drops/${drop.dropId}/files/${file.id}/confirm`)
          .set('x-upload-token', drop.uploadToken)
          .expect(201);
      }

      const scanning = await api().get(`/api/drops/${drop.dropId}`).expect(200);
      expect(
        scanning.body.files.map((f: { status: string }) => f.status),
      ).toEqual(['SCANNING', 'SCANNING']);

      await scanResult(first!.id, 'clean');
      await scanResult(second!.id, 'rejected');
      const info = await api().get(`/api/drops/${drop.dropId}`).expect(200);
      expect(info.body).toMatchObject({ locked: false, protected: false });
      expect(info.body.files).toEqual([
        expect.objectContaining({ path: 'trip/notes.txt', status: 'UPLOADED' }),
        expect.objectContaining({
          path: 'trip/photos/a.txt',
          status: 'REMOVED',
        }),
      ]);
    });

    it('drops a file removed during the upload', async () => {
      const drop = await createDrop([
        { path: 'a.txt', body: Buffer.from('a') },
        { path: 'b.txt', body: Buffer.from('b') },
      ]);
      const [kept, removed] = drop.files;
      await api()
        .delete(`/api/drops/${drop.dropId}/files/${removed!.id}`)
        .set('x-upload-token', drop.uploadToken)
        .expect(204);
      objects.set(`uploads/${kept!.id}`, Buffer.from('a'));
      await api()
        .post(`/api/drops/${drop.dropId}/files/${kept!.id}/confirm`)
        .set('x-upload-token', drop.uploadToken)
        .expect(201);
      await scanResult(kept!.id, 'clean');

      const info = await api().get(`/api/drops/${drop.dropId}`).expect(200);
      expect(info.body.files.map((f: { path: string }) => f.path)).toEqual([
        'a.txt',
      ]);
    });

    it('refuses unsafe paths, duplicates and drops over the limits', async () => {
      const file = (path: string, size = 10) => ({
        path,
        contentType: 'text/plain',
        size,
      });
      const post = (files: object[]) =>
        api()
          .post('/api/drops')
          .set('cf-connecting-ip', anyIp())
          .send({ files });

      await post([file('../secrets.txt')]).expect(400);
      await post([file('a.txt'), file('A.TXT')]).expect(400);
      // The zip couldn't be extracted: "notes" can't be a file and a folder.
      await post([file('notes'), file('notes/b.txt')]).expect(400);
      await post(Array.from({ length: 21 }, (_, i) => file(`${i}.txt`))).expect(
        400,
      );
      // Each under 20 MB, but 120 MB together.
      await post(
        Array.from({ length: 6 }, (_, i) => file(`${i}.bin`, 20 * MB)),
      ).expect(400);
      await post([file('big.bin', 20 * MB + 1)]).expect(400);
    });

    it('streams "Download all" as a zip of every available file', async () => {
      const drop = await uploadDrop([
        {
          path: 'site/index.html',
          contentType: 'text/html',
          body: Buffer.from('<h1>hi</h1>'),
        },
        {
          path: 'site/img/logo.png',
          contentType: 'image/png',
          body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        },
      ]);

      const res = await api()
        .get(`/api/drops/${drop.dropId}/download`)
        .buffer(true)
        .parse(binary)
        .expect(200);
      expect(res.headers['content-type']).toBe('application/zip');
      expect(res.headers['content-disposition']).toContain(
        'filename="site.zip"',
      );

      const entries = zipOf(res);
      expect(entries.map((e) => e.name)).toEqual([
        'site/img/logo.png',
        'site/index.html',
      ]);
      expect(entries[1]!.data.toString()).toBe('<h1>hi</h1>');
      expect(
        entries[0]!.data.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      ).toBe(true);
    });
  });

  describe('password-protected links', () => {
    it('shows nothing but the lock until the right password is entered', async () => {
      const drop = await uploadDrop(
        [
          {
            path: 'payslip-march.pdf',
            contentType: 'application/pdf',
            body: Buffer.from('%PDF-1.7'),
          },
        ],
        { password: 'open sesame' },
      );
      const fileId = drop.files[0]!.id;

      const locked = await api().get(`/api/drops/${drop.dropId}`).expect(200);
      expect(locked.body).toEqual({
        id: drop.dropId,
        protected: true,
        burnAfterDownload: false,
        expiresAt: null,
        locked: true,
      });
      expect(JSON.stringify(locked.body)).not.toContain('payslip');

      await api()
        .get(`/api/drops/${drop.dropId}/files/${fileId}/preview`)
        .expect(401);
      await api()
        .get(`/api/drops/${drop.dropId}/files/${fileId}/download`)
        .expect(401);
      await api().get(`/api/drops/${drop.dropId}/download`).expect(401);

      const wrong = await api()
        .post(`/api/drops/${drop.dropId}/unlock`)
        .send({ password: 'open sesam' })
        .expect(401);
      expect(wrong.body).toMatchObject({
        reason: 'wrong-password',
        attemptsLeft: 4,
      });

      const { res, cookie, header } = await unlockCookie(
        drop.dropId,
        'open sesame',
      );
      expect(new Date(res.body.unlockedUntil).getTime()).toBeGreaterThan(
        Date.now() + 14 * 60_000,
      );
      expect(header).toContain(`Path=/api/drops/${drop.dropId}`);
      expect(header).toContain('HttpOnly');
      expect(header).toContain('SameSite=Strict');

      const open = await api()
        .get(`/api/drops/${drop.dropId}`)
        .set('cookie', cookie)
        .expect(200);
      expect(open.body.files[0]).toMatchObject({
        filename: 'payslip-march.pdf',
      });
      await api()
        .get(`/api/drops/${drop.dropId}/files/${fileId}/download`)
        .set('cookie', cookie)
        .expect(302);

      // The token is tied to its drop: it doesn't open another protected link.
      const other = await uploadDrop(
        [{ path: 'x.txt', body: Buffer.from('x') }],
        {
          password: 'open sesame',
        },
      );
      const elsewhere = await api()
        .get(`/api/drops/${other.dropId}`)
        .set('cookie', cookie)
        .expect(200);
      expect(elsewhere.body.locked).toBe(true);
    });

    it('stops guessing after 5 wrong passwords, from any number of IPs', async () => {
      const drop = await uploadDrop(
        [{ path: 'a.txt', body: Buffer.from('a') }],
        {
          password: 'right one',
        },
      );
      const attempt = (password: string) =>
        api()
          .post(`/api/drops/${drop.dropId}/unlock`)
          .set('cf-connecting-ip', anyIp())
          .send({ password });

      // Fired together: the limit holds even when the guesses race.
      const results = await Promise.all(
        Array.from({ length: 7 }, (_, i) => attempt(`guess ${i}`)),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);

      // Even the right password waits for the window to end.
      const blocked = await attempt('right one').expect(429);
      expect(blocked.body.message).toMatch(/Try again in \d+ minutes?/);
    });

    it('emails a protected link without naming the file or sending the password', async () => {
      const drop = await uploadDrop(
        [
          {
            path: 'tax-return.pdf',
            contentType: 'application/pdf',
            body: Buffer.from('%PDF'),
          },
        ],
        {
          password: 'hunter22',
        },
      );
      sentEmails.length = 0;
      await api()
        .post(`/api/drops/${drop.dropId}/share`)
        .set('cf-connecting-ip', anyIp())
        .send({ emails: ['friend@example.com'] })
        .expect(201);

      expect(sentEmails).toHaveLength(1);
      const { subject, text, html } = sentEmails[0]!.email;
      for (const part of [subject, text, html]) {
        expect(part).not.toContain('tax-return');
        expect(part).not.toContain('hunter22');
      }
      expect(text).toContain(`/s/${drop.dropId}`);
    });
  });

  describe('delete after the first download', () => {
    it('lets exactly one of two simultaneous downloads through', async () => {
      const drop = await uploadDrop(
        [{ path: 'once.txt', body: Buffer.from('once') }],
        {
          burnAfterDownload: true,
        },
      );
      const fileId = drop.files[0]!.id;

      // No preview: the content can only be fetched by its one download.
      await api()
        .get(`/api/drops/${drop.dropId}/files/${fileId}/preview`)
        .expect(400);

      const download = () =>
        api()
          .get(`/api/drops/${drop.dropId}/files/${fileId}/download`)
          .redirects(0);
      const [a, b] = await Promise.all([download(), download()]);
      expect([a.status, b.status].sort()).toEqual([302, 410]);
      const winner = a.status === 302 ? a : b;
      // The presigned URL can be reused until it expires, so it only lasts a minute.
      expect(winner.headers.location).toContain('expires=60');

      const after = await api().get(`/api/drops/${drop.dropId}`).expect(410);
      expect(after.body.reason).toBe('consumed');
    });

    it("isn't used up by HEAD requests (link checkers, download managers)", async () => {
      const single = await uploadDrop(
        [{ path: 'once.txt', body: Buffer.from('once') }],
        { burnAfterDownload: true },
      );
      const bundle = await uploadDrop(
        [
          { path: 'a.txt', body: Buffer.from('a') },
          { path: 'b.txt', body: Buffer.from('b') },
        ],
        { burnAfterDownload: true },
      );

      const head = await api()
        .head(
          `/api/drops/${single.dropId}/files/${single.files[0]!.id}/download`,
        )
        .redirects(0)
        .expect(200);
      expect(head.headers.location).toBeUndefined();
      const zipHead = await api()
        .head(`/api/drops/${bundle.dropId}/download`)
        .expect(200);
      expect(zipHead.headers['content-type']).toBe('application/zip');

      await api().get(`/api/drops/${single.dropId}`).expect(200);
      await api().get(`/api/drops/${bundle.dropId}`).expect(200);
      for (const file of bundle.files) {
        expect(objects.has(`uploads/${file.id}`)).toBe(true);
      }
    });

    it('is used up by "Download all" on a bundle, which deletes the files', async () => {
      const drop = await uploadDrop(
        [
          { path: 'a.txt', body: Buffer.from('a') },
          { path: 'b.txt', body: Buffer.from('b') },
        ],
        { burnAfterDownload: true, password: 'both options' },
      );
      const { cookie } = await unlockCookie(drop.dropId, 'both options');

      // One download for the whole link: single files would use it up early.
      await api()
        .get(`/api/drops/${drop.dropId}/files/${drop.files[0]!.id}/download`)
        .set('cookie', cookie)
        .expect(400);

      const zips = await Promise.all(
        [0, 1].map(() =>
          api()
            .get(`/api/drops/${drop.dropId}/download`)
            .set('cookie', cookie)
            .buffer(true)
            .parse(binary),
        ),
      );
      expect(zips.map((r) => r.status).sort()).toEqual([200, 410]);
      const zip = zips.find((r) => r.status === 200)!;
      expect(zipOf(zip).map((e) => e.name)).toEqual(['a.txt', 'b.txt']);

      for (const file of drop.files) {
        expect(objects.has(`uploads/${file.id}`)).toBe(false);
      }
      const rows = await prisma.file.findMany({
        where: { dropId: drop.dropId },
      });
      expect(rows.every((row) => row.status === 'DELETED')).toBe(true);
    });

    it("leaves a zip's files to the zip, however long it streams", async () => {
      const zipped = await uploadDrop(
        [
          { path: 'a.txt', body: Buffer.from('a') },
          { path: 'b.txt', body: Buffer.from('b') },
        ],
        { burnAfterDownload: true },
      );
      const single = await uploadDrop(
        [{ path: 'once.txt', body: Buffer.from('once') }],
        { burnAfterDownload: true },
      );
      // Both used up 5 minutes ago: well past the single file's one-minute URL,
      // while a slow client may still be reading the zip.
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await prisma.drop.update({
        where: { id: zipped.dropId },
        data: { consumedAt: fiveMinutesAgo, consumedBy: 'ZIP' },
      });
      await prisma.drop.update({
        where: { id: single.dropId },
        data: { consumedAt: fiveMinutesAgo, consumedBy: 'FILE' },
      });

      await app.get(TasksService).purgeDownloadedDrops();

      expect(objects.has(`uploads/${single.files[0]!.id}`)).toBe(false);
      for (const file of zipped.files) {
        expect(objects.has(`uploads/${file.id}`)).toBe(true);
      }
    });
  });
});
