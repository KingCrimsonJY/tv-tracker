import type { LinkImportResult, StateMutationResult } from '../src/domain/types.ts';
import type { TrackerRepository } from './db/repository.ts';
import { classifyLinkFailure } from './providers/linkErrors.ts';

export function createPlaylistEnricher(options: {
  repo: TrackerRepository;
  loadVideo: (url: string) => Promise<LinkImportResult>;
  broadcast: (mutation: StateMutationResult) => unknown;
}) {
  const { repo, loadVideo, broadcast } = options;
  const queued = new Set<string>();
  const active = new Set<string>();
  const waiters = new Set<() => void>();
  let stopped = false;

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
    const attempted = new Set<string>();
    while (!stopped && attempted.size < 2000) {
      const title = repo.getTitle(id);
      if (!title || title.source !== 'url' || title.sourceId !== sourceUrl || title.sourceUnavailable) return;
      const episode = repo
        .getSeasons(id)
        .flatMap((s) => s.episodes)
        .find(
          (ep) =>
            ep.sourceVideoId &&
            /^[\w-]{11}$/.test(ep.sourceVideoId) &&
            !attempted.has(ep.sourceVideoId) &&
            (!ep.name || ep.runtime == null),
        );
      const videoId = episode?.sourceVideoId;
      if (!videoId) return;
      attempted.add(videoId);
      try {
        const detail = await loadVideo('https://www.youtube.com/watch?v=' + videoId);
        if (stopped) return;
        const mutation = repo.fillEpisodeMetadata(id, sourceUrl, videoId, detail);
        if (mutation) broadcast(mutation);
      } catch (error) {
        if (['LINK_RATE_LIMITED', 'LINK_LOGIN_REQUIRED', 'YTDLP_MISSING'].includes(classifyLinkFailure(error).code))
          return;
        // Retain the episode and retry missing details on a later refresh/restart.
      }
    }
  };
  const drain = () => {
    if (stopped) return;
    for (const id of queued) {
      if (active.size >= 2) break;
      if (active.has(id)) continue;
      queued.delete(id);
      active.add(id);
      void processTitle(id)
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
      if (!active.size) {
        for (const done of waiters) done();
        waiters.clear();
      }
    },
  };
}
