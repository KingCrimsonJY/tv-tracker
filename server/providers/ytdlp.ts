import { assertSupportedLinkType } from './linkScope.ts';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { isGenericEpisodeLabel } from '../../src/domain/airing.ts';
import type { LinkImportEpisodeSeed, LinkImportResult } from '../../src/domain/types.ts';
import { LinkImportError } from './linkErrors.ts';
import { isBangumiUrl } from './linkUrls.ts';
import { egressProxyEnv, sharedEgressProxyUrl } from '../security/egressProxy.ts';
import { assertSafePublicUrl, type DnsLookupFn } from '../security/ssrf.ts';

export const YTDLP_TIMEOUT_MS = 30_000;
export const YTDLP_MAX_BUFFER_BYTES = 20 * 1024 * 1024; // 20 MB

export class YtdlpNotInstalledError extends Error {
  public readonly code = 'YTDLP_MISSING';
  constructor(binaryPath: string) {
    super(`yt-dlp executable not found (${binaryPath})`);
    this.name = 'YtdlpNotInstalledError';
  }
}

export class YtdlpExecutionError extends Error {
  public readonly code: string;
  constructor(message: string, code = 'YTDLP_FAILED') {
    super(message);
    this.name = 'YtdlpExecutionError';
    this.code = code;
  }
}

export interface YtdlpExecResult {
  stdout: string;
  stderr: string;
}

export type YtdlpExecFn = (
  file: string,
  args: readonly string[],
  options: { timeout: number; maxBuffer: number; env?: NodeJS.ProcessEnv },
) => Promise<YtdlpExecResult>;

export const defaultYtdlpExec: YtdlpExecFn = (file, args, options) =>
  new Promise<YtdlpExecResult>((resolve, reject) => {
    execFile(
      file,
      [...args],
      {
        timeout: options.timeout,
        maxBuffer: options.maxBuffer,
        ...(options.env ? { env: options.env } : {}),
        windowsHide: true,
        shell: false,
      },
      (err, stdout, stderr) => {
        if (err) {
          const errno = (err as NodeJS.ErrnoException).code;
          if (errno === 'ENOENT') {
            reject(new YtdlpNotInstalledError(file));
            return;
          }
          if ((err as { killed?: boolean }).killed || errno === 'ETIMEDOUT') {
            reject(new YtdlpExecutionError('yt-dlp timed out (30s)', 'YTDLP_TIMEOUT'));
            return;
          }
          reject(new YtdlpExecutionError(stderr?.trim() || err.message || 'yt-dlp execution failed', 'YTDLP_FAILED'));
          return;
        }
        resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
      },
    );
  });

const ytdlpThumbnailSchema = z.object({
  url: z.string().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
});

const ytdlpEntrySchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .nullable()
    .optional(),
  title: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  ie_key: z.string().nullable().optional(),
  live_status: z.string().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
});

export const ytdlpOutputSchema = z.object({
  live_status: z.string().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  thumbnails: z.array(ytdlpThumbnailSchema).nullable().optional(),
  uploader: z.string().nullable().optional(),
  uploader_id: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .nullable()
    .optional(),
  webpage_url: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  upload_date: z.string().nullable().optional(),
  _type: z.string().nullable().optional(),
  entries: z.array(ytdlpEntrySchema.nullable()).nullable().optional(),
  playlist_count: z.number().nullable().optional(),
  extractor: z.string().nullable().optional(),
  extractor_key: z.string().nullable().optional(),
  season_number: z.number().nullable().optional(),
  episode_number: z.number().nullable().optional(),
  series: z.string().nullable().optional(),
});

export type YtdlpOutput = z.infer<typeof ytdlpOutputSchema>;

export interface GetYtdlpBinaryPathOptions {
  customPath?: string;
  envPath?: string;
  cwd?: string;
  checkExecutable?: (filePath: string) => boolean;
}

