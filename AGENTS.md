# Zhenji (帧迹) — rules for contributors and coding agents

Zhenji is a self-hosted, single-user tracker for films, series and video collections: one Node.js process, one
SQLite file, any number of devices kept in sync. **It is feature-complete.** Work on it is fixing, hardening
and polishing; a new capability, a removed one, a new dependency or a change to the export format needs the
owner's explicit request.

These rules state what must stay true and why. Where a rule and the code disagree, one of them is a bug: find
out which before changing either. Do not treat existing code or this file as beyond question, and do not
"fix" something you have not understood.

## 1. Definition of done

Run everything in an isolated environment (container or VM); never install globally or leave files outside
the repository and its data directory.

```sh
npm run format:check && npm run lint && npm test    # Prettier, tsc + ESLint, Vitest (offline)
npm run build && npm run qa                         # production bundle, real-browser checks
PERF_ENFORCE_BUDGETS=1 npm run perf                 # performance budgets
```

All of it passes before a pull request, the working tree is clean, and each commit is one coherent change
with a message that says what changed and why. `npm run dev` serves the app with Vite on port 3000.

## 2. Map

| Path                                             | Holds                                    | Rule                                                                     |
| :----------------------------------------------- | :--------------------------------------- | :----------------------------------------------------------------------- |
| `src/domain/`                                    | Types, Zod schemas, pure state logic     | No I/O, no React, no clock unless passed in. Imported by the server too. |
| `src/data/`                                      | API client, store, sync engine, actions  | The only place that talks to the server or changes client state.         |
| `src/context/`, `src/hooks/`                     | Session, SSE stream, small hooks         |                                                                          |
| `src/components/`, `src/features/`, `src/pages/` | UI                                       | Reads state with `useTrackerState`, acts with `useTracker()`.            |
| `src/i18n/messages/`                             | `zh-CN` and `en` catalogs                | Every user-facing string, in both.                                       |
| `server/`                                        | Express app, routes, providers, security | Thin routes over the repository.                                         |
| `server/db/`                                     | SQLite repository and migrations         | Every write is one transaction.                                          |
| `server/scripts/`                                | QA, perf, screenshots, demo seed, setup  | Never touch `DATA_DIR`.                                                  |

## 3. Invariants

### State is derived, not stored

Only facts are stored: which episodes were watched and when, the playthroughs, a manual paused/dropped mark, a
resume point. Every status shown (unwatched, watching, caught up, completed, unaired, new episodes) is
computed by pure functions in `src/domain` from those facts, the episode air dates and today's **local**
date. Never persist a derived status, never write a placeholder date, and never show an internal key
(`s2e5`, a title id) in the interface.

Nothing in the stored state changes at midnight, so a component that derives anything from the day reads it
with `useToday()` (`src/hooks/useToday.ts`) and passes it on as `todayStr`; a page left open overnight then
computes again. Do not call `toLocalDateString()` in render or leave the day out of a memo's dependencies.

### One write = one transaction = one version = one event

- Each mutation runs in a single `BEGIN IMMEDIATE` transaction, increments the global `version` exactly once
  and returns a `StateMutationResult`. The route broadcasts that same object over SSE and returns it to the
  sender. An operation that spans several rows or several titles (title actions, structure decisions,
  metadata refresh, backup import, library batches) is still one transaction and one event.
- A batch or refresh that changes nothing does not bump the version and is not broadcast.
- Handlers are wrapped in `route()` (`server/http.ts`) so a thrown error or rejected promise reaches the error
  middleware. Request bodies are parsed with the Zod schemas in `src/domain/schemas.ts`.
- The server answers errors with a stable `code` and never with text; the client translates codes. An
  unexpected failure answers `INTERNAL_ERROR` and logs only the stack.
- Logic that both sides must agree on lives in `src/domain` and is called by both (`applyProgressMutation`,
  `planBatchStatus`, `planBatchListEntries`). Do not write a second implementation on either side.

### Every device converges on the server's state

- The client view is the last state confirmed by the server plus this device's pending edits
  (`src/data/syncEngine.ts`). An edit is an overlay: a pure function of the state that tolerates entities that
  have disappeared and is harmless when applied to a state that already contains the edit.
- Actions write only through `commit` / `commitOrThrow` (`src/data/actions/commit.ts`). Rolling back is
  dropping the overlay; never hand-write a revert, and never call `trackerStore.setState` from an action.
