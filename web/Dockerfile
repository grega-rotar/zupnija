# syntax=docker/dockerfile:1.7
# The website image: Next.js standalone server. Build context is the repo root, because
# next.config.ts sets the Turbopack root one level up (docs/TECHNICAL.md, "Deployment").
# The image is pushed to GHCR, so no secrets go in here: they come from /srv/zupnija/.env at runtime.

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
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
# The tracing root is /app, so the standalone server lives in web/.
COPY --from=build --chown=node:node /app/web/.next/standalone ./
COPY --from=build --chown=node:node /app/web/.next/static ./web/.next/static
USER node
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "web/server.js"]
