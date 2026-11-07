# Stage 1: Build frontend assets and fetch checksum-verified standalone yt-dlp binary
ARG NODE_IMAGE=node:24-slim
FROM ${NODE_IMAGE} AS builder

ARG YTDLP_VERSION=latest

WORKDIR /app

RUN node -e "\
  const crypto = require('node:crypto'); \
  const fs = require('node:fs'); \
  const version = (process.env.YTDLP_VERSION || 'latest').trim() || 'latest'; \
  const bin = process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'; \
  const baseUrl = version === 'latest' \
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download' \
    : 'https://github.com/yt-dlp/yt-dlp/releases/download/' + encodeURIComponent(version); \
  Promise.all([ \
    fetch(baseUrl + '/SHA2-256SUMS', { redirect: 'follow' }).then(r => { if (!r.ok) throw new Error('SHA2-256SUMS HTTP ' + r.status); return r.text(); }), \
    fetch(baseUrl + '/' + bin, { redirect: 'follow' }).then(r => { if (!r.ok) throw new Error(bin + ' HTTP ' + r.status); return r.arrayBuffer(); }) \
  ]).then(([sumsText, binAb]) => { \
    let expected = null; \
    for (const raw of sumsText.split(/\\r?\\n/)) { \
      const m = raw.trim().match(/^([0-9a-fA-F]{64})\\s+\\*?(\\S+)$/); \
      if (m && m[2] === bin) { expected = m[1].toLowerCase(); break; } \
    } \
    if (!expected) throw new Error('Missing SHA-256 entry for ' + bin); \
    const buf = Buffer.from(binAb); \
    const actual = crypto.createHash('sha256').update(buf).digest('hex').toLowerCase(); \
    if (actual !== expected) throw new Error('SHA-256 mismatch for ' + bin + ': expected ' + expected + ', got ' + actual); \
    fs.mkdirSync('/opt/yt-dlp', { recursive: true }); \
    fs.writeFileSync('/opt/yt-dlp/yt-dlp', buf, { mode: 0o755 }); \
  }); \
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
FROM ${NODE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
ENV YTDLP_PATH=/opt/yt-dlp/yt-dlp

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data /opt/yt-dlp \
  && chown -R node:node /data /app /opt/yt-dlp

COPY --from=builder --chown=node:node /opt/yt-dlp/yt-dlp /opt/yt-dlp/yt-dlp
RUN chmod 0755 /opt/yt-dlp/yt-dlp

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/server.ts ./server.ts
COPY --from=builder --chown=node:node /app/server ./server
COPY --from=builder --chown=node:node /app/src/domain ./src/domain
COPY --from=builder --chown=node:node /app/src/i18n/messages ./src/i18n/messages

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.ts"]
