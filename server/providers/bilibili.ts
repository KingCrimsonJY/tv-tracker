import { assertSupportedLinkType } from './linkScope.ts';
import { z } from 'zod';
import type { LinkImportEpisodeSeed, LinkImportResult } from '../../src/domain/types.ts';
import {
  safeFetchFollowingRedirects,
  readResponseText,
  UnsafeUrlError,
  type SafeFetchOptions,
} from '../security/ssrf.ts';
import { LinkImportError } from './linkErrors.ts';
import { isBilibiliUrl } from './linkUrls.ts';

const MAX_EPISODES = 2000;
const id = z.union([z.number(), z.string()]).transform(String);
const nullableText = z.string().nullable().optional();
const episodeSchema = z.object({
  id,
  title: z.string(),
  long_title: nullableText,
  show_title: nullableText,
  duration: z.number().optional(),
  cover: nullableText,
  pub_time: z.number().optional(),
  section_type: z.number().optional(),
  release_date: z.union([z.string(), z.number()]).optional(),
  playable: z.boolean().optional(),
  rights: z.object({ area_limit: z.number().optional() }).optional(),
});
const seasonSchema = z.object({
  title: z.string().min(1),
  cover: nullableText,
  evaluate: nullableText,
  subtitle: nullableText,
  type: z.number().optional(),
  season_id: id,
  episodes: z.array(episodeSchema),
  publish: z.object({ pub_time: nullableText }).optional(),
  up_info: z.object({ uname: nullableText }).optional(),
  ep_count: z.number().optional(),
});
const archiveSchema = z.object({
  bvid: z.string().optional(),
  bv_id: z.string().optional(),
  id: id.optional(),
  title: z.string(),
  duration: z.number().optional(),
  pic: nullableText,
  cover: nullableText,
  pubdate: z.number().optional(),
  pubtime: z.number().optional(),
});
const listMetaSchema = z.object({
  mid: id.optional(),
  name: z.string(),
  description: nullableText,
  cover: nullableText,
});
const archivePageSchema = z.object({
  archives: z.array(archiveSchema).optional(),
  page: z.object({ total: z.number(), page_size: z.number().optional(), size: z.number().optional() }).optional(),
  meta: listMetaSchema.optional(),
  has_more: z.boolean().optional(),
});

function episodeName(episode: z.infer<typeof episodeSchema>): string {
  return (episode.show_title || [episode.title, episode.long_title].filter(Boolean).join(' ')).slice(0, 300);
}

function cover(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith('//') ? 'https:' + raw : raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.protocol = 'https:';
    return url.toString().slice(0, 1000);
  } catch {
    return null;
  }
}

function minutes(seconds?: number): number | null {
  return seconds && seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null;
}

function date(seconds?: number): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const value = new Date(seconds * 1000);
  return Number.isNaN(value.getTime())
    ? null
    : new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(value);
}

function base(url: string, title: string): LinkImportResult {
  return {
    kind: 'video',
    title: title.slice(0, 200),
    sourceUrl: url,
    posterUrl: null,
    overview: '',
    uploader: null,
    year: null,
    runtimeMin: null,
    episodes: [],
    fallbackUsed: 'bilibili',
    mediaType: 'other',
  };
}

