import { startTransition, useEffect, useState } from 'react';
import { ApiError, fetchTitleDetailsApi } from '../../data/api';
import type { SeasonDoc } from '../../domain/types';

interface CacheEntry {
  summary: SeasonDoc[];
  revision: number;
  loadedAt: number;
  data?: SeasonDoc[];
  promise: Promise<SeasonDoc[]>;
}
const cache = new Map<string, CacheEntry>();

/**
 * Episode names, stills and overviews of one title. A request that fails for a passing reason (no network,
 * a 5xx) is repeated a few times: nothing else would ask again while the page stays open, and the page
 * would keep showing episodes without their names.
 */
export async function loadTitleEpisodes(id: string, retryDelaysMs = [2000, 5000, 15_000]): Promise<SeasonDoc[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await fetchTitleDetailsApi(id)).seasons;
    } catch (err) {
      const passing = !(err instanceof ApiError) || err.status >= 500;
      if (!passing || attempt >= retryDelaysMs.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
    }
  }
}
const empty: SeasonDoc[] = [];
export function useTitleEpisodes(id: string | undefined, summary: SeasonDoc[] | undefined, revision = 0): SeasonDoc[] {
  const [loaded, setLoaded] = useState<{ id: string; entry: CacheEntry } | null>(null);
  useEffect(() => {
    if (!id || !summary?.length) return;
    let entry = cache.get(id);
    if (!entry || entry.summary !== summary || entry.revision !== revision || Date.now() - entry.loadedAt > 300_000) {
      const promise = loadTitleEpisodes(id);
      entry = { summary, revision, loadedAt: Date.now(), promise };
      cache.set(id, entry);
      if (cache.size > 30) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
    }
    const current = entry;
    let disposed = false;
    void current.promise
      .then((data) => {
        current.data = data;
        if (!disposed) startTransition(() => setLoaded({ id, entry: current }));
      })
      .catch(() => {
        if (cache.get(id) === current) cache.delete(id);
      });
    return () => {
      disposed = true;
    };
  }, [id, summary, revision]);
  const entry = loaded && loaded.id === id ? loaded.entry : id ? cache.get(id) : undefined;
  return entry?.summary === summary && entry?.revision === revision && entry.data ? entry.data : summary || empty;
}
