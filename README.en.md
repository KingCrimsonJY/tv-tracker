<div align="center">

# 帧迹 Zhenji

**A personal, self-hosted movie & TV watch progress tracker — cinematic UI, portable single-file SQLite storage, and real-time multi-device sync.**

[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x_Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](./Dockerfile)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](./LICENSE)

[简体中文](./README.md) | **English**

</div>

---

## Screenshots

### Mobile (`390×844` · `@2x`)

| Home (Dark) | Title Detail (Hero) | Episode Progress |
| :---: | :---: | :---: |
| <img src="docs/screenshots/phone-home.webp" alt="Mobile Home (Dark)" width="240" /> | <img src="docs/screenshots/phone-detail-hero.webp" alt="Mobile Title Detail Hero" width="240" /> | <img src="docs/screenshots/phone-detail-episodes.webp" alt="Mobile Episode List" width="240" /> |

| Ordered List (MCU Watch Order) | Library Grid | Search & Add | Home (Light) |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/phone-list.webp" alt="Mobile Ordered List" width="180" /> | <img src="docs/screenshots/phone-library.webp" alt="Mobile Library" width="180" /> | <img src="docs/screenshots/phone-search.webp" alt="Mobile Search" width="180" /> | <img src="docs/screenshots/phone-home-light.webp" alt="Mobile Home (Light)" width="180" /> |

### Desktop (`1440×900`)

<p align="center">
  <img src="docs/screenshots/desktop-home.webp" alt="Desktop Home" width="880" />
</p>
<p align="center">
  <img src="docs/screenshots/desktop-detail.webp" alt="Desktop Title Detail" width="880" />
</p>

---

## Features

### Progress Tracking
- **Pure Derived Status**: Status is never stored as stale state—it is computed on the fly from episode air dates, the active playthrough's watched map, and manual state (`未开播` Unaired / `未看` Unwatched / `观看中` Watching / `已追平` Caught Up / `已看完` Completed / `暂停` Paused / `弃剧` Dropped).
- **Ongoing Show & New Episode Detection**: Catching up on an ongoing series marks it as `已追平` (Caught Up); when new episodes air later, it automatically transitions back to `观看中` with a **有新集 (New Episodes)** badge.
- **Fast Batch Actions**: Toggle individual aired episodes, mark/unmark an entire season, **Mark up to here** across seasons (never unchecking later episodes), or mark the whole title watched. Unaired episodes are automatically disabled with their scheduled air date.
- **Resume Timestamps**: Record `mm:ss` or `h:mm:ss` timestamps per movie or episode (e.g., `S2·E5 · 42:15`), validated against known runtime and automatically cleared when that episode is marked watched.
- **Rewatches (Playthrough History)**: Start a new playthrough (`二刷中`) once a title is Completed or Caught Up while preserving full history (`看过 2 次` with start/completion dates), or cancel a rewatch in progress to restore the previous playthrough.

### Lists
- **Ordered Watch Lists**: Ideal for franchise watch orders (e.g., Marvel Cinematic Universe). Automatically highlights the next unwatched entry and surfaces it in pinned Home cards with completion progress (`6/10`).
- **Collections**: Poster wall collections with sorting by date added, name, release year, rating, or manual drag-and-drop.
- **Single-Row Fractional Ordering**: Powered by `fractional-indexing` and `@dnd-kit` with pointer, touch (200ms press handle activation on mobile), and keyboard sensors.

### Data Sources
- **TMDB Primary Metadata**: Fetches Simplified Chinese (`zh-CN`), English (`en-US`), and original titles, seasons, episodes, air dates, backdrops, posters, and episode stills, refreshing metadata automatically when opening details.
- **Multi-Source Ratings**: Queries OMDb by IMDb ID for IMDb, Rotten Tomatoes, and Metacritic ratings (cached for 7 days, fetched lazily on detail open). Includes isolated best-effort Douban lookup with silent fallback to manual score/URL fields and a one-tap Douban search link.
- **Link Import & Custom Items**: Powered by **yt-dlp** (`--dump-single-json --skip-download --flat-playlist`) to import single videos, multi-part videos (分P), collections (合集), and playlists from YouTube, Bilibili, and more (supports pasted share text, incremental playlist refresh to append new episodes, one-tap TMDB search suggestions for bangumi/TV episodes, and automatic Open Graph fallback if `yt-dlp` is not installed).

### Real-Time Sync & Security
- **Server-Sent Events (SSE) & Atomic Actions**: Every mutation executes in a single SQLite transaction, increments `version`, and broadcasts `{ version, epoch, upserts, deletes }` to all connected devices. Optimistic client updates run against an external store (`useSyncExternalStore`) so rapid taps on different episodes never overwrite each other.
- **Strict Online Policy**: Offline editing is intentionally disabled to prevent multi-device merge conflicts. If the server or SSE stream is unreachable for more than 5 seconds, a full-screen connection guard blocks edits until reconnected.
- **Single-User Password Auth**: `node:crypto` `scrypt` hashing with random salt and `timingSafeEqual`, one-time first-run setup code, `HttpOnly; SameSite=Lax` 365-day sliding sessions, CSRF `Origin` checks, and per-IP + global login rate limiting.