/** Metadata only: never calls playback, signed media URLs, or account endpoints. */
export async function resolveBilibiliMetadata(
  input: string,
  deps: SafeFetchOptions & { forceImport?: boolean } = {},
): Promise<LinkImportResult | null> {
  assertSupportedLinkType(input);
  const url = new URL(input);
  if (!isBilibiliUrl(url)) return null;
  const signal = AbortSignal.timeout(30_000);

  async function api(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
    const target = new URL(endpoint, 'https://api.bilibili.com/');
    Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, value));
    const { response } = await safeFetchFollowingRedirects(
      target.toString(),
      {
        headers: { Referer: 'https://www.bilibili.com/', 'User-Agent': 'Zhenji/1.0 (metadata tracker)' },
        signal,
      },
      deps,
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Bilibili HTTP ' + response.status);
    }
    const payload = z
      .object({
        code: z.number(),
        message: z.string().optional(),
        data: z.unknown().optional(),
        result: z.unknown().optional(),
      })
      .parse(JSON.parse(await readResponseText(response, 4 * 1024 * 1024)));
    if (payload.code !== 0) {
      const code =
        payload.code === -101 || payload.code === -403
          ? 'LINK_LOGIN_REQUIRED'
          : payload.code === -404
            ? 'LINK_UNAVAILABLE'
            : payload.code === -412 || payload.code === -352
              ? 'LINK_RATE_LIMITED'
              : 'LINK_PARSE_FAILED';
      throw new LinkImportError(code, 'Bilibili metadata request failed (' + payload.code + ').');
    }
    return payload.result ?? payload.data;
  }

  const videoId = /^\/video\/(BV[\da-z]+|av\d+)\/?$/i.exec(url.pathname)?.[1] ?? url.searchParams.get('bvid');
  if (videoId && url.hostname === 'www.bilibili.com') {
    const data = z
      .object({
        bvid: z.string(),
        title: z.string().min(1),
        pic: nullableText,
        desc: nullableText,
        pubdate: z.number().optional(),
        duration: z.number().optional(),
        owner: z.object({ name: z.string() }).optional(),
        pages: z.array(
          z.object({ page: z.number().int().positive(), part: z.string(), duration: z.number().optional() }),
        ),
      })
      .parse(await api('/x/web-interface/view', /^av/i.test(videoId) ? { aid: videoId.slice(2) } : { bvid: videoId }));
    const selected = url.searchParams.get('p');
    const part = selected ? data.pages.find((p) => String(p.page) === selected) : undefined;
    if (selected && !part) throw new LinkImportError('LINK_UNAVAILABLE', 'The requested video part does not exist.');
    const source = new URL('https://www.bilibili.com/video/' + data.bvid);
    if (part) source.searchParams.set('p', String(part.page));
    const result = base(source.toString(), part && data.pages.length > 1 ? data.title + ' · ' + part.part : data.title);
    result.posterUrl = cover(data.pic);
    result.overview = (data.desc === '-' ? '' : data.desc || '').slice(0, 2000);
    result.uploader = data.owner?.name ?? null;
    result.year = date(data.pubdate) ? Number(date(data.pubdate)?.slice(0, 4)) : null;
    result.runtimeMin = minutes(part?.duration ?? data.duration);
    if (!selected && data.pages.length > 1) {
      if (data.pages.length > MAX_EPISODES)
        throw new LinkImportError('LINK_PLAYLIST_TOO_LARGE', 'Playlist exceeds 2000 entries.');
      result.kind = 'playlist';
      result.runtimeMin = null;
      result.episodes = data.pages.map((p) => ({
        name: p.part.slice(0, 300),
        sourceVideoId: data.bvid + '_p' + p.page,
        runtime: minutes(p.duration),
        airDate: date(data.pubdate),
      }));
    }
    return result;
  }

  const bangumi = /\/bangumi\/(?:play|media)\/(ss|ep|md)(\d+)/.exec(url.pathname);
  const cheese = /\/cheese\/play\/(ss|ep)(\d+)/.exec(url.pathname);
  const match = bangumi || cheese;
  if (match) {
    const isCourse = Boolean(cheese);
    let query = { [match[1] === 'ep' ? 'ep_id' : 'season_id']: match[2] };
    if (match[1] === 'md') {
      const media = z
        .object({ media: z.object({ season_id: id }) })
        .parse(await api('/pgc/review/user', { media_id: match[2] }));
      query = { season_id: media.media.season_id };
    }
    const data = seasonSchema.parse(await api(isCourse ? '/pugv/view/web/season' : '/pgc/view/web/season', query));
    const selected = match[1] === 'ep' ? data.episodes.find((ep) => ep.id === match[2]) : undefined;
    if (match[1] === 'ep' && !selected)
      throw new LinkImportError('LINK_UNAVAILABLE', 'The requested episode is unavailable.');
    // The main array can interleave trailers and bonus clips with full episodes.
    // Use the provider's section marker, not titles or duration, to avoid misnumbering.
    const selectedEpisodes = selected
      ? [selected]
      : isCourse
        ? data.episodes
        : data.episodes.filter((ep) => ep.section_type === undefined || ep.section_type === 0);
    if (!selectedEpisodes.length) throw new LinkImportError('LINK_EMPTY_PLAYLIST', 'No episodes are available.');
    if (selectedEpisodes.length > MAX_EPISODES)
      throw new LinkImportError('LINK_PLAYLIST_TOO_LARGE', 'Playlist exceeds 2000 entries.');
    const title = selected ? (isCourse ? selected.title : data.title + ' · ' + episodeName(selected)) : data.title;
    const result = base(input, title);
    if (selected && !isCourse) result.seriesTitle = data.title;
    result.kind = !isCourse && !deps.forceImport ? 'tmdb-suggestion' : selected ? 'video' : 'playlist';
    result.mediaType = isCourse || selected ? 'other' : data.type === 2 ? 'movie' : 'tv';
    result.posterUrl = cover(selected?.cover || data.cover);
    result.overview = (data.evaluate || data.subtitle || '').slice(0, 2000);
    result.uploader = data.up_info?.uname ?? null;
    result.year = data.publish?.pub_time ? Number(data.publish.pub_time.slice(0, 4)) || null : null;
    const runtimeEpisode = selected ?? (!isCourse && data.type === 2 ? selectedEpisodes[0] : undefined);
    result.runtimeMin = minutes((runtimeEpisode?.duration ?? 0) / (isCourse ? 1 : 1000));
    if (!selected) {
      result.episodes = selectedEpisodes.map((ep) => ({
        sourceVideoId: ep.id,
        name: episodeName(ep),
        runtime: minutes((ep.duration ?? 0) / (isCourse ? 1 : 1000)),
        airDate: date(ep.pub_time ?? (typeof ep.release_date === 'number' ? ep.release_date : undefined)),
      }));
    }
    if (selectedEpisodes.some((ep) => ep.rights?.area_limit || (isCourse && ep.playable === false))) {
      result.warning = 'LINK_PLAYBACK_RESTRICTED';
    }
    if (!selected && isCourse && data.ep_count && data.ep_count > result.episodes.length) {
      result.warning = 'LINK_METADATA_INCOMPLETE';
    }
    return result;
  }

  const space = /^\/(\d+)\/(?:lists\/(\d+)|channel\/(collectiondetail|seriesdetail))\/?$/.exec(url.pathname);
  if (space && url.hostname === 'space.bilibili.com') {
    const mid = space[1];
    const sid = space[2] || url.searchParams.get('sid') || '';
    if (!/^\d+$/.test(sid)) throw new LinkImportError('LINK_PARSE_FAILED', 'Playlist id is missing.');
    const type = url.searchParams.get('type');
    const declared: SpaceListKind | null =
      space[3] === 'seriesdetail' || type === 'series'
        ? 'series'
        : space[3] === 'collectiondetail' || type === 'season'
          ? 'season'
          : null;
    // Collections and series have separate id spaces, and neither endpoint checks the uploader: an id that
    // belongs to someone else's list of the other kind still answers. Try the declared kind first, then the
    // other one, and accept only a list owned by the uploader in the link.
    const kinds: SpaceListKind[] = declared === 'series' ? ['series', 'season'] : ['season', 'series'];
    let failure: unknown;
    let ownedByAnother = false;
    for (const kind of kinds) {
      try {
        const list = await loadSpaceList(api, kind, mid, sid);
        if (list) return list;
        ownedByAnother = true;
      } catch (err) {
        // A definite answer for the declared kind (for example a real but empty collection) is final.
        if (kind === declared || err instanceof UnsafeUrlError) throw err;
        failure ??= err;
      }
    }
    // The id is a real list of another uploader. yt-dlp does not compare the uploader either, so handing the
    // link to it would import a stranger's videos.
    if (ownedByAnother || !failure) {
      throw new LinkImportError('LINK_UNAVAILABLE', 'The playlist does not belong to this uploader.', { final: true });
    }
    throw failure;
  }
  return null;
}

