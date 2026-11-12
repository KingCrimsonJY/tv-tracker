# Image names are fully qualified so the same file builds with Docker and with Podman, which has no default
# registry unless one is configured.
ARG NODE_IMAGE=docker.io/library/node:24-bookworm-slim

# ---- Build: front-end bundle, production node_modules and a checksum-verified yt-dlp ----
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

# The same script as `npm run setup:ytdlp`: downloads the release and verifies it against SHA2-256SUMS.
ARG YTDLP_VERSION=latest
COPY server/scripts/setup-ytdlp.ts server/scripts/setup-ytdlp.ts
RUN YTDLP_VERSION="${YTDLP_VERSION}" YTDLP_OUT=/opt/yt-dlp/yt-dlp node server/scripts/setup-ytdlp.ts

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json server.ts ./
COPY public public
COPY src src
COPY server server
RUN npm run build && npm prune --omit=dev

# ---- Runtime ----
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    YTDLP_PATH=/opt/yt-dlp/yt-dlp

# yt-dlp verifies HTTPS with the system certificates. /data is created for the unprivileged user so that a
# new named volume mounted there starts out writable.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data /opt/yt-dlp \
  && chown node:node /data /opt/yt-dlp

COPY --from=builder --chown=node:node /opt/yt-dlp/yt-dlp /opt/yt-dlp/yt-dlp
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/dist dist
COPY --from=builder /app/server.ts server.ts
COPY --from=builder /app/server server
# The server imports the shared domain logic and the message catalogs; nothing else from src is needed.
COPY --from=builder /app/src/domain src/domain
COPY --from=builder /app/src/i18n/messages src/i18n/messages

# uid 1000. With a bind-mounted data directory the host directory must be writable by this user:
# see docs/deployment.md for Docker (chown) and rootless Podman (--userns=keep-id).
USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Node is PID 1 and handles SIGTERM itself (see server.ts), so no init wrapper is needed.
CMD ["node", "server.ts"]
