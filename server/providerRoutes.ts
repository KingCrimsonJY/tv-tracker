import type { Express } from 'express';
import { resolveLinkMetadata } from './providers/linkImport.ts';
import {
  fetchCombinedRatings,
  fetchTmdbTitleDetails,
  isTmdbConfigured,
  searchTmdb,
} from './providers/tmdb.ts';

export function registerProviderRoutes(app: Express): void {
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
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ error: '请输入有效的 http:// 或 https:// 链接' });
      return;
    }
    try {
      const data = await resolveLinkMetadata(rawUrl);
      res.json(data);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : '链接解析失败，请检查链接或手动添加',
      });
    }
  });
}
