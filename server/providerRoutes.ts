import type { Express } from 'express';
import { linkImportRequestSchema } from '../src/domain/schemas.ts';
import type { StateMutationResult } from '../src/domain/types.ts';
import { NotFoundError, type TrackerRepository } from './db/repository.ts';
import { type LinkImportDependencies, resolveLinkMetadata } from './providers/linkImport.ts';
import {
  fetchCombinedRatings,
  fetchTmdbTitleDetails,
  isTmdbConfigured,
  searchTmdb,
} from './providers/tmdb.ts';
import { getYtdlpVersion, resolveWithYtdlp } from './providers/ytdlp.ts';

export interface ProviderRoutesOptions {
  repo: TrackerRepository;
  broadcastMutation: (mutation: StateMutationResult) => StateMutationResult;
  nowFn?: () => number;
  linkDeps?: LinkImportDependencies;
}

export function registerProviderRoutes(app: Express, options: ProviderRoutesOptions): void {
  const { repo, broadcastMutation, nowFn = () => Date.now(), linkDeps = {} } = options;

  app.get('/api/system/info', async (_req, res) => {
    const ytdlpVersion = await getYtdlpVersion({
      binaryPath: linkDeps.ytdlpPath,
      execFn: linkDeps.execFn,
    });
    res.json({
      appVersion: '1.0.0',
      ytdlpVersion,
    });
  });

  app.get('/api/tmdb/status', (_req, res) => {
    res.json({ configured: isTmdbConfigured() });
  });

  app.get('/api/tmdb/search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!isTmdbConfigured()) {
      res.status(503).json({
        error: '服务端未配置有效的 TMDB_READ_TOKEN 密钥，请在环境变量中配置后重试。',
      });
      return;
    }
    if (!query) {
      res.json({ results: [] });
      return;
    }
    try {
      const results = await searchTmdb(query);
      res.json({ results });
    } catch (error) {
      res.status(502).json({
        error:
          error instanceof Error
            ? `TMDB 搜索请求失败: ${error.message}`
            : 'TMDB 搜索请求失败，请检查密钥或网络连接。',
      });
    }
  });

  app.get('/api/tmdb/:mediaType/:id', async (req, res) => {
    const mediaType = String(req.params.mediaType || '');
    const sourceId = String(req.params.id || '');

    if (mediaType !== 'movie' && mediaType !== 'tv') {
      res.status(400).json({ error: '无效的媒体类型：仅支持 movie 或 tv' });
      return;
    }
    if (!/^\d+$/.test(sourceId)) {
      res.status(400).json({ error: '无效的 TMDB ID：必须为纯数字' });
      return;
    }
    if (!isTmdbConfigured()) {
      res.status(503).json({
        error: '服务端未配置有效的 TMDB_READ_TOKEN 密钥，无法获取 TMDB 详情。',
      });
      return;
    }

    try {
      const details = await fetchTmdbTitleDetails(mediaType, sourceId);
      res.json(details);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : '获取 TMDB 详情失败',
      });
    }
  });

  app.get('/api/ratings', async (req, res) => {
    const imdbId = String(req.query.imdbId || '').trim();
    const title = String(req.query.title || '').trim();
    const yearStr = String(req.query.year || '').trim();
    const year = yearStr ? Number.parseInt(yearStr, 10) || null : null;
    const doubanId = String(req.query.doubanId || '').trim();

    const result = await fetchCombinedRatings({ imdbId, title, year, doubanId });
    res.json(result);
  });

  app.post('/api/import/link', async (req, res) => {
    const parsed = linkImportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '请输入有效的 http:// 或 https:// 链接' });
      return;
    }
    try {
      const data = await resolveLinkMetadata(parsed.data.url, {
        ...linkDeps,
        forceImport: parsed.data.force,
      });
      res.json(data);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : '链接解析失败，请检查链接或手动添加',
      });
    }
  });

  app.post('/api/titles/:id/refresh-link', async (req, res, next) => {
    try {
      const id = String(req.params.id || '');
      const title = repo.getTitle(id);
      if (!title) {
        throw new NotFoundError(`未找到作品: ${id}`);
      }
      if (title.source !== 'url' || !title.sourceId) {
        res.status(400).json({ error: '仅通过链接导入的作品支持刷新剧集列表' });
        return;
      }

      const resolved = await resolveWithYtdlp(title.sourceId, {
        binaryPath: linkDeps.ytdlpPath,
        lookupFn: linkDeps.lookupFn,
        execFn: linkDeps.execFn,
        forceImport: true,
      });

      const refreshResult = repo.appendPlaylistEpisodes(id, resolved.episodes, nowFn());
      const broadcasted = broadcastMutation({
        version: refreshResult.version,
        upserts: refreshResult.upserts,
        deletes: refreshResult.deletes,
      });
      res.json({
        ...broadcasted,
        addedCount: refreshResult.addedCount,
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        next(err);
        return;
      }
      res.status(400).json({
        error: err instanceof Error ? err.message : '刷新列表失败，请确认 yt-dlp 已安装且链接有效',
      });
    }
  });
}