- A mutation is applied directly only when it is the next version; a gap, a new server epoch, a backup
  replacement or the SSE handshake noticing a missed event triggers a full snapshot read. Out-of-order and
  duplicate replies must not roll anything back.
- A snapshot read that fails is repeated with a growing delay until one succeeds (`src/data/reconcile.ts`).
  The event stream staying alive is not a reason to stop: its heartbeats carry no version.
- Backup import replaces the state on every device. Merge semantics must not resurrect deleted entities.
- A title is in a list at most once, and the server is what guarantees it: every device makes up the id of
  the entry it adds, so an add for a title already listed is answered with the list as it stands, and an
  entry's title cannot be changed.

### Progress and playthroughs

- Every progress or playthrough write goes through `POST /api/titles/:id/actions` and names the active
  playthrough it was computed from (`expectedActivePlaythroughId`). The server rejects a stale one, any
  structural change without it, a removal that does not delete the matching progress, an added playthrough
  other than the one made active or added together with a removal (either way a list that still names a
  viewing deleted elsewhere), and progress written to anything but the resulting active playthrough.
- `PATCH /api/titles/:id` cannot change the playthroughs, the active playthrough or the source, and
  `PUT /api/titles/:id` only creates: neither may become a way around the check above or replace a title that
  already has progress.
- A watched mark is written only for an episode the title has. A client working from an outdated structure
  gets `STRUCTURE_CONFLICT` and reloads. Marks without an episode exist only in older data and backups, where
  they are kept.
- Starting a viewing completes the one it replaces. Playthroughs are never overwritten and progress is never
  orphaned. Unaired episodes cannot be marked; watched ones can always be unmarked.
- Marking a whole title watched keeps the dates already recorded, a film's included, and does nothing while
  nothing is released (`canMarkWholeTitleWatched`): pausing or dropping a title does not make an upcoming
  film or an unaired series markable, on its page or in a batch.
- Clearing a viewing (`replaceWatched`, or unmarking the whole title) also drops its `archivedWatched`
  marks, so nothing returns when a removed episode comes back.
- The server checks that an episode exists, not that it has aired: "aired" depends on the device's local
  day, which a single-episode write does not carry.
- Library batches go through `POST /api/titles/batch`: at most 1000 titles, all or nothing, titles deleted
  elsewhere skipped. The client sends its local date, which must be a real calendar day, so "aired" means
  the same on the server.
- Only TMDB titles have a release schedule. Episodes of link imports and hand-made titles are always
  available: their dates say when something was published, not when it may be watched.

### Local data is the source of truth

TMDB, Bilibili and YouTube are references that change or disappear.

- A failed upstream request never removes local metadata or progress. A metadata refresh is one transaction.
- Additions and safe text or image updates apply automatically. Seasons and episodes are never removed,
  renumbered or moved between seasons automatically: the difference is shown on the title page with a preview
  and a choice between keeping the local structure and adopting upstream.
- Adopting migrates watched marks by stable episode id, then by air date and order. Marks that match nothing
  are archived with their episode and return when it does. Watch history is never silently deleted.
- A poster the user sets by hand clears the source's localized `posters`, which are otherwise shown first.
- A title with a locked structure only accepts additions: episodes still unmatched after every pass and dated
  on or after the latest local air date are appended to the last season; older or undated ones wait for review.
- A title whose source is gone is marked unavailable: everything is kept, automatic refresh stops, and the
  user can re-link it or keep maintaining it by hand.
- "Refresh all" reports updated, needs review, partial, failed and skipped separately.

### Link import

Zhenji tracks works that can be finished, not feeds.

- Supported: single and multi-part videos, playlists, Bilibili collections and series, courses, bangumi,
  films, live replays. Rejected before anything is created, each with its own code and localized reason: live
  rooms and streams, favorites, Watch Later, channel and uploader pages. Live status is never stored or shown.
- Bilibili is read through its public metadata API first, yt-dlp second, Open Graph last and only with a
  warning; a generic page never refreshes structured metadata. Timestamps become dates in Asia/Shanghai.