function isFileExecutable(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function getYtdlpBinaryPath(customPathOrOptions?: string | GetYtdlpBinaryPathOptions): string {
  const opts: GetYtdlpBinaryPathOptions =
    typeof customPathOrOptions === 'string' ? { customPath: customPathOrOptions } : (customPathOrOptions ?? {});

  const fromArg = opts.customPath?.trim();
  if (fromArg) return fromArg;

  const rawEnv = opts.envPath !== undefined ? opts.envPath : process.env.YTDLP_PATH;
  const fromEnv = rawEnv?.trim();
  if (fromEnv) return fromEnv;

  const checkExec = opts.checkExecutable ?? isFileExecutable;
  const cwd = opts.cwd ?? process.cwd();

  const candidates = ['/opt/yt-dlp/yt-dlp', path.resolve(cwd, '.bin', 'yt-dlp')];
  for (const candidate of candidates) {
    if (checkExec(candidate)) {
      return candidate;
    }
  }

  return 'yt-dlp';
}

/** `proxyUrl` is the egress proxy every request yt-dlp makes is sent through; see `egressProxy.ts`. */
export function buildYtdlpArgs(url: string, proxyUrl?: string | null): string[] {
  const cookiesFile = process.env.YTDLP_COOKIES_FILE?.trim();
  return [
    ...(cookiesFile ? ['--cookies', cookiesFile] : []),
    ...(proxyUrl ? ['--proxy', proxyUrl] : []),
    '--ignore-config',
    '--no-cache-dir',
    '--playlist-end',
    '2001',
    '--socket-timeout',
    '10',
    '--retries',
    '1',
    '--extractor-retries',
    '1',
    '--dump-single-json',
    '--skip-download',
    '--flat-playlist',
    '--no-warnings',
    '--js-runtimes',
    'node',
    '--use-extractors',
    'default,-generic',
    '--',
    url,
  ];
}

function normalizeCoverUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) {
    trimmed = `https:${trimmed}`;
  } else if (trimmed.startsWith('http://') && (trimmed.includes('.hdslb.com/') || trimmed.includes('.biliimg.com/'))) {
    trimmed = `https://${trimmed.slice('http://'.length)}`;
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }
  return trimmed.slice(0, 1000);
}

function selectBestThumbnail(parsed: YtdlpOutput): string | null {
  const direct = normalizeCoverUrl(parsed.thumbnail);
  if (direct) return direct;

  if (Array.isArray(parsed.thumbnails) && parsed.thumbnails.length > 0) {
    for (let i = parsed.thumbnails.length - 1; i >= 0; i--) {
      const candidate = normalizeCoverUrl(parsed.thumbnails[i]?.url);
      if (candidate) return candidate;
    }
  }
  return null;
}

function deriveEntrySourceVideoId(entry: NonNullable<z.infer<typeof ytdlpEntrySchema>>, index: number): string {
  const rawId = entry.id?.trim();
  if (rawId) return rawId.slice(0, 500);

  const rawUrl = entry.url?.trim();
  if (rawUrl) {
    const biliMultiPart = rawUrl.match(/\/video\/(BV[0-9A-Za-z]+).*?[?&]p=(\d+)/i);
    if (biliMultiPart) {
      return `${biliMultiPart[1]}_p${biliMultiPart[2]}`;
    }
    return rawUrl.slice(0, 500);
  }
  return `entry_${index + 1}`;
}

function isTvOrBangumiOutput(parsed: YtdlpOutput, inputUrl: string): boolean {
  const extractor = ((parsed.extractor || '') + ' ' + (parsed.extractor_key || '')).toLowerCase();
  if (extractor.includes('cheese')) return false;
  return (
    extractor.includes('bangumi') ||
    isBangumiUrl(inputUrl) ||
    (parsed.webpage_url ? isBangumiUrl(parsed.webpage_url) : false)
  );
}

function getPlaylistEntries(parsed: YtdlpOutput) {
  const validEntries = Array.isArray(parsed.entries)
    ? parsed.entries.filter((e): e is NonNullable<typeof e> => Boolean(e))
    : [];

  if (validEntries.length > 2000 || (parsed.playlist_count ?? 0) > 2000) {
    throw new LinkImportError('LINK_PLAYLIST_TOO_LARGE', 'Playlist exceeds 2000 entries.');
  }
  if ((parsed._type === 'playlist' || parsed._type === 'multi_video') && !validEntries.length) {
    throw new LinkImportError('LINK_EMPTY_PLAYLIST', 'The playlist is empty or inaccessible.');
  }
  return validEntries;
}

export function mapYtdlpJsonToLinkResult(
  rawJson: unknown,
  inputUrl: string,
  options: { forceImport?: boolean } = {},
): LinkImportResult {
  if (rawJson === null || typeof rawJson !== 'object') {
    throw new YtdlpExecutionError('yt-dlp did not return a valid JSON object', 'YTDLP_FAILED');
  }

  return mapParsedYtdlpResult(ytdlpOutputSchema.parse(rawJson), inputUrl, options);
}

