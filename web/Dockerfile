# syntax=docker/dockerfile:1.7
# The website image: Next.js standalone server. Build context is the repo root, because
# next.config.ts sets the Turbopack root one level up (docs/TECHNICAL.md, "Deployment").
# The image is pushed to GHCR, so no secrets go in here: they come from /srv/zupnija/.env at runtime,
# and the claude-pool tokens from the host's /etc/claude-pool (mounted read-only, docs/TECHNICAL.md "Urejevalnik").

# Pinned AI tooling (FR-9). Bump both on purpose, never to "latest".
ARG CLAUDE_CODE_VERSION=2.1.310
ARG CLAUDE_POOL_VERSION=v0.16.2
ARG CLAUDE_POOL_SHA256=2bf027531d540cf010c915e0130cf49ddeaadfb36a3cdcfd0ed0429633598eb8

FROM node:24-bookworm-slim AS build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# NEXT_PUBLIC_* are inlined into the browser bundle at build time, so they are build args.
ARG NEXT_PUBLIC_SANITY_PROJECT_ID=hnwav9pa
ARG NEXT_PUBLIC_SANITY_DATASET=production
ARG NEXT_PUBLIC_SANITY_STUDIO_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SANITY_PROJECT_ID=$NEXT_PUBLIC_SANITY_PROJECT_ID \
    NEXT_PUBLIC_SANITY_DATASET=$NEXT_PUBLIC_SANITY_DATASET \
    NEXT_PUBLIC_SANITY_STUDIO_URL=$NEXT_PUBLIC_SANITY_STUDIO_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
# src/db/index.ts needs DATABASE_URL when imported; postgres-js connects lazily, so a dummy is enough here.
RUN DATABASE_URL=postgres://build:build@127.0.0.1:1/build npm run build
# Migrations may not exist yet on a branch; the runtime COPY below needs the folder.
RUN mkdir -p drizzle

FROM node:24-bookworm-slim
ARG CLAUDE_CODE_VERSION
ARG CLAUDE_POOL_VERSION
ARG CLAUDE_POOL_SHA256
# python3 runs claude-pool; claude is the Claude Code CLI it wraps (a native binary from npm).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g --no-fund --no-audit "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
 && npm cache clean --force
ADD --checksum=sha256:${CLAUDE_POOL_SHA256} --chmod=755 \
    https://github.com/grega-rotar/claude-pool/releases/download/${CLAUDE_POOL_VERSION}/claude_pool.py /usr/local/bin/claude-pool
# Mount points for the named volumes in infra/compose.yml. Created here, owned by node, so a fresh
# volume starts out writable for the app.
RUN install -d -o node -g node /data/uploads /data/claude/config /data/claude/state
WORKDIR /app
# The tracing root is /app, so the standalone server lives in web/.
COPY --from=build --chown=node:node /app/web/.next/standalone ./
COPY --from=build --chown=node:node /app/web/.next/static ./web/.next/static
# Migrations run on start (web/scripts/migrate.mjs). The standalone trace holds only the files the app
# imports, so the migrator gets complete copies of its two packages (same versions as the app's).
COPY --from=build --chown=node:node /app/web/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=build --chown=node:node /app/web/node_modules/postgres ./node_modules/postgres
COPY --from=build --chown=node:node /app/web/drizzle ./web/drizzle
COPY --from=build --chown=node:node /app/web/scripts/migrate.mjs ./web/scripts/migrate.mjs
# One-time steps of the first editor deploy, run by hand (docs/TECHNICAL.md §8), never on start:
# the Sanity import (needs only postgres + fetch) and the owner bootstrap.
COPY --from=build --chown=node:node /app/web/scripts/import-sanity.mjs /app/web/scripts/import-sanity-lib.mjs /app/web/scripts/bootstrap-owner.mjs ./web/scripts/
USER node
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads \
    CLAUDE_POOL_BIN=/usr/local/bin/claude-pool \
    CLAUDE_POOL_DIR=/etc/claude-pool \
    CLAUDE_POOL_STATE=/data/claude/state/usage.json \
    CLAUDE_POOL_ENV_FILE=/dev/null \
    CLAUDE_CONFIG_DIR=/data/claude/config \
    DISABLE_AUTOUPDATER=1
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Migrate first; a failed migration stops the container instead of serving a half-updated schema.
CMD ["sh", "-c", "node web/scripts/migrate.mjs && exec node web/server.js"]
