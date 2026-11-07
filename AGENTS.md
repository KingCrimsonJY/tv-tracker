# Project rules

## Working agreement

- Work from the latest `main` on a branch. Keep commits focused; when a request is divided into sections, make one commit per section. Open a PR with concise, idiomatic English and validation results.
- Run installs, builds, commands and tests inside disposable Podman containers. Never install packages on the host or mount a host project directory. Retain the development container, credentials, images and caches until the user explicitly requests cleanup. Do not remove unrelated resources.
- Ask the user before adding dependencies or external services, changing the export format, or removing any feature not explicitly listed in the request.
- Data changes require migrations. Keep both v1 and v2 backup imports working; retain the existing v2 export envelope.
- Use strict TypeScript. No `any` and no non-null assertions.
- Prefer HeroUI v3 components to raw interactive elements. Use `className` on HeroUI components for layout only; use documented variants and composition for appearance and behavior. Keep business components as clear compositions of these primitives.
- Put every user-facing string in `src/i18n/messages`, in both `zh-CN` and `en`. Servers return error codes, not user-facing text.
- Keep files under about 400 lines; extract cohesive modules when needed.
- Use Vitest only. Tests must not call real upstream networks. Add a meaningful regression test for every bug.
- Check the installed HeroUI version as well as the current documentation: examples can differ from the released implementation. Preserve accessible labels, keyboard interaction and visible focus.

## Data safety and deployment

- Demo seeding must never touch `DATA_DIR` and must refuse to delete directories it did not create.
- A failed upstream request must never remove local metadata or progress. Metadata refresh is a single server-side transaction.
- Refresh All reports updated, needs review, partial, failed and skipped separately, including missing provider configuration.
- CI must run lint, Vitest and the production build, build the Docker image, start it and verify `/healthz`.
- `npm start` serves the production build without requiring the caller to set `NODE_ENV`. README offline timing must match the heartbeat watchdog and countdown.

## Synchronization

- All open devices converge to server state, including out-of-order mutation responses/SSE events, the initial SSE connection, reconnects and backup replacement.
- Backup import replaces state on all devices; it must not leave deleted entities behind through merge semantics.
- Concurrent attempts to start a rewatch must produce a conflict, never overwrite playthroughs or orphan progress.

## Upstream changes

- Local data is the source of truth. TMDB and Bilibili are references that may change or disappear.
- Automatically apply additions and safe text/image updates.
- Never automatically remove or renumber seasons/episodes. Show structural changes on the title page with a preview and a choice to keep the local structure or adopt the upstream structure.
- On adoption, migrate watched marks by TMDB episode id first, then air date and order. Preserve unmatched marks so they return if the episode returns. Synchronization never silently deletes watched history.
- Each title can lock its season structure. Continue safe text/image updates and append new episode identities to the end of the last local season in air-date order. Locking prevents removal, renumbering and moving existing episodes between seasons.
- A missing upstream title/video is marked source unavailable; preserve everything and stop automatic refresh. Offer re-linking to another TMDB entry or conversion to manual maintenance.

## Link imports

- Zhenji tracks works that can be finished, not feeds.
- Support single videos, multipart videos, playlists, Bilibili collections and series, courses, live replays and bangumi.
- Reject live rooms/live streams, favorites, Watch Later and channel/user upload pages before creating anything, with localized reasons. Suggest importing a replay after a live stream ends. Do not persist live status or display a live-status chip.
- For bangumi links, automatically search TMDB. Show matches when available; otherwise default to importing the link. Bilibili-only works must remain importable.
- Keep the Bilibili metadata client only for supported types, with yt-dlp fallback. Convert Bilibili timestamps using Asia/Shanghai dates.
- YouTube playlist imports return quickly. Fill missing titles/durations in the background and broadcast enrichment to every open device.
- Remove the legacy `2020-01-01` placeholder air date from custom/link episodes, including imported legacy backups.

## UI behavior and acceptance

- A Home next-episode deep link selects its season once; it must not override later user selections.
- Episode checkboxes and primary actions use the same aired rule. Watched episodes can always be unchecked.
- Use local calendar dates for today throughout the UI.
- New navigation starts at the top; browser Back restores the previous scroll position.
- Poster columns depend on available content width, including the sidebar. Keep labels readable at 320 px and 1024 px layouts.
- Use camelCase i18n keys and HeroUI NumberField for numeric add-dialog inputs.
- Regression coverage includes deleted upstream entries, removed/split seasons, locked structure, returning episodes, every rejected link category, and bangumi with/without TMDB matches.
- Verify changed screens at 320, 390 and 1280 px in both languages with a clean browser console. Report lint, tests, frontend build, Docker build and health results, and mark each numbered request done, partly done or skipped with a brief explanation.

## Design

- Keep a calm, Infuse-like look with uncluttered layouts.
- Reserve one accent color for the primary action.
- Put advanced or rarely used controls in menus and reveal detail progressively.
- Never show internal keys in user-facing text.
