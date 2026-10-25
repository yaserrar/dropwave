# Dropwave

Drop a file, get a private link to share it. No sign-up.

**Live:** [dropwave.asrar.software](https://dropwave.asrar.software)

- Upload files up to 10 MB, with an optional link expiry (5 minutes to 30 days).
- Share page with a preview for images, PDFs and text, and a download button.
- Email the link to up to 5 people, from the upload page or the share page.
- Every upload is checked by an AWS Lambda: its real size, and whether its content matches its declared type. Executables are rejected.
- Expired files are deleted automatically.

## How it works

File bytes never pass through the API. The browser uploads straight to S3 with a presigned URL, and the API only keeps track of each file.

```
Browser ─(1) POST /api/files/generate ─────────────▶ API ──▶ Postgres   row: PENDING
Browser ◀──── presigned PUT URL (valid 60 s) ─────── API
Browser ─(2) PUT the file ─────────────────────────▶ S3  uploads/<id>
S3 ──────(3) object created ───────────────────────▶ Lambda file-check
Lambda ──(4) signed POST /api/internal/scan-result ▶ API   clean or rejected
Browser ─(5) POST /api/files/<id>/confirm ─────────▶ API   PENDING → SCANNING → UPLOADED
```

Steps 4 and 5 can arrive in either order. Whichever comes last makes the file available.

1. **Upload URL.** The API validates the name, type and declared size, creates the row, and returns a presigned PUT URL. S3 only accepts the upload with the same `Content-Type`.
2. **File check.** S3 triggers the [`file-check`](apps/file-check) Lambda. It first checks the object's real size, which comes in the S3 event, because a presigned PUT accepts a body of any size. Then it reads the first 4 KB and detects the real format with [`file-type`](https://github.com/sindresorhus/file-type). Files that are empty, over 10 MB, executables, or whose content contradicts their declared type are rejected. It checks file types; it isn't an antivirus.
3. **Signed result.** The Lambda reports to the API with an HMAC-SHA256 signature over a timestamp and the raw body. The API compares it in constant time and refuses results older than 5 minutes, so a captured request can't be replayed.
4. **Confirm.** The browser confirms the upload. The API checks that the size in S3 matches the declared size.
5. **Outcome.** A clean file becomes `UPLOADED`. A rejected one is deleted from S3 and marked `REMOVED`. Downloads redirect to a short-lived presigned GET URL.

| Status     | Meaning                                       |
| ---------- | --------------------------------------------- |
| `PENDING`  | Upload URL issued, upload not confirmed yet   |
| `SCANNING` | Confirmed, waiting for the Lambda's verdict   |
| `UPLOADED` | Passed the check; can be downloaded or shared |
| `REMOVED`  | Failed the check; the S3 object is deleted    |

A cron job in the API deletes expired files every 10 minutes, S3 objects first and then their rows.

## API

| Method | Route                       | Does                                                                    |
| ------ | --------------------------- | ----------------------------------------------------------------------- |
| `POST` | `/api/files/generate`       | Creates the file and returns an upload URL (3 per minute per IP)        |
| `POST` | `/api/files/:id/confirm`    | Checks the uploaded size and starts waiting for the check               |
| `GET`  | `/api/files/:id`            | File info for the share page                                            |
| `GET`  | `/api/files/:id/preview`    | URL that displays an image, PDF or text file                            |
| `GET`  | `/api/files/:id/download`   | Redirects to a download URL                                             |
| `POST` | `/api/files/:id/share`      | Emails the link to up to 5 addresses (5 requests per 10 minutes per IP) |
| `POST` | `/api/internal/scan-result` | Verdicts from the Lambda; HMAC-signed                                   |

The other public routes allow 20 requests per minute per IP, and the Lambda's route isn't rate-limited. Behind Cloudflare, the client IP comes from `CF-Connecting-IP`.

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
  api/          NestJS API: files, S3, emails, file-check results, cleanup cron
  file-check/   AWS Lambda that checks every upload (has its own README)
packages/
  eslint-config/, typescript-config/   shared config
deploy/infra/   Traefik, Postgres, pgAdmin, backups and Dozzle for the server
docker-compose.yml   the app stack (api + web) that CI deploys
DEPLOY.md            server setup, step by step
```

## Running locally

You need Node.js 24+ with npm 11, a PostgreSQL database, and an AWS account with:

- **An S3 bucket.** Its CORS rule must allow `http://localhost:3000` (see [DEPLOY.md](DEPLOY.md#4-s3-cors)).
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
   # Links in emails point here.
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

Locally, uploads stay in `SCANNING` unless a file-check Lambda can reach your API: it reports to the URL in its `SCAN_RESULT_URL`. To try the rest of the flow, mark a file as checked in your database:

```sql
UPDATE files SET status = 'UPLOADED' WHERE id = '<id>';
```

### Checks

```sh
npm run lint                  # every app
npm run check-types           # web and file-check
npm run test -w file-check    # the Lambda's rules, against real file signatures
```

## Deploying

Every push to `main` builds the `api` and `web` images, pushes them to GHCR, and restarts the stack on the server. The API applies pending database migrations when it starts.

- **[DEPLOY.md](DEPLOY.md):** the one-time server setup, covering EC2, Cloudflare DNS, the IAM role, Traefik, Postgres and GitHub secrets.
- **[apps/file-check/README.md](apps/file-check/README.md):** deploying the Lambda and wiring it to the bucket.

## License

[MIT](LICENSE)
