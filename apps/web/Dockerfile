# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/web/Dockerfile .

ARG NODE_IMAGE=node:24.21.0-bookworm-slim

FROM ${NODE_IMAGE} AS base
WORKDIR /app

# ─── Keep only the web workspace and what it depends on (turbo prune) ──────
FROM base AS prune
ARG TURBO_VERSION=2.11.10
RUN npm install -g turbo@${TURBO_VERSION}
COPY . .
RUN turbo prune web --docker

# ─── Install and build ─────────────────────────────────────────────────────
FROM base AS build
COPY --from=prune /app/out/json/ .
RUN npm ci
COPY --from=prune /app/out/full/ .
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
# "/api" is relative: Traefik sends /api on the same domain to the Nest container.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=web

# ─── Runtime: Next's standalone server only ────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