- Bilibili collections ("season") and series have separate id spaces and their endpoints do not check the
  uploader. A list is accepted only when the owner the API reports is the uploader in the link; otherwise the
  other kind is tried. The stored source is the canonical `…/lists/<id>?type=season|series`. A list that
  belongs to someone else is a final answer (`LinkImportError.final`) and is never handed to yt-dlp, which
  reads the same endpoints. The old player address `…/medialist/play/<uploader>?business_id=<id>` is rewritten
  to that list address first, so it is read and checked the same way. Normalization recognises an address
  only after the host and language prefix are settled, and never drops a parameter that tells a refused kind
  (favorites) apart before the scope check has run. When the API itself fails and yt-dlp stands in, its list is held to the same
  condition: the `uploader_id` it reports must be the uploader in the link.
- The Open Graph fallback follows redirects, so the page it lands on is checked against the unsupported
  kinds again before anything is read from it.
- Bangumi links search TMDB and offer the matches; without a match, or when the user insists, the link itself
  is imported. Bilibili-only works stay importable.
- YouTube playlists import at once; missing titles and durations are filled in the background with backoff
  and broadcast to every device. At most 2000 entries.

### Security

- Outbound requests for user-supplied links go through `server/security/ssrf.ts`: http(s) only, no
  credentials, every redirect hop re-validated, and the address checked again at connection time.
- yt-dlp follows redirects and fetches further pages on its own, so it always runs behind the loopback proxy
  in `server/security/egressProxy.ts`, which holds every connection it opens to the same rule, and with an
  environment that names no proxy exceptions (`egressProxyEnv`). Only when the operator sets `HTTP_PROXY`,
  `HTTPS_PROXY` or `ALL_PROXY` does yt-dlp use that proxy instead.
- Sessions belong to the password they were opened under: a start with a different password hash (a reset
  through `APP_PASSWORD_HASH`) ends all of them.
- One password (scrypt, constant-time compare), a one-time setup code, hashed session tokens, `HttpOnly`
  `SameSite=Lax` cookies that are `Secure` in production, an Origin check on cookie-authenticated writes, and
  rate limiting of wrong passwords and wrong setup codes per client and globally.
- `CF-Connecting-IP`, `X-Forwarded-For` (last entry) and `X-Forwarded-Host` are trusted only with
  `TRUST_PROXY=1`.
- Secrets and API keys live in `.env` on the server and are never sent to the browser, logged or committed.

### Storage and migrations

- All persistent data is inside `DATA_DIR`. Demo seeding, QA, perf and screenshots use their own temporary
  directories and refuse to touch it.
- `server/db/migrations.ts` is the ordered list of schema and data changes. A shipped step is immutable and
  versions are contiguous; fix a mistake with a new step, and make data steps safe to repeat. A database
  newer than the code is refused, not modified. A safety backup is taken before migrating or importing; if it
  cannot be written, the migration or import does not happen.
- Importing replaces the library, so the payload must be a backup: a v2 envelope, or a v1 object with
  `titles`. Anything else, such as `{}`, is rejected.
- The v2 export envelope is stable, and v1 and early v2 backups must keep importing
  (`docs/data-format.md`). Keep that document true when a stored field changes. An import issues a new
  `episodeDetailsVersion` for every title, so no client keeps episode details cached from before it.

## 4. Interface

### HeroUI v3

- The installed version decides, not memory and not an example for another release: read the types and
  styles in `node_modules/@heroui/react` and `node_modules/@heroui/styles` before using a component.
- Compose HeroUI components; use a raw interactive element only through a documented `render` prop or where
  HeroUI has no component (the file input). Appearance comes from variants and composition; `className` on a
  HeroUI component is for layout and sizing.
- Never restyle HeroUI through its internal class names (`.toast`, `.tabs__tab`, …) in `src/index.css`, and
  never pile utilities on a component to make it look like a different one. If a design needs that, pick
  another component.
- Colors are HeroUI's semantic utilities (`text-muted`, `bg-surface`, `border-border`, `bg-accent-soft`, …),
  not `[var(--token)]`. A token HeroUI lacks is defined for both themes in `src/index.css` and registered
  with `@theme inline`.
- Navigation is a link: router `Link`/`NavLink`, `ButtonLink` when it should look like a button, or `href` on
  a HeroUI item (routed through `RouterProvider`). Not a button or a `div` that calls `navigate()`.
