# Deploying Dropwave to EC2

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. Builds the `api` and `web` images and pushes them to `ghcr.io/<owner>/dropwave-{api,web}`, tagged with the commit SHA and `latest`.
2. Copies [`docker-compose.yml`](docker-compose.yml) to the server, sets `IMAGE_TAG` to the new SHA, pulls, and restarts.

The API container applies pending Prisma migrations before it starts.

```
                                ┌──────────── EC2 ──────────────────────────────────────┐
 dropwave.asrar  ─▶ Cloudflare ─▶ Traefik :443 ─▶ /api/* ─▶ api  (Nest :4000) ─┐       │
 .software          (proxied)     (Let's Encrypt,  ─▶ /*  ─▶ web  (Next :3000)  │ data  │
                                │  DNS challenge)            "proxy" network    ▼       │
                                │                                          postgres     │
                                └───────────────────────────────────────────────────────┘
 Browser uploads and downloads go straight to S3 with presigned URLs.
```

Everything below is one-time setup.

## 1. EC2 instance

- Ubuntu 24.04, `t3.small` or bigger, with an **Elastic IP** so the address survives restarts.
- Security group inbound: **80** and **443** from anywhere, **22** from your IP only.
- Install Docker Engine and the Compose plugin ([official steps](https://docs.docker.com/engine/install/ubuntu/)), then let your user run Docker:
  ```sh
  sudo usermod -aG docker $USER   # log out and back in
  ```

## 2. DNS (Cloudflare)

In Cloudflare's DNS for `asrar.software`, add **A** records, **Proxied** (orange cloud), pointing at the Elastic IP:

| Name          | Value      |
| ------------- | ---------- |
| `dropwave`    | Elastic IP |
| `pgadmin-ec2` | Elastic IP |

- Keep every name **one level** under `asrar.software`. Cloudflare's free edge certificate only covers `*.asrar.software`, so a name like `ec2.pgadmin.asrar.software` gets a ⚠ in the dashboard and a certificate error in browsers.
- **SSL/TLS mode: Full (strict).** Traefik serves a real Let's Encrypt certificate, obtained through the Cloudflare DNS challenge, so Cloudflare can verify the origin.

## 3. S3 access from EC2 (IAM role, no keys on the server)

1. **IAM → Roles → Create role → AWS service → EC2.** Attach an inline policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::dropwave/uploads/*"
       }
     ]
   }
   ```
2. **EC2 → your instance → Actions → Security → Modify IAM role** and pick the role.
3. Let containers reach the instance metadata service. By default only the host can, and the AWS SDK inside Docker would then find no credentials:
   ```sh
   aws ec2 modify-instance-metadata-options --instance-id i-XXXXXXXX \
     --http-endpoint enabled --http-tokens required --http-put-response-hop-limit 2
   ```
   (Console: **Actions → Instance settings → Modify instance metadata options → hop limit 2**.)

With the role in place, leave `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` out of `.env.api`.

## 4. S3 CORS

Add the production origin to the bucket's CORS rule (**S3 → dropwave → Permissions → CORS**):

```json
"AllowedOrigins": ["http://localhost:3000", "https://dropwave.asrar.software"]
```

## 5. Infra stack: Traefik, Postgres, pgAdmin

This stack isn't pushed. It lives in its own folder on the server (`~/infra`) and follows the same layout as the main server's devops stack. Dropwave relies on these names from it:

| Name                    | What it is                                               |
| ----------------------- | -------------------------------------------------------- |
| `proxy` network         | Traefik reaches the app containers here                  |
| `data` network          | Postgres lives here, as the container `postgres`         |
| `websecure`             | Traefik's HTTPS (443) entrypoint                         |
| `letsencryptresolver`   | Certificate resolver, using the Cloudflare DNS challenge |
| `secure-headers@docker` | Shared security-headers middleware                       |

Copy the folder to the server, fill in `.env` (from `.env.example`), then:

```sh
cd ~/infra
touch acme.json && chmod 600 acme.json   # Traefik refuses a world-readable cert store
docker compose up -d
```

`CF_DNS_API_TOKEN` is a Cloudflare token for the `asrar.software` zone with **Zone/Read + DNS/Edit**. The main server's token works too.

The Traefik dashboard is served at `TRAEFIK_HOST` (e.g. `traefik2.asrar.software`) behind basic auth (`DASHBOARD_AUTH`, from `htpasswd -nB admin`, single-quoted in `.env`). Its certificate comes through the DNS challenge, so no DNS record is needed unless you want to open it. It also gives the Traefik container a real router, which stops Traefik from inventing one it can't get a certificate for.

On first start, `postgres/init/01-databases.sh` creates the `dropwave` role and database using `DROPWAVE_DB_PASSWORD`. It only runs on an empty volume. For apps added later, create the role and database by hand, or add them to the script before the first start.

pgAdmin is then at `https://pgadmin-ec2.asrar.software`, with this server's Postgres already registered.

Logs for every container (the apps included) are at `DOZZLE_HOST` (e.g. `https://logs2.asrar.software`). It uses the same basic-auth login as the Traefik dashboard and needs its own proxied A record. The API writes one JSON object per line (pino), which Dozzle shows as fields: filter by `level`, `req.url`, `res.statusCode` or a `req.id` taken from a response's `x-request-id` header.

## 6. App folder

```sh
mkdir -p ~/dropwave && cd ~/dropwave
```

Create two files there, from [`.env.example`](.env.example) and [`.env.api.example`](.env.api.example):

- **`.env`** holds `DOMAIN`, `IMAGE_OWNER` and `IMAGE_TAG`. Docker Compose reads it to fill in `docker-compose.yml`.
- **`.env.api`** holds `DATABASE_URL` (with `DROPWAVE_DB_PASSWORD` from step 5), `AWS_REGION` and `S3_BUCKET`. It's passed to the API container.

`docker-compose.yml` arrives with the first deploy.

## 7. GitHub

1. **Make a deploy key.** On your laptop:
   ```sh
   ssh-keygen -t ed25519 -f dropwave_deploy -N "" -C "github-actions-dropwave"
   ```
   Append `dropwave_deploy.pub` to `~/.ssh/authorized_keys` on the server.
2. **Add the secrets.** In **repo → Settings → Secrets and variables → Actions**:

   | Secret        | Value                                         |
   | ------------- | --------------------------------------------- |
   | `EC2_HOST`    | Elastic IP or hostname                        |
   | `EC2_USER`    | `ubuntu` (or your user)                       |
   | `EC2_SSH_KEY` | contents of the private key `dropwave_deploy` |

3. Push to `main`, or run the workflow from the **Actions** tab.

The images are private on GHCR. Each deploy logs the server in with that run's short-lived token, pulls, and logs out again.

## Day to day

```sh
cd ~/dropwave
docker compose ps
docker compose logs -f api        # migrations + requests
docker compose logs -f web
```

**Roll back:** set `IMAGE_TAG` in `~/dropwave/.env` to an earlier commit SHA, then run `docker compose up -d`. Since the packages are private, run `docker login ghcr.io` first with a personal access token that has `read:packages`.
