# Dropwave

Drop a file, a few, or a whole folder, get one private link to share it. No sign-up.

**Live:** [dropwave.asrar.software](https://dropwave.asrar.software)

- One link for up to 20 files (or a folder): 20 MB per file, 100 MB in all, 3 uploads at a time with progress per file.
- Optional link expiry (5 minutes to 30 days), password, and "delete after the first download".
- Share page with the files as a tree, a preview for images, PDFs and text, a download per file, and "Download all" as a zip.
- Email the link to up to 5 people, from the upload page or the share page.
- Every file is checked by an AWS Lambda: its real size, and whether its content matches its declared type. Executables are rejected.
- Expired links are deleted automatically, files and all.

## How it works

What one link shares is a **drop**: one file, several files, or a folder, each file with its path inside the drop (`photos/2024/a.jpg`). Everything dropped (or picked, or pasted) at once becomes one drop. The link is `/s/<drop id>`, and expiry, password and "delete after the first download" apply to the whole drop.

Upload bytes never pass through the API. The browser uploads straight to S3 with presigned URLs, and the API only keeps track of each file.

```
Browser ─(1) POST /api/drops ──────────────────────▶ API ──▶ Postgres   drop + files: PENDING
Browser ◀──── upload token + a PUT URL per file ──── API
Browser ─(2) PUT each file, 3 at a time ───────────▶ S3  uploads/<file id>
S3 ──────(3) object created ───────────────────────▶ Lambda file-check   (per file)
Lambda ──(4) signed POST /api/internal/scan-result ▶ API   clean or rejected
Browser ─(5) POST /api/drops/<id>/files/<file>/confirm ▶ API   PENDING → SCANNING → UPLOADED
```

Steps 4 and 5 can arrive in either order. Whichever comes last makes the file available.

1. **Upload URLs.** The API checks the paths, types and declared sizes (at most 20 files, 20 MB each, 100 MB together; no path twice, ignoring case, and no file named like a folder of another, since the zip couldn't be extracted), creates the drop and its files, and returns a presigned PUT URL per file (valid 60 s) and an upload token. S3 only accepts each upload with the same `Content-Type`. A file whose turn comes after its URL expired asks for a fresh one. The upload routes need the token (`x-upload-token`), so the share link alone can't add, replace or remove files.
2. **File check.** S3 triggers the [`file-check`](apps/file-check) Lambda. It first checks the object's real size, which comes in the S3 event, because a presigned PUT accepts a body of any size. Then it reads the first 4 KB and detects the real format with [`file-type`](https://github.com/sindresorhus/file-type). Files that are empty, over 20 MB, executables, or whose content contradicts their declared type are rejected. It checks file types; it isn't an antivirus.
3. **Signed result.** The Lambda reports to the API with an HMAC-SHA256 signature over a timestamp and the raw body. The API compares it in constant time and refuses results older than 5 minutes, so a captured request can't be replayed.
4. **Confirm.** The browser confirms each upload. The API checks that the size in S3 matches the declared size. A file that fails to upload, or that the user removes from the list, is taken out of the drop (`DELETED`).

Uploads start as soon as files are dropped, so the link is ready in seconds. Any file can be removed from the list while the drop uploads; once the link is ready, uploaded files can still be removed from it (deleted from S3) as long as one stays, for as long as the page keeps the upload token (1 hour).
5. **Outcome.** A clean file becomes `UPLOADED`. A rejected one is deleted from S3 and marked `REMOVED`: the share page lists it as removed, and the drop's other files stay available. A drop stays hidden (404) while any of its files is `PENDING`, so a link never shows a half-finished upload. Downloads redirect to a short-lived presigned GET URL; "Download all" streams a zip from the API.

| Status     | Meaning                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `PENDING`  | Upload URL issued, upload not confirmed yet                                                    |
| `SCANNING` | Confirmed, waiting for the Lambda's verdict                                                    |
| `UPLOADED` | Passed the check; can be downloaded or shared                                                  |
| `REMOVED`  | Failed the check; the S3 object is deleted                                                     |
| `DELETED`  | Taken out of its drop, or downloaded from a burn-after-download link; the S3 object is deleted |

A cron job in the API deletes expired drops every 10 minutes: every file's S3 object first, then the rows. Another, every minute, deletes the files of burn-after-download links downloaded one file at a time, once the download URL has expired (2 minutes after the download). A "Download all" zip deletes its files itself when it ends, so a slow client is never cut off; that job only sweeps up after a zip cut short by a restart, 6 hours later (`Drop.consumedBy` says which download used the link).

Links created before drops existed were migrated to one-file drops whose id is the file's id, so `/s/<id>` links already sent keep working.

### Password-protected links

- Only a **scrypt** hash of the password is stored (random salt, N=16384, r=8, p=1), compared in constant time. The password is 4 to 128 characters.
- Until it's entered, the API answers the share page with the bare minimum: that the link is protected, when it expires, and whether it works once. No names, sizes or file count. Previews, downloads and "Download all" answer `401`.
- `POST /api/drops/:id/unlock` checks the password and sets an **unlock cookie**: an HMAC-signed token (drop id + expiry) valid **15 minutes**, `HttpOnly`, `SameSite=Strict`, `Secure` over HTTPS, and scoped to `Path=/api/drops/<id>`, so it only goes to that link's routes. Plain `<a href>` downloads carry it too. When it expires, the page asks for the password again.
- Guessing is limited twice: **5 wrong passwords per link per 10 minutes**, whoever sends them (counted atomically in Postgres, so parallel guesses can't slip through), and 10 attempts per IP per 10 minutes across all links. The flip side: someone with the link can lock the recipient out for 10 minutes by guessing.
- Emailing a protected link names nothing and never includes the password (the API doesn't have it). Send it some other way.
- The token key is derived from `SCAN_RESULT_SECRET` with a fixed label, so tokens can't be confused with scan-result signatures and no new secret is needed. Rotating that secret logs every browser out of protected links.

### Delete after the first download

- The first download **consumes** the drop atomically: one `UPDATE … WHERE consumedAt IS NULL`. Of two downloads at the same moment, exactly one wins; the other gets `410`, and the share page then says the files were already downloaded.
- One file: the download consumes the drop and redirects to a presigned GET URL that lasts **60 seconds**. A presigned URL can be reused until it expires, so "once" means one URL, valid for one minute: whoever holds it can fetch the file again during that minute. The object is deleted once that minute is over (cron, every minute).
- Several files: only **"Download all"** is offered, and it consumes the drop. Per-file downloads would use the link up on the first file. The zip streams through the API, so the files are deleted as soon as it ends, however long it takes. If S3 fails before the first byte, the drop isn't consumed and the download can be retried; once bytes were sent, an interrupted download still uses the link up and deletes the files.
- **No previews**, so the content is fetched exactly once, by its download.
- `HEAD` requests (link checkers, proxies, download managers) run the download's checks without using the link up, and get no download URL.

### Download all

`GET /api/drops/:id/download` streams a zip of every available file under its path (named after the folder, or `dropwave-<id>.zip`). It reads one S3 object at a time and pipes it through [archiver](https://github.com/archiverjs/node-archiver) with backpressure, so memory stays flat whatever the size. Already-compressed formats (JPEG, PNG, PDF, Office, video…) are stored as they are; the rest is deflated. It's available once no file is still being checked.

## API

| Method   | Route                                     | Does                                                                            |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| `POST`   | `/api/drops`                              | Creates a drop: upload URLs and an upload token (3 per minute per IP)           |
| `POST`   | `/api/drops/:id/files/:fileId/upload-url` | A fresh upload URL for a file still pending (upload token)                      |
| `POST`   | `/api/drops/:id/files/:fileId/confirm`    | Checks the uploaded size and starts waiting for the check (upload token)        |
| `DELETE` | `/api/drops/:id/files/:fileId`            | Takes a file out of its drop (upload token)                                     |
| `GET`    | `/api/drops/:id`                          | Info for the share page; only "protected" and the expiry until unlocked         |
| `POST`   | `/api/drops/:id/unlock`                   | Checks the password, sets the unlock cookie (see above for the limits)          |
| `GET`    | `/api/drops/:id/files/:fileId/preview`    | URL that displays an image, PDF or text file (not on burn-after-download links) |
| `GET`    | `/api/drops/:id/files/:fileId/download`   | Redirects to a download URL (`HEAD`: the checks only, never uses the link up)   |
| `GET`    | `/api/drops/:id/download`                 | "Download all": streams a zip (`HEAD`: the checks and headers only)             |
| `POST`   | `/api/drops/:id/share`                    | Emails the link to up to 5 addresses (5 requests per 10 minutes per IP)         |
| `POST`   | `/api/internal/scan-result`               | Verdicts from the Lambda; HMAC-signed                                           |

The upload-token routes allow 60 requests per minute per IP (a drop has up to 20 files), the other public routes 20, and the Lambda's route isn't rate-limited. Behind Cloudflare, the client IP comes from `CF-Connecting-IP`. A `410` carries a `reason`: `expired`, or `consumed` for a burn-after-download link already used.

## Stack

| Part       | Built with                                                                              |
| ---------- | --------------------------------------------------------------------------------------- |
| Web        | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, TanStack Query, Motion                 |
| API        | NestJS 12, Prisma 7, PostgreSQL, pino structured logs                                   |
| File check | AWS Lambda (Node.js 24, arm64), bundled with esbuild                                    |
| AWS        | S3 (storage), SES (emails), IAM role on EC2, so no access keys on the server            |
| Hosting    | Docker Compose on EC2, Traefik with Let's Encrypt, Cloudflare in front, Dozzle for logs |
| CI/CD      | GitHub Actions: lint, build images to GHCR, deploy over SSH                             |
| Monorepo   | Turborepo with npm workspaces, TypeScript everywhere                                    |

## Repository layout

```
apps/
  web/          Next.js app: upload page and share page (/s/<id>)
  api/          NestJS API: drops and files, S3, zips, emails, file-check results, cleanup crons
  file-check/   AWS Lambda that checks every upload (has its own README)
packages/
  eslint-config/, typescript-config/   shared config
deploy/infra/   Traefik, Postgres, pgAdmin, backups and Dozzle for the server
docker-compose.yml   the app stack (api + web) that CI deploys
DEPLOY.md            server setup, step by step
```

## Running locally

You need Node.js 24+ with npm 11, a PostgreSQL database, and an AWS account with:

- **An S3 bucket.** Its CORS rule must allow `http://localhost:3000` (see [DEPLOY.md](DEPLOY.md#4-s3-cors)), or whichever origin the web app runs on.
- **Credentials** that can put, get and delete objects in the bucket, and send email with SES.
- **A domain or address verified in SES** to send from. While SES is in sandbox mode, it only sends to verified addresses.

1. Install the dependencies:

   ```sh
   npm install
   ```

2. Create `apps/api/.env`:

   ```sh
   PORT=4000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dropwave
   AWS_REGION=eu-west-3
   S3_BUCKET=your-bucket
   # Locally only; on EC2 the instance's IAM role provides credentials.
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   # openssl rand -hex 32; the Lambda signs its results with the same value.
   SCAN_RESULT_SECRET=...
   # Links in emails point here. Also the only origin allowed to call the API
   # with cookies (the unlock cookie), so it must be the web app's origin.
   APP_URL=http://localhost:3000
   MAIL_FROM=Dropwave <noreply@your-domain.com>
   ```

3. Create `apps/web/.env`:

   ```sh
   NEXT_PUBLIC_API_URL=http://localhost:4000/api
   ```

4. Generate the Prisma client and create the tables:

   ```sh
   cd apps/api
   npx prisma generate
   npx prisma migrate deploy
   cd ../..
   ```

5. Start the web app (port 3000) and the API (port 4000):

   ```sh
   npm run dev
   ```

Locally, uploads stay in `SCANNING` unless a file-check Lambda can reach your API: it reports to the URL in its `SCAN_RESULT_URL`. To try the rest of the flow, play the Lambda: post a verdict signed with your local `SCAN_RESULT_SECRET` (the file id is in the `POST /api/drops` response):

```sh
body='{"key":"uploads/<file id>","verdict":"clean"}'
ts=$(date +%s)
sig=$(printf '%s.%s' "$ts" "$body" | openssl dgst -sha256 -hmac "$SCAN_RESULT_SECRET" -hex | sed 's/.* //')
curl -X POST http://localhost:4000/api/internal/scan-result -H 'content-type: application/json' \
  -H "x-dropwave-timestamp: $ts" -H "x-dropwave-signature: sha256=$sig" -d "$body"
```

Or mark a file as checked in your database:

```sql
UPDATE files SET status = 'UPLOADED' WHERE id = '<id>';
```

### Checks

```sh
npm run lint                  # every app
npm run check-types           # web and file-check
npm run test -w file-check    # the Lambda's rules, against real file signatures
npm run test -w api           # tokens, password hashing, paths, zip streaming, emails
# Drops end to end (unlock, burn race, HEAD, purge timing, zip) against a throwaway database; S3 and SES are faked.
createdb dropwave_e2e
(cd apps/api && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dropwave_e2e npx prisma migrate deploy)
E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dropwave_e2e npm run test:e2e -w api
```

The e2e suite only runs when `E2E_DATABASE_URL` is set, and never touches the `DATABASE_URL` in `.env`.

## Deploying

Every push to `main` builds the `api` and `web` images, pushes them to GHCR, and restarts the stack on the server. The API applies pending database migrations when it starts.

- **[DEPLOY.md](DEPLOY.md):** the one-time server setup, covering EC2, Cloudflare DNS, the IAM role, Traefik, Postgres and GitHub secrets.
- **[apps/file-check/README.md](apps/file-check/README.md):** deploying the Lambda and wiring it to the bucket.

## License

[MIT](LICENSE)
