# Project rules

Product, data-safety and code rules for 帧迹 Zhenji. They are not derivable from the code alone; keep them when changing behavior.

## Commands

- `npm run dev` starts the server with Vite on port 3000. `npm run format:check`, `npm run lint` (tsc + ESLint), `npm test` and `npm run build` must pass before a PR; `npm run qa` checks responsive UI and sync against the build.
- `npm run seed:demo` creates `./data-demo`; `npm run screenshots` regenerates the README images from it. Run both with `TMDB_READ_TOKEN` and `OMDB_API_KEY` empty so the images use the bundled fixtures and stay reproducible.
- The PWA manifest is defined in `vite.config.ts`; do not add one under `public/`.

## Workflow

- Work on a branch from the latest `main` with focused commits. PR descriptions are concise English and include validation results.
- Run installs, builds and tests in an isolated environment. Do not install global packages or put caches and temporary files on the system drive; remove what you created when the work is done unless the user asks to keep it.
- Ask before adding dependencies or external services, changing the export format, or removing a feature the request does not name.
- Data changes require migrations. Keep v1 and v2 backup imports working and keep the v2 export envelope.

## Code

- Strict TypeScript: no `any`, no non-null assertions. Keep source files under about 400 lines by extracting cohesive modules; tests, fixtures and message catalogs may be longer.
- Every user-facing string lives in `src/i18n/messages` in both `zh-CN` and `en`. Keys are camelCase, except maps keyed by domain ids (statuses, home sections). Servers return error codes, not text.
- Vitest only. Tests never call real upstream networks. Every bug gets a meaningful regression test; coverage includes deleted upstream entries, removed or split seasons, locked structure, returning episodes, every rejected link category, and bangumi with and without TMDB matches.

## HeroUI and UI code

- Check the installed HeroUI v3 version as well as the current docs; examples can differ from the release.
- Prefer HeroUI components to raw interactive elements; use a raw element only through a component's documented `render` prop or where HeroUI has no component (file input). `className` on HeroUI components is for layout; appearance comes from documented variants and composition.
- Style with HeroUI semantic utilities (`text-muted`, `bg-surface`, `border-border`, `bg-accent-soft`, `text-accent-soft-foreground`, ...), not `[var(--token)]` classes. Add an app token only when HeroUI has none: define it for both themes in `src/index.css` and register it with `@theme inline`.
- Navigation is a link: router `Link`/`NavLink`, or `ButtonLink` (`buttonVariants` on a `Link`) when it should look like a button. Never a Button that calls `navigate()` on press.
- Every `Dropdown.Item` and `ListBox.Item` has a `textValue`. Async confirm buttons use `isPending`, `withPendingSpinner` and `usePendingAction`. Numeric inputs use `NumberField`.
- Dialogs capture form state when they open; synced updates must not reset typing, and saving an untouched form writes nothing.
- Preserve accessible labels, keyboard interaction and visible focus.

## Data safety and deployment

- Demo seeding never touches `DATA_DIR` and refuses to delete directories it did not create.
- A failed upstream request never removes local metadata or progress. Metadata refresh is one server-side transaction.
- Refresh All reports updated, needs review, partial, failed and skipped separately, including missing provider configuration.
- Proxy headers (`CF-Connecting-IP`, `X-Forwarded-For`, `X-Forwarded-Host`) are trusted only with `TRUST_PROXY=1`, using the last `X-Forwarded-For` entry. Unexpected 500 responses return only the error code.
- `npm start` serves the production build without `NODE_ENV`. README offline timing matches the heartbeat watchdog and countdown.
- CI runs format check, lint, Vitest, the production build and UI QA, then builds the Docker image, starts it and checks `/healthz`.

## Synchronization

- All open devices converge to server state, including out-of-order responses and SSE events, the initial connection, reconnects and backup replacement.
- Backup import replaces state on every device; merge semantics must not leave deleted entities behind.
- Every progress or playthrough write sends `expectedActivePlaythroughId`. Concurrent rewatch starts conflict; the server also rejects structural changes without it, removals that do not delete the matching progress, and progress written to anything but the resulting active playthrough. Playthroughs are never overwritten and progress is never orphaned.

## Upstream changes

- Local data is the source of truth; TMDB and Bilibili are references that may change or disappear.
- Apply additions and safe text/image updates automatically. Never remove or renumber seasons/episodes automatically: show structural changes on the title page with a preview and a choice to keep the local structure or adopt upstream.
- On adoption, migrate watched marks by TMDB episode id, then air date and order. Keep unmatched marks so they return with the episode. Synchronization never silently deletes watched history.
- A title can lock its season structure, which prevents removal, renumbering and moving episodes between seasons. Locked titles match by stable episode id, then air date and order, then the legacy fallback; date/order matches are the same episodes even when TMDB recreates ids (update ids and metadata in place, keep local keys, numbers and marks).
- Append only episodes still unmatched after all passes and dated on or after the latest local air date before refresh, to the last local season in air-date order (source order for same-day releases). Undated or older unmatched episodes stay in pending review without blocking later appends.
- A missing upstream title/video is marked source unavailable: keep everything, stop automatic refresh, and offer re-linking to another TMDB entry or manual maintenance.

## Link imports

- Zhenji tracks works that can be finished, not feeds. Support single and multipart videos, playlists, Bilibili collections and series, courses, live replays and bangumi.
- Reject live rooms/streams, favorites, Watch Later and channel/user upload pages before creating anything, with localized reasons; suggest importing the replay after a live stream. Never persist or show live status.
- Bangumi links search TMDB automatically and show matches; without matches, import the link. Bilibili-only works stay importable.
- Use the Bilibili metadata client only for supported types, with yt-dlp fallback. Convert Bilibili timestamps with Asia/Shanghai dates.
- YouTube playlists import quickly; fill missing titles and durations in the background and broadcast enrichment to every device.
- Never write placeholder air dates; strip the legacy `2020-01-01` placeholder from custom/link episodes, including imported backups.

## UI behavior and acceptance

- A Home next-episode deep link selects its season once and never overrides later selections.
- Episode checkboxes and primary actions share the aired rule. Watched episodes can always be unchecked.
- "Today" is the local calendar date everywhere in the UI.
- New navigation starts at the top; browser Back restores the previous scroll position.
- Poster columns follow the available content width, including the sidebar; labels stay readable at 320 and 1024 px.
- Verify changed screens at 320, 390 and 1280 px in both languages with a clean browser console. When screens shown in the README change, run `npm run seed:demo`, `npm run build` and `npm run screenshots`, and review `docs/screenshots`.

## Design

- Calm, Infuse-like look with uncluttered layouts. One accent color, reserved for the primary action.
- Advanced or rarely used controls go in menus; reveal detail progressively.
- Never show internal keys in user-facing text.
