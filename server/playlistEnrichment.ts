import type { LinkImportResult, StateMutationResult } from '../src/domain/types.ts';
import type { TrackerRepository } from './db/repository.ts';
import { classifyLinkFailure } from './providers/linkErrors.ts';

export function createPlaylistEnricher(options: {
  repo: TrackerRepository;
  loadVideo: (url: string) => Promise<LinkImportResult>;
  broadcast: (mutation: StateMutationResult) => unknown;
  now?: () => number;
}) {
  const { repo, loadVideo, broadcast, now = Date.now } = options;
  const queued = new Set<string>();
  const active = new Set<string>();
  const waiters = new Set<() => void>();
  let stopped = false;
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const processTitle = async (id: string) => {
    const sourceUrl = repo.getTitle(id)?.sourceId;
    if (!sourceUrl) return;
    let url: URL;
    try {
      url = new URL(sourceUrl);
    } catch {
      return;
    }
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) return;
    if (!repo.enrichmentDue(id, sourceUrl, '*', now())) return 60_000;
    const pending: Array<{ videoId: string; detail: LinkImportResult }> = [];
    const flush = () => {
      if (!pending.length) return;
      const mutation = repo.fillEpisodeMetadataBatch(id, sourceUrl, pending.splice(0));
      if (mutation) broadcast(mutation);
    };
    const episodes = repo.getSeasons(id).flatMap((season) => season.episodes);
    const attempted = new Set<string>();
    let lastFlush = now();
    try {
      for (const episode of episodes) {
        if (stopped || attempted.size >= 50) break;
        const videoId = episode.sourceVideoId;
        if (
          !videoId ||
          !/^[\w-]{11}$/.test(videoId) ||
          attempted.has(videoId) ||
          (episode.name && episode.runtime != null)
        )
          continue;
        const title = repo.getTitle(id);
        if (!title || title.source !== 'url' || title.sourceId !== sourceUrl || title.sourceUnavailable) break;
        if (!repo.claimEnrichment(id, sourceUrl, videoId, now())) continue;
        attempted.add(videoId);
        try {
          const detail = await loadVideo('https://www.youtube.com/watch?v=' + videoId);
          pending.push({ videoId, detail });
          if (pending.length >= 10 || now() - lastFlush >= 5000) {
            flush();
            lastFlush = now();
          }
        } catch (error) {
          if (['LINK_RATE_LIMITED', 'LINK_LOGIN_REQUIRED', 'YTDLP_MISSING'].includes(classifyLinkFailure(error).code)) {
            repo.claimEnrichment(id, sourceUrl, '*', now());
            break;
          }
        }
      }
    } finally {
      flush();
    }
    const current = repo.getTitle(id);
    if (
      current?.source === 'url' &&
      current.sourceId === sourceUrl &&
      !current.sourceUnavailable &&
      repo
        .getSeasons(id)
        .some((season) =>
          season.episodes.some(
            (ep) => ep.sourceVideoId && /^[\w-]{11}$/.test(ep.sourceVideoId) && (!ep.name || ep.runtime == null),
          ),
        )
    )
      return 60_000;
  };

  const drain = () => {
    if (stopped) return;
    for (const id of queued) {
      if (active.size >= 2) break;
      if (active.has(id)) continue;
      queued.delete(id);
      active.add(id);
      void processTitle(id)
        .then((delay) => {
          if (!stopped && delay)
            retryTimers.set(
              id,
              setTimeout(() => {
                retryTimers.delete(id);
                queued.add(id);
                drain();
              }, delay),
            );
        })
        .catch(() => {})
        .finally(() => {
          active.delete(id);
          drain();
          if (!active.size && !queued.size) {
            for (const done of waiters) done();
            waiters.clear();
          }
        });
    }
  };
  return {
    schedule(id: string) {
      if (!stopped) {
        const retry = retryTimers.get(id);
        if (retry) clearTimeout(retry);
        retryTimers.delete(id);
        queued.add(id);
        queueMicrotask(drain);
      }
    },
    idle(): Promise<void> {
      return !active.size && !queued.size
        ? Promise.resolve()
        : new Promise((resolve) => {
            waiters.add(resolve);
          });
    },
    stop() {
      stopped = true;
      queued.clear();
      for (const timer of retryTimers.values()) clearTimeout(timer);
      retryTimers.clear();
      if (!active.size) {
        for (const done of waiters) done();
        waiters.clear();
      }
    },
  };
}