- Every `Dropdown.Item` and `ListBox.Item` has a `textValue`. Async confirm buttons use `isPending` with
  `withPendingSpinner` and `usePendingAction`, which also ignores a second press. Numbers use `NumberField`.
- HeroUI's `NumberField` clamps to its `minValue`/`maxValue`; do not add range checks it makes unreachable.
  Confirmation dialogs (`AlertDialog`) allow Escape, which cancels.
- A dialog captures its form state when it opens: a synced update must not reset what the user is typing,
  and saving an untouched form writes nothing.
- Keep accessible names, keyboard operation and a visible focus indicator on everything interactive.

### State in components

- `useTracker()` gives session status and actions and never changes with the data. Data comes from
  `useTrackerState(selector)` with a selector defined outside the component (or memoized), so a component
  re-renders only for what it shows. Do not read `trackerStore` in render.
- A screen that can show hundreds of items renders them from deferred state (`useDeferredValue`), keeps item
  components memoized and mounted across mode switches, and never does work proportional to the whole list on
  a single tap. The title page bounds its DOM with episode ranges for the same reason.
- `index.html` keeps a hidden `<div>` after `#root`; removing it makes every menu, dialog and toast restyle
  the whole app.

### Layout and design

- Three layouts, all first-class: phone below 640 px (bottom tab bar), tablet 640–1023 px (navigation rail),
  desktop from 1024 px (sidebar). Whatever one navigation offers must be reachable from the others. Fixed
  bars must clear the phone tab bar and the safe-area insets; nothing may overflow horizontally at 320 px.
- Calm, Infuse-like: uncluttered, one accent color reserved for the primary action, posters first. A card
  shows a poster, a title and one line of status. Rare or advanced controls go into menus.
- User text can be long and unbroken: headings and list items wrap anywhere, single-line fields truncate, and
  an image that fails to load falls back to a placeholder, never a broken-image icon.
- Each screen names the browser tab (`usePageTitle`).
- New navigation starts at the top; Back restores the previous scroll position. A deep link selects its
  season once and does not override a later choice.

### Text

Every string the user can see is in `src/i18n/messages` in both languages, with matching keys (camelCase,
except maps keyed by domain ids such as statuses and error codes). No CJK literals elsewhere in `src/` or
`server/`. Plurals and counts are functions in the catalog.

## 5. Tests

- Vitest only, and offline: no test calls a real upstream. Providers take injected `fetchFn`, `execFn` and
  `lookupFn`.
- Every bug gets a regression test that fails without the fix and is named for the behavior. Do not weaken
  an assertion to make a change pass.
- Cover both sides of anything shared, rollback on failure, and the cases that have bitten before: deleted
  upstream entries, removed or split seasons, locked structures, returning episodes, every rejected link
  category, bangumi with and without TMDB matches, lists whose id belongs to another uploader, migrations
  from every earlier version.
- `npm run qa` drives the production build in Chromium at 320, 390, 768, 820, 1280 and 1440 px, in both
  languages and both themes, with two devices for sync, and fails on any console error. When a screen
  changes, extend it; do not narrow it.
- `npm run perf` measures on a 300-title library with the CPU slowed four times. Keep the budgets; change one
  only with the measurement that justifies it.
- When a screen shown in the README changes, run `npm run seed:demo && npm run build && npm run screenshots`
  with `TMDB_READ_TOKEN` and `OMDB_API_KEY` empty and review `docs/screenshots`.
- Checks against real services are done by hand in an isolated environment with keys from the environment.
  Neither the keys nor scripts that need them are committed.

## 6. Deployment

- Three supported ways to run the same code: Docker, Podman (including rootless) and plain Node.js.
  `docs/deployment.md` describes all three and must stay true.
- Image names in the Dockerfile and the compose file are fully qualified. The container runs as uid 1000 and
  writes `DATA_DIR` at runtime, plus `/opt/yt-dlp`, which the image hands to that user on purpose: the daily
  `yt-dlp -U` is what keeps link import working when a site changes.
- The compose `tailscale` service shares the app's network namespace, because `tailscale serve` only
  proxies to the machine it runs on.
- `npm start` serves the production build without `NODE_ENV`. The PWA manifest is defined in
  `vite.config.ts`, not under `public/`.
- CI runs format, lint, tests, build and QA, then builds the image and starts it with Docker and with
  rootless Podman, checking `/healthz`.