function mapParsedYtdlpResult(
  parsed: YtdlpOutput,
  inputUrl: string,
  options: { forceImport?: boolean },
): LinkImportResult {
  assertSupportedLinkType(inputUrl);
  if (parsed.webpage_url) assertSupportedLinkType(parsed.webpage_url);
  if (parsed.is_live || ['is_live', 'is_upcoming'].includes(parsed.live_status || '')) {
    throw new LinkImportError('LINK_LIVE_UNSUPPORTED', 'LINK_LIVE_UNSUPPORTED');
  }
  const rawTitle =
    (parsed.series?.trim() && isTvOrBangumiOutput(parsed, inputUrl) && !options.forceImport
      ? parsed.series.trim()
      : parsed.title?.trim()) || '';

  if (!rawTitle) throw new LinkImportError('LINK_PARSE_FAILED', 'Video title is missing.');
  const title = rawTitle.slice(0, 200);
  const posterUrl = selectBestThumbnail(parsed);

  const uploader = parsed.uploader?.trim() || null;
  const desc = parsed.description?.trim() || '';
  const cleanDesc = desc === '-' ? '' : desc;
  const overview = cleanDesc.slice(0, 2000);

  const sourceUrl = (parsed.webpage_url?.trim() || inputUrl).slice(0, 2048);

  let year: number | null = null;
  if (parsed.upload_date && /^(\d{4})\d{4}$/.test(parsed.upload_date)) {
    const yr = Number(parsed.upload_date.slice(0, 4));
    if (yr >= 1900 && yr <= 2100) year = yr;
  }

  const runtimeMin =
    typeof parsed.duration === 'number' && Number.isFinite(parsed.duration) && parsed.duration > 0
      ? Math.max(1, Math.round(parsed.duration / 60))
      : null;

  const allEntries = getPlaylistEntries(parsed);
  const validEntries = allEntries.filter(
    (entry) => !entry.is_live && !['is_live', 'is_upcoming'].includes(entry.live_status || ''),
  );
  const skippedCount = allEntries.length - validEntries.length;
  if (allEntries.length && !validEntries.length) {
    throw new LinkImportError('LINK_EMPTY_PLAYLIST', 'LINK_EMPTY_PLAYLIST');
  }
  const episodes: LinkImportEpisodeSeed[] = validEntries.map((entry, idx) => {
    const rawEpTitle = entry.title?.trim() || null;
    const epTitle = rawEpTitle && !isGenericEpisodeLabel(rawEpTitle) ? rawEpTitle.slice(0, 300) : null;
    const epRuntime =
      typeof entry.duration === 'number' && Number.isFinite(entry.duration) && entry.duration > 0
        ? Math.max(1, Math.round(entry.duration / 60))
        : null;
    return {
      name: epTitle,
      sourceVideoId: deriveEntrySourceVideoId(entry, idx),
      runtime: epRuntime,
    };
  });

  const metadata = {
    mediaType: 'other' as const,
    skippedCount,
    ...((parsed.playlist_count != null && parsed.playlist_count > allEntries.length) ||
    validEntries.some(
      (entry) => !entry.title || (!entry.duration && !['is_live', 'is_upcoming'].includes(entry.live_status || '')),
    )
      ? { warning: 'LINK_METADATA_INCOMPLETE' }
      : {}),
  } satisfies Partial<LinkImportResult>;

  if (!options.forceImport && isTvOrBangumiOutput(parsed, inputUrl)) {
    return {
      ...metadata,
      kind: 'tmdb-suggestion',
      title,
      posterUrl,
      overview,
      uploader,
      sourceUrl,
      year,
      runtimeMin,
      episodes,
      fallbackUsed: 'yt-dlp',
    };
  }

  const isPlaylist = episodes.length > 0 || parsed._type === 'playlist' || parsed._type === 'multi_video';

  return {
    ...metadata,
    kind: isPlaylist ? 'playlist' : 'video',
    title,
    posterUrl,
    overview,
    uploader,
    sourceUrl,
    year,
    runtimeMin,
    episodes,
    fallbackUsed: 'yt-dlp',
  };
}