### Interface
- **Cinematic, Image-Led UI**: Inspired by Infuse and the Apple TV app, built with **HeroUI v3** and **Tailwind CSS v4**. Responsive bottom tab bar on phones, navigation rail on tablets, and full sidebar with pinned lists on desktop.
- **Customization & Themes**: Dark cinema theme by default, plus Light and System modes, configurable default title language, Season 0 specials inclusion toggle, and customizable Home sections.
- **Installable PWA**: Full Web App Manifest and icons for home-screen installation (`display: standalone`). The service worker caches the app shell only, never `/api/*` responses.

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js `>= 22.13.0`** (**Node.js 24 LTS** recommended; Node's built-in `node:sqlite` module is available without experimental CLI flags starting in Node.js `22.13.0`)
- **npm `>= 10`**
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** (Optional for local dev, recommended for Link Import of videos and playlists; bundled automatically in the Docker image, and falls back to Open Graph scraping if absent)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/KingCrimsonJY/zhenji.git
cd zhenji

# 2. Copy the environment template and add your TMDB_READ_TOKEN
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Start the development server (listens on http://localhost:3000)
npm run dev
```

### First-Run Setup Code
On first start (when no password exists yet), the server generates a random **one-time setup code** and prints it to the terminal:

```text
[Auth] First-run setup code: X7k9Pq2mR4vL
```

Open `http://localhost:3000`, enter the setup code from the terminal (or the `SETUP_CODE` configured in `.env`), and set a password of at least 10 characters. Once set, the setup endpoint is permanently disabled.

> To generate a pre-populated demo database in `./data-demo` (without touching `./data`), run `npm run seed:demo`.

---

## Configuration

All environment variables are read exclusively on the server from `.env` (see [`.env.example`](./.env.example)):

| Variable | Required | Default | Purpose | Where to Get / Notes |
| :--- | :---: | :--- | :--- | :--- |
| `TMDB_READ_TOKEN` | **Recommended** | Empty | TMDB v4 Read Access Token (Bearer auth) for searching titles and fetching bilingual metadata | Request a free API Read Access Token at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| `OMDB_API_KEY` | Optional | Empty | Fetches IMDb, Rotten Tomatoes, and Metacritic ratings by IMDb ID (cached for 7 days) | Request a free key (1,000 req/day) at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) |
| `DATA_DIR` | Optional | `./data` | Single portable directory storing `tracker.db`, daily backups, and daily JSON exports | Mounted at `/data` inside Docker |
| `YTDLP_PATH` | Optional | `yt-dlp` | Path to the `yt-dlp` binary used by Link Import | Checks `./.bin/yt-dlp` first, then `PATH`; pre-installed at `/opt/yt-dlp/yt-dlp` in Docker |
| `SETUP_CODE` | Optional | Random | One-time verification code required on the first-run password setup screen | If omitted, a random code is printed to server logs on first boot |
| `APP_PASSWORD_HASH` | Optional | Empty | `scrypt` password hash override (takes priority over the database password hash) | Generate via `npm run set-password -- "new-password"` |
| `TRUST_PROXY` | Optional | `0` | Set to `1` to read client IP from `CF-Connecting-IP` or `X-Forwarded-For` for login rate limiting | Enable (`1`) when behind Cloudflare Tunnel or a reverse proxy |
| `PORT` | Optional | `3000` | HTTP server port | Defaults to `3000` |

---

## Deployment

Deploy with Docker Compose in minutes:

```bash
git clone https://github.com/KingCrimsonJY/zhenji.git
cd zhenji
cp .env.example .env
# Edit .env to set TMDB_READ_TOKEN
docker compose up -d --build

# Read the one-time setup code on first start
docker compose logs zhenji | grep "First-run setup code"
```

By default, the container binds to `127.0.0.1:8080:3000` on the host and includes optional `cloudflare` (`cloudflared` with `TUNNEL_TOKEN`) and `tailscale` (Tailscale Funnel with `TS_AUTHKEY`) Compose profiles. See **[`docs/deployment.md`](./docs/deployment.md)** for full instructions on installing Docker on Linux, tunnel setup, updating, backups, migrating machines, resetting passwords, and preventing host sleep.

---

## Data & Backups

All persistent state lives in **one portable folder** (`DATA_DIR`, default `./data`):

```text
data/
  tracker.db                                    # Main SQLite database (WAL mode, foreign keys ON)
  backups/tracker-YYYY-MM-DD.db                 # Daily VACUUM INTO snapshot (newest 14 kept)
  backups/tracker-YYYY-MM-DD-HHmmss-pre-*.db    # Automatic pre-migration & pre-import safety copies (newest 10 kept)
  exports/zhenji-YYYY-MM-DD.json                # Atomic daily JSON export (newest 14 kept)
```

- **Moving to another machine**: Stop the container, copy `./data` and `.env` to the new host, and start the same Docker image.
- **Restoring a backup**: Stop the container and copy a `backups/tracker-*.db` file over `tracker.db` (removing `tracker.db-wal` and `tracker.db-shm`), or upload any `exports/zhenji-*.json` file directly in **Settings → Import Data (JSON)**.
- **Export format specification**: See **[`docs/data-format.md`](./docs/data-format.md)** for the full schema and backward-compatibility details.

---

## Security Notes

- **Single Password with `scrypt`**: Hashed using `node:crypto` `scrypt` with a 16-byte random salt and verified via `crypto.timingSafeEqual`.
- **Setup Code Protection**: First-run password creation requires the server's `SETUP_CODE`, preventing unauthorized setup if the instance is exposed before initialization.
- **Hashed Session Tokens & CSRF Protection**: 32-byte random session tokens are stored SHA-256 hashed in SQLite and sent via `HttpOnly; SameSite=Lax` cookies (`Secure` in production). All cookie-authenticated mutating requests verify that the `Origin` header matches the host.
- **Login Rate Limiting**: Limits failed login attempts to 5 per 15 minutes per client IP, plus a global failure circuit breaker.
- **Always Serve Over HTTPS**: When accessing across devices or over the internet, always expose the app through an HTTPS tunnel (Cloudflare Tunnel / Tailscale Funnel) or TLS reverse proxy.
- **No Offline Queueing**: Offline mode is intentionally disabled so multiple devices never diverge or overwrite progress silently.

---

## Project Structure

```text
.
├── server.ts                  # Unified Express + Vite entrypoint and scheduled maintenance
├── server/
│   ├── app.ts                 # Auth, session middleware, CSRF check, SSE broadcast
│   ├── auth.ts                # scrypt hashing, cookies, and login rate limiter
│   ├── entityRoutes.ts        # Titles, seasons, progress, atomic actions, lists, settings, export/import
│   ├── providerRoutes.ts      # TMDB search/details, OMDb/Douban ratings, link import routes
│   ├── db/                    # SQLite repository, transactions, backups, and SQL migrations
│   ├── providers/             # TMDB, Douban (best-effort), link import with SSRF guard
│   └── scripts/               # set-password CLI and seed-demo script
├── src/
│   ├── domain/                # Pure domain logic (progress status, time parser, Zod schemas, types)
│   ├── data/                  # External store (useSyncExternalStore), optimistic actions, API client
│   ├── context/               # TrackerContext and SSE real-time synchronization
│   ├── pages/                 # Home, Library, Lists, ListDetail, TitleDetail, Search, Settings
│   ├── features/              # Modular screen components
│   └── i18n/                  # Simplified Chinese UI strings (zh.ts)
└── docs/
    ├── deployment.md          # Linux + Docker Compose deployment guide
    ├── data-format.md         # Portable JSON export format specification
    └── screenshots/           # Real application screenshots (WebP)
```

---

## Development

```bash
# Start full-stack dev server on http://localhost:3000
npm run dev

# Run strict TypeScript typecheck
npm run lint

# Run Vitest test suite (domain logic, SQLite storage, API routes, SSRF guard, optimistic concurrency)
npm test

# Build frontend assets to dist/
npm run build

# Start production server
npm start

# Generate an scrypt hash to reset a forgotten password
npm run set-password -- "your-new-password"

# Build the demo database in ./data-demo (never touches ./data)
npm run seed:demo
```

---

## Credits & Data Attribution

<p>
  <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
    <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB Logo" height="20" />
  </a>
</p>

> **This product uses the TMDB API but is not endorsed or certified by TMDB.**

- **[The Movie Database (TMDB)](https://www.themoviedb.org/)**: Primary source for movie & TV metadata, localized titles, season/episode listings, posters, and backdrops.
- **[OMDb API](https://www.omdbapi.com/)**: Provides IMDb, Rotten Tomatoes, and Metacritic ratings.
- **Douban (豆瓣)**: Automatic Douban rating lookup is unofficial best-effort scraping intended strictly for personal self-hosted use; manual Douban rating/URL fields and a direct Douban search link are always available per title.
- **Open-Source Libraries**: Built with [React 19](https://react.dev/), [HeroUI v3](https://heroui.com/), [Tailwind CSS v4](https://tailwindcss.com/), [@dnd-kit](https://dndkit.com/), [Lucide Icons](https://lucide.dev/), and [Zod](https://zod.dev/).

---

## License

Released under the [MIT License](./LICENSE). Copyright (c) 2026 KingCrimsonJY.
