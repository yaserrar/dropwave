# file-check (AWS Lambda)

Runs when a file lands in `s3://dropwave/uploads/`. It first checks the real size
(from the S3 event, so nothing is downloaded), then reads the first 4 KB, detects the
real format with [`file-type`](https://github.com/sindresorhus/file-type) and compares
it with the declared `Content-Type`. It then reports to the API:

- **clean:** the size is within the limit, and the content matches or it's text (which
  has no signature).
- **rejected:** the file is empty or over 10 MB, the content contradicts the declared
  type (an `.exe` sent as a PDF), or it's a Windows, Linux or macOS executable.

The size check matters because a presigned PUT accepts a body of any size: the API only
validated the size the browser declared. `MAX_FILE_SIZE` in `src/check.ts` must match the
one in `apps/api/src/lib/consts.ts`.

This checks file types, not viruses. The rules are in [`src/check.ts`](src/check.ts).

```
browser ──PUT──▶ S3 uploads/<id> ──event──▶ Lambda file-check ──signed POST──▶ API /api/internal/scan-result
```

## Develop

```sh
npm run test -w file-check          # rules, against real file signatures
npm run package -w file-check       # esbuild bundle → apps/file-check/dist/function.zip
```

## Deploy (first time, in the AWS console)

Everything goes in **eu-west-3 (Paris)**, the bucket's region: S3 can only trigger
functions in its own region.

1. **Secret.** Run `openssl rand -hex 32`. The same value goes in the Lambda (step 4) and
   in the API's `.env.api` as `SCAN_RESULT_SECRET`.
2. **Create the function.** Lambda → **Create function** → *Author from scratch*:
   - Name `dropwave-file-check`, runtime **Node.js 24.x**, architecture **arm64**
     (cheaper; the bundle is plain JavaScript).
   - Permissions: *Create a new role with basic Lambda permissions* (CloudWatch Logs).
3. **Let it read uploads.** IAM → Roles → the role just created → **Add permissions →
   Create inline policy** → JSON:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::dropwave/uploads/*"
     }]
   }
   ```
4. **Code and settings.** In the function:
   - **Code → Upload from → .zip file** → `apps/file-check/dist/function.zip`.
   - **Runtime settings → Edit** → handler `index.handler`.
   - **Configuration → General** → timeout **15 s**, memory **256 MB**.
   - **Configuration → Environment variables:**
     | Key | Value |
     |---|---|
     | `SCAN_RESULT_URL` | `https://dropwave.asrar.software/api/internal/scan-result` |
     | `SCAN_RESULT_SECRET` | the value from step 1 |
5. **Trigger.** **Add trigger → S3**: bucket `dropwave`, event types *All object create
   events*, prefix `uploads/`. AWS warns about recursive invocation; it doesn't apply here,
   because the function only reads from the bucket.
6. **Watch it.** Upload a file on the site, then **Monitor → View CloudWatch logs**. Each
   file logs one JSON line with its verdict.

### Updating the code later

```sh
npm run package -w file-check
aws lambda update-function-code --region eu-west-3 \
  --function-name dropwave-file-check \
  --zip-file fileb://apps/file-check/dist/function.zip
```

This needs the AWS CLI configured with your own (admin) credentials, not the app's.

## What the API endpoint must do

`POST /api/internal/scan-result` receives:

```json
{ "key": "uploads/<id>", "verdict": "clean" | "rejected", "reason": "…", "declaredType": "…", "detectedType": "…" }
```

with headers `x-dropwave-timestamp` (Unix seconds) and
`x-dropwave-signature: sha256=<hex>`, where the hex is HMAC-SHA256 of
`` `${timestamp}.${rawBody}` `` with `SCAN_RESULT_SECRET`.

- **Verify before anything else.** Compute the HMAC over the **raw** body (create the app
  with `NestFactory.create(AppModule, { rawBody: true })` and use `req.rawBody`), compare
  with `timingSafeEqual`, and reject timestamps older than 5 minutes. Answer 401 on failure.
- **Results can arrive before `/confirm`.** The S3 event fires as soon as the upload ends,
  often before the browser confirms. Store the verdict on the row (e.g. a `scanVerdict`
  column) whatever the status. `/confirm` then sets `UPLOADED` if the verdict is already
  clean, or `SCANNING` otherwise, and this endpoint moves `SCANNING` → `UPLOADED` when a
  clean result arrives.
- **Rejected files:** delete the S3 object and set the status to `REMOVED`.
- **Duplicates are normal:** S3 and Lambda deliver at least once, so applying the same
  result twice must be harmless.
- **Skip rate limiting** on this route (`@SkipThrottle()`): a burst of uploads shouldn't
  turn into 429s and Lambda retries.
- Any non-2xx answer makes the Lambda fail, and Lambda retries the event twice before
  giving up.