export interface RunYtdlpOptions {
  binaryPath?: string;
  lookupFn?: DnsLookupFn;
  execFn?: YtdlpExecFn;
  timeoutMs?: number;
  forceImport?: boolean;
  /** Overrides the shared egress proxy; null runs yt-dlp without one. */
  egressProxyUrl?: string | null;
}

export async function resolveWithYtdlp(rawUrl: string, options: RunYtdlpOptions = {}): Promise<LinkImportResult> {
  assertSupportedLinkType(rawUrl);
  const safeUrl = await assertSafePublicUrl(rawUrl, options.lookupFn);
  const binaryPath = getYtdlpBinaryPath(options.binaryPath);
  const execFn = options.execFn ?? defaultYtdlpExec;
  const timeout = options.timeoutMs ?? YTDLP_TIMEOUT_MS;
  // The link was checked above, but yt-dlp follows redirects and fetches further pages by itself.
  const proxyUrl = options.egressProxyUrl !== undefined ? options.egressProxyUrl : await sharedEgressProxyUrl();

  const { stdout } = await execFn(binaryPath, buildYtdlpArgs(safeUrl.toString(), proxyUrl), {
    timeout,
    maxBuffer: YTDLP_MAX_BUFFER_BYTES,
    ...(proxyUrl ? { env: egressProxyEnv(proxyUrl) } : {}),
  });

  const trimmed = stdout.trim();
  if (!trimmed || trimmed === 'null') {
    throw new YtdlpExecutionError('yt-dlp returned empty output', 'YTDLP_FAILED');
  }

  const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim().startsWith('{')) ?? trimmed;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(firstLine);
  } catch {
    throw new YtdlpExecutionError('yt-dlp output is not valid JSON', 'YTDLP_FAILED');
  }

  const parsed = ytdlpOutputSchema.parse(parsedJson);
  // Bilibili's list endpoints answer for whatever uploader the link names, and yt-dlp reads the same ones.
  // Its list is accepted on the condition the native reader applies: the owner reported is the one in the link.
  const listOwner = /^\/(\d+)\/(?:lists\/\d+|channel\/(?:collectiondetail|seriesdetail))\/?$/.exec(
    safeUrl.pathname,
  )?.[1];
  if (safeUrl.hostname === 'space.bilibili.com' && listOwner && parsed.uploader_id !== listOwner) {
    throw new LinkImportError('LINK_UNAVAILABLE', 'The playlist does not belong to this uploader.', { final: true });
  }
  // Reject empty/oversized playlists before spending requests on optional enrichment.
  getPlaylistEntries(parsed);
  const result = mapParsedYtdlpResult(parsed, safeUrl.toString(), { forceImport: options.forceImport });
  if (
    result.kind === 'playlist' &&
    /(?:^|\.)youtube\.com$/.test(safeUrl.hostname) &&
    !(parsed.playlist_count && parsed.playlist_count > result.episodes.length + (result.skippedCount || 0)) &&
    result.episodes.some((ep) => !ep.name || ep.runtime == null)
  )
    result.warning = 'LINK_METADATA_PENDING';
  return result;
}

export async function getYtdlpVersion(
  options: {
    binaryPath?: string;
    execFn?: YtdlpExecFn;
  } = {},
): Promise<string | null> {
  const binaryPath = getYtdlpBinaryPath(options.binaryPath);
  const execFn = options.execFn ?? defaultYtdlpExec;
  try {
    const { stdout } = await execFn(binaryPath, ['--version'], {
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
    const ver = stdout.trim().split(/\r?\n/)[0]?.trim();
    return ver || null;
  } catch {
    return null;
  }
}

export async function updateYtdlpBinary(
  options: {
    binaryPath?: string;
    execFn?: YtdlpExecFn;
  } = {},
): Promise<{ ok: boolean; output: string }> {
  const binaryPath = getYtdlpBinaryPath(options.binaryPath);
  const execFn = options.execFn ?? defaultYtdlpExec;
  try {
    const { stdout, stderr } = await execFn(binaryPath, ['-U'], {
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    });
    const out = `${stdout}\n${stderr}`.trim();
    console.log(`[yt-dlp] Self-update check: ${out.split(/\r?\n/)[0] || 'ok'}`);
    return { ok: true, output: out };
  } catch (err) {
    if (err instanceof YtdlpNotInstalledError) {
      return { ok: false, output: err.message };
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[yt-dlp] Self-update skipped or failed: ${msg}`);
    return { ok: false, output: msg };
  }
}
