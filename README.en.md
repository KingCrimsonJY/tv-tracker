<div align="center">

# 帧迹 Zhenji

**A personal, self-hosted movie & TV watch progress tracker — HeroUI v3 cinematic interface, portable single-file SQLite storage, and real-time multi-device sync.**

[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![HeroUI v3](https://img.shields.io/badge/HeroUI-v3-006FEE)](https://heroui.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x_Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](./Dockerfile)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](./LICENSE)

[简体中文](./README.md) | **English**

</div>

---

## Screenshots

### Mobile (`390×844`)

| Home (Dark) | Library Grid | Title Detail & Episodes | Ordered List (MCU Watch Order) |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/phone-home.webp" alt="Mobile Home (Dark)" width="190" /> | <img src="docs/screenshots/phone-library.webp" alt="Mobile Library" width="190" /> | <img src="docs/screenshots/phone-detail.webp" alt="Mobile Title Detail with Season Tabs and Episodes" width="190" /> | <img src="docs/screenshots/phone-list.webp" alt="Mobile Ordered List (Marvel Infinity Saga Watch Order)" width="190" /> |

| Link Import Preview (Playlist) | Playlist Detail & Episodes | Home (Light) |
| :---: | :---: | :---: |
| <img src="docs/screenshots/phone-link-import.webp" alt="Mobile Link Import Playlist Preview" width="220" /> | <img src="docs/screenshots/phone-playlist-detail.webp" alt="Mobile Playlist Detail with Episodes" width="220" /> | <img src="docs/screenshots/phone-home-light.webp" alt="Mobile Home (Light)" width="220" /> |

### Desktop (`1280×800`)

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
- **Rewatch History with Step-by-Step Undo**: Start a new playthrough (`二刷中`) once a title is Completed or Caught Up while preserving full history (`看过 2 次` with start/completion dates). Undo the latest playthrough all the way back (`3rd → 2nd → 1st → 未看` Unwatched), or delete any individual playthrough with automatic renumbering by start date.

### Lists
- **Ordered Watch Lists**: Ideal for franchise watch orders (e.g., `漫威无限传奇观影顺序`). Automatically highlights the next unwatched entry (`下一部待看`) and surfaces it in pinned Home cards with completion progress (`3/10`).
- **Collections**: Poster wall collections with sorting by date added, name, release year, rating, or manual drag-and-drop.
- **Single-Row Fractional Ordering**: Powered by `fractional-indexing` and `@dnd-kit` with pointer, touch (200ms press handle activation on mobile), and keyboard sensors.

### Data Sources
- **TMDB Primary Metadata**: Fetches Simplified Chinese (`zh-CN`), English (`en-US`), and original titles, TMDB ratings, seasons, episodes, air dates, backdrops, posters, and episode stills, refreshing metadata automatically when opening details.
- **Multi-Source Ratings**: Displays **TMDB** ratings and queries OMDb by IMDb ID for **IMDb**, **Rotten Tomatoes**, and **Metacritic** ratings (cached for 7 days, fetched lazily on detail open).
- **yt-dlp Link Import & Custom Items**: Powered by **yt-dlp** (`--dump-single-json --skip-download --flat-playlist`) to import single videos, playlists, collections (合集), and multi-part videos (分P) from YouTube, Bilibili, and more. Supports pasted share text, incremental playlist refresh (`刷新列表`) to append newly published entries without altering existing progress, one-tap TMDB search suggestions when anime/TV series are detected, and automatic Open Graph fallback if `yt-dlp` is unavailable.

### Real-Time Sync & Security
- **Server-Sent Events (SSE) & Atomic Actions**: Every mutation executes in a single SQLite transaction, increments `version`, and broadcasts `{ version, epoch, upserts, deletes }` to all connected devices. Optimistic client updates pair with atomic action endpoints (`POST /api/titles/:id/actions`) so multi-step edits commit atomically.
- **Offline Intentionally Blocked**: Offline editing is disabled by design to prevent multi-device merge conflicts. If the server or SSE stream is unreachable for more than 5 seconds, a full-screen connection guard (`无法连接到服务器`) blocks edits until reconnected.
- **Single-User Password Auth with Setup Code**: `node:crypto` `scrypt` hashing with random salt and `timingSafeEqual`, one-time first-run setup code (`SETUP_CODE`), `HttpOnly; SameSite=Lax` 365-day sliding sessions, CSRF `Origin` checks, login rate limiting (5 failed attempts per 15 minutes per IP), and SSRF protection.

### Interface
- **HeroUI v3 Cinematic UI**: Inspired by Infuse and the Apple TV app, built with **HeroUI v3** (`@heroui/react` + `@heroui/styles`) and **Tailwind CSS v4**. Responsive bottom tab bar on phones, navigation rail on tablets, and full sidebar with pinned lists on desktop.
- **Customization & Themes**: Dark cinema theme by default, plus Light and System modes, configurable default title language, Season 0 specials inclusion toggle, and customizable Home sections.
- **Installable PWA**: Full Web App Manifest and icons for home-screen installation (`display: standalone`). The service worker caches the app shell only, never `/api/*` responses.

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js `>= 22.13.0`** (**Node.js 24 LTS** recommended; Node's built-in `node:sqlite` module is available without experimental CLI flags starting in Node.js `22.13.0`)
- **npm `>= 10`**
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** (Optional for local dev, recommended for Link Import of videos and playlists; install locally into `./.bin/yt-dlp` via `npm run setup:ytdlp`, or bundled automatically at `/opt/yt-dlp/yt-dlp` in Docker)

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

> To generate a pre-populated demo database with curated titles, the Marvel watch order, and offline 3Blue1Brown playlist fixtures in `./data-demo` (without touching `./data`), run `npm run seed:demo`.

---

## Configuration

All environment variables are read exclusively on the server from `.env` (see [`.env.example`](./.env.example)):

| Variable | Required | Default | Purpose | Where to Get / Notes |
| :--- | :---: | :--- | :--- | :--- |
| `TMDB_READ_TOKEN` | **Recommended** | Empty | TMDB v4 Read Access Token (Bearer auth) for searching titles and fetching bilingual metadata | Request a free API Read Access Token at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| `OMDB_API_KEY` | Optional | Empty | Fetches IMDb, Rotten Tomatoes, and Metacritic ratings by IMDb ID (cached for 7 days) | Request a free key (1,000 req/day) at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) |
| `DATA_DIR` | Optional | `./data` | Single portable directory storing `tracker.db`, daily backups, and daily JSON exports | Mounted at `/data` inside Docker |
| `YTDLP_PATH` | Optional override | Auto-detected | Custom path to the `yt-dlp` binary (not listed in `.env.example`; set only to override the default lookup order) | When unset or empty, checks `/opt/yt-dlp/yt-dlp`, `./.bin/yt-dlp`, then `yt-dlp` on `PATH` |
| `SETUP_CODE` | Optional | Random | One-time verification code required on the first-run password setup screen | If omitted, a random code is printed to server logs on first boot |
| `APP_PASSWORD_HASH` | Optional | Empty | `scrypt` password hash override (takes priority over the database password hash) | Generate interactively via `npm run set-password` |
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
mkdir -p data && sudo chown 1000:1000 data
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

## Development

```bash
# Start full-stack dev server on http://localhost:3000
npm run dev

# Run strict TypeScript typecheck
npm run lint

# Run Vitest test suite (domain logic, rewatch undo, SQLite storage, API routes, SSRF guard)
npm test

# Build frontend assets to dist/
npm run build

# Start production server
npm start

# Download and verify standalone yt-dlp binary into ./.bin/yt-dlp
npm run setup:ytdlp

# Generate an scrypt hash to reset a forgotten password (prompts twice with hidden input)
npm run set-password

# Build the curated demo database in ./data-demo (never touches ./data)
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

- **[The Movie Database (TMDB)](https://www.themoviedb.org/)**: Primary source for movie & TV metadata, localized titles, TMDB ratings, season/episode listings, posters, and backdrops.
- **[OMDb API](https://www.omdbapi.com/)**: Provides IMDb, Rotten Tomatoes, and Metacritic ratings.
- **Open-Source Libraries**: Built with [React 19](https://react.dev/), [HeroUI v3](https://heroui.com/), [Tailwind CSS v4](https://tailwindcss.com/), [yt-dlp](https://github.com/yt-dlp/yt-dlp), [@dnd-kit](https://dndkit.com/), [Lucide Icons](https://lucide.dev/), and [Zod](https://zod.dev/).

---

## License

Released under the [MIT License](./LICENSE). Copyright (c) 2026 KingCrimsonJY.
