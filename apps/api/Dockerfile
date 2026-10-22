# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/api/Dockerfile .

ARG NODE_IMAGE=node:24.21.0-bookworm-slim

FROM ${NODE_IMAGE} AS base
# Prisma's migration engine needs OpenSSL; install it in every stage so the
# engine npm downloads at install time matches the one used at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ─── Keep only the api workspace and what it depends on (turbo prune) ──────
FROM base AS prune
ARG TURBO_VERSION=2.11.10
RUN npm install -g turbo@${TURBO_VERSION}
COPY . .
RUN turbo prune api --docker

# ─── Install and build ─────────────────────────────────────────────────────
FROM base AS build
# package.json files + pruned lockfile first, so this layer is cached until deps change.
COPY --from=prune /app/out/json/ .
RUN npm ci
COPY --from=prune /app/out/full/ .
WORKDIR /app/apps/api
# The Prisma client is generated into src/ (gitignored), so it has to be built here.
RUN npx prisma generate && npx nest build
WORKDIR /app
RUN npm prune --omit=dev

# ─── Runtime ───────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/prisma7.config.ts ./apps/api/prisma7.config.ts
USER node
WORKDIR /app/apps/api
EXPOSE 4000
# Apply pending migrations, then start. Safe with one API container; with several,
# run migrations as a separate one-off step instead.
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && exec node dist/main.js"]
