# Deploying Dropwave to EC2

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. Builds the `api` and `web` images and pushes them to `ghcr.io/<owner>/dropwave-{api,web}`, tagged with the commit SHA and `latest`.
2. Copies [`docker-compose.yml`](docker-compose.yml) to the server, sets `IMAGE_TAG` to the new SHA, pulls, and restarts.

The API container applies pending Prisma migrations before it starts.

```
                   ┌──────────── EC2 ─────────────────────────────────────────┐
 dropwave.asrar  ──▶ Traefik :443 ──▶ /api/*  ──▶ api  (Nest, :4000) ─┐       │
 .software          (Let's Encrypt)  ──▶ /*   ──▶ web  (Next, :3000)   │       │
                   │                                                  ▼       │
                   │           "proxy" network ─────────────────▶ postgres    │
                   └──────────────────────────────────────────────────────────┘
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

## 2. DNS

In the DNS for `asrar.software`, add **A** records pointing at the Elastic IP:

| Name | Value |
|---|---|
| `dropwave` | Elastic IP |
| `pgadmin` | Elastic IP |

Traefik requests certificates on first visit, so DNS must already resolve to the server.

## 3. S3 access from EC2 (IAM role, no keys on the server)

1. **IAM → Roles → Create role → AWS service → EC2.** Attach an inline policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::dropwave/uploads/*"
     }]
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

This stack isn't in the repo; it lives in its own folder on the server (`~/infra`). Dropwave only needs it to:

- create a Docker network named **`proxy`**;
- run Traefik on it with an entrypoint named **`websecure`** (443) and a certificate resolver named **`letsencrypt`**;
- run Postgres on it with the container name **`postgres`**.

If your Traefik setup uses other names, change the labels in [`docker-compose.yml`](docker-compose.yml) to match. Then:

```sh
cd ~/infra && docker compose up -d
```

Create the Dropwave database and its own user:

```sh
docker exec -it postgres psql -U postgres \
  -c "CREATE USER dropwave WITH PASSWORD 'a-long-random-password';" \
  -c "CREATE DATABASE dropwave OWNER dropwave;"
```

pgAdmin is then at `https://pgadmin.asrar.software`. Register a server with host `postgres`, port `5432`.

## 6. App folder

```sh
mkdir -p ~/apps/dropwave && cd ~/apps/dropwave
```

Create two files there, from [`.env.example`](.env.example) and [`.env.api.example`](.env.api.example):

- **`.env`** holds `DOMAIN`, `IMAGE_OWNER` and `IMAGE_TAG`. Docker Compose reads it to fill in `docker-compose.yml`.
- **`.env.api`** holds `DATABASE_URL` (with the password from step 5), `AWS_REGION` and `S3_BUCKET`. It's passed to the API container.

`docker-compose.yml` arrives with the first deploy.

## 7. GitHub

1. **Make a deploy key.** On your laptop:
   ```sh
   ssh-keygen -t ed25519 -f dropwave_deploy -N "" -C "github-actions-dropwave"
   ```
   Append `dropwave_deploy.pub` to `~/.ssh/authorized_keys` on the server.
2. **Add the secrets.** In **repo → Settings → Secrets and variables → Actions**:

   | Secret | Value |
   |---|---|
   | `EC2_HOST` | Elastic IP or hostname |
   | `EC2_USER` | `ubuntu` (or your user) |
   | `EC2_SSH_KEY` | contents of the private key `dropwave_deploy` |

3. Push to `main`, or run the workflow from the **Actions** tab.

The images are private on GHCR. Each deploy logs the server in with that run's short-lived token, pulls, and logs out again.

## Day to day

```sh
cd ~/apps/dropwave
docker compose ps
docker compose logs -f api        # migrations + requests
docker compose logs -f web
```

**Roll back:** set `IMAGE_TAG` in `~/apps/dropwave/.env` to an earlier commit SHA, then run `docker compose up -d`. Since the packages are private, run `docker login ghcr.io` first with a personal access token that has `read:packages`.