type SpaceListKind = 'season' | 'series';
type BilibiliApi = (endpoint: string, params?: Record<string, string>) => Promise<unknown>;

/**
 * Load one uploader list (collection = "season", or series). Returns null when the id exists but belongs to
 * another uploader, so the caller can try the other kind instead of importing a stranger's videos.
 */
async function loadSpaceList(
  api: BilibiliApi,
  kind: SpaceListKind,
  mid: string,
  sid: string,
): Promise<LinkImportResult | null> {
  const source = 'https://space.bilibili.com/' + mid + '/lists/' + sid + '?type=' + kind;
  let seriesMeta: z.infer<typeof listMetaSchema> | undefined;
  if (kind === 'series') {
    seriesMeta = z.object({ meta: listMetaSchema }).parse(await api('/x/series/series', { series_id: sid })).meta;
    if (seriesMeta.mid !== undefined && seriesMeta.mid !== mid) return null;
  }
  const pageSize = 100;
  const entries: LinkImportEpisodeSeed[] = [];
  const seen = new Set<string>();
  let result: LinkImportResult | null = null;
  let total = 0;
  let received = 0;
  // Providers may clamp the requested page size. Bound requests independently.
  for (let page = 1; page <= 100; page++) {
    const params: Record<string, string> =
      kind === 'series'
        ? { mid, series_id: sid, pn: String(page), ps: String(pageSize) }
        : { mid, season_id: sid, page_num: String(page), page_size: String(pageSize) };
    const data = archivePageSchema.parse(
      await api(kind === 'series' ? '/x/series/archives' : '/x/polymer/web-space/seasons_archives_list', params),
    );
    const items = data.archives ?? [];
    if (page === 1) {
      const meta = seriesMeta ?? data.meta;
      if (kind === 'season' && meta?.mid !== undefined && meta.mid !== mid) return null;
      total = data.page?.total ?? items.length;
      if (total > MAX_EPISODES) throw new LinkImportError('LINK_PLAYLIST_TOO_LARGE', 'Playlist exceeds 2000 entries.');
      result = base(source, meta?.name || '');
      if (!result.title) throw new LinkImportError('LINK_PARSE_FAILED', 'Playlist title is missing.');
      result.kind = 'playlist';
      result.posterUrl = cover(meta?.cover || items[0]?.pic || items[0]?.cover);
      result.overview = (meta?.description || '').slice(0, 2000);
    }
    const previousCount = entries.length;
    received += items.length;
    for (const item of items) {
      const videoId = item.bvid || item.bv_id || item.id;
      if (!videoId || seen.has(videoId)) continue;
      seen.add(videoId);
      entries.push({
        sourceVideoId: videoId,
        name: item.title.slice(0, 300),
        runtime: minutes(item.duration),
        airDate: date(item.pubdate ?? item.pubtime),
      });
    }
    if (entries.length > MAX_EPISODES)
      throw new LinkImportError('LINK_PLAYLIST_TOO_LARGE', 'Playlist exceeds 2000 entries.');
    if (!items.length || entries.length === previousCount || (received >= total && !data.has_more)) break;
  }
  if (!result || !entries.length)
    throw new LinkImportError('LINK_EMPTY_PLAYLIST', 'The playlist is empty or inaccessible.');
  result.episodes = entries;
  if (entries.length < total) result.warning = 'LINK_METADATA_INCOMPLETE';
  return result;
}
