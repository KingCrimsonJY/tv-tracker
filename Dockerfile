# Stage 1: Build frontend assets and fetch standalone yt-dlp binary
FROM node:24-slim AS builder

WORKDIR /app

RUN node -e "\
  const fs = require('node:fs'); \
  const bin = process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'; \
  const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/' + bin; \
  fetch(url, { redirect: 'follow' }) \
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }) \
    .then(buf => { fs.writeFileSync('/usr/local/bin/yt-dlp', Buffer.from(buf), { mode: 0o755 }); }); \
"

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
COPY server ./server
COPY server.ts ./

RUN npm run build && npm prune --omit=dev

# Stage 2: Production runtime
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
ENV YTDLP_PATH=/usr/local/bin/yt-dlp

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data && chown -R node:node /data /app

COPY --from=builder --chown=node:node /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp
RUN chmod 0755 /usr/local/bin/yt-dlp && chown node:node /usr/local/bin

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/server.ts ./server.ts
COPY --from=builder --chown=node:node /app/server ./server
COPY --from=builder --chown=node:node /app/src/domain ./src/domain

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.ts"]
