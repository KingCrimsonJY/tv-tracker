# 帧迹 (Zhenji) 数据存储与导出格式说明

本文档定义自托管电影与剧集进度追踪器 **帧迹 (Zhenji)** 的本地数据目录结构与可移植 JSON 导出/导入格式（Version 2，同时向后兼容 Version 1）。

---

## 1. 本地数据目录结构 (`DATA_DIR`)

默认数据目录为 `./data`（可通过环境变量 `DATA_DIR` 配置）。所有状态均保存在单一目录中，迁移服务器时只需复制 `DATA_DIR` 目录与 `.env` 文件即可：

```text
DATA_DIR/
  tracker.db                          # 主 SQLite 数据库（WAL 模式，开启外键级联删除）
  backups/tracker-YYYY-MM-DD.db       # 每日自动生成的 VACUUM INTO 完整数据库快照（保留最近 14 份）
  exports/zhenji-YYYY-MM-DD.json      # 每日自动生成的 JSON 导出文件（保留最近 14 份）
```

---

## 2. 导出 JSON 格式 (Version 2)

`GET /api/export` 接口与每日自动导出文件 `exports/zhenji-YYYY-MM-DD.json` 均使用统一的 Version 2 格式。
为保证安全性，导出文件**永不包含**密码哈希（`settings['auth']`）或登录会话令牌（`sessions`）。

### 顶层结构

```json
{
  "format": "zhenji-export",
  "version": 2,
  "exportedAt": "2026-11-02T12:00:00.000Z",
  "settings": {
    "defaultTitleLang": "zh",
    "includeSpecials": false,
    "homeSections": [
      { "id": "continue_watching", "enabled": true, "rank": "a0" },
      { "id": "new_episodes", "enabled": true, "rank": "a1" },
      { "id": "pinned_lists", "enabled": true, "rank": "a2" },
      { "id": "recently_added", "enabled": false, "rank": "a3" },
      { "id": "watchlist", "enabled": false, "rank": "a4" }
    ],
    "theme": "dark"
  },
  "titles": {
    "tmdb_tv_1": {
      "id": "tmdb_tv_1",
      "source": "tmdb",
      "sourceId": "95396",
      "mediaType": "tv",
      "names": {
        "original": "Severance",
        "zh": "人生切割术",
        "en": "Severance"
      },
      "displayLang": null,
      "year": 2022,
      "runtimeMin": 50,
      "genres": ["剧情", "悬疑"],
      "posterPath": "https://image.tmdb.org/t/p/w500/...",
      "backdropPath": "https://image.tmdb.org/t/p/w1280/...",
      "overview": { "zh": "..." },
      "showStatus": "Returning Series",
      "externalIds": { "imdb": "tt11280740" },
      "ratings": { "tmdb": "8.4", "tmdbVotes": 1520, "imdb": "8.7", "fetchedAt": 1700000000000 },
      "manualState": null,
      "playthroughs": [
        { "id": "p1", "number": 1, "startedAt": 1700000000000 }
      ],
      "activePlaythroughId": "p1",
      "resume": null,
      "metaFetchedAt": 1700000000000,
      "addedAt": 1700000000000,
      "updatedAt": 1700000000000,
      "lastActivityAt": 1700000000000
    }
  },
  "seasonsByTitle": {
    "tmdb_tv_1": [
      {
        "seasonNumber": 1,
        "name": "第 1 季",
        "episodes": [
          {
            "number": 1,
            "key": "s1e1",
            "name": "关于地狱的好消息",
            "airDate": "2022-02-18",
            "runtime": 57,
            "stillPath": "https://image.tmdb.org/t/p/w300/...",
            "overview": { "zh": "..." }
          }
        ]
      }
    ]
  },
  "progressByTitle": {
    "tmdb_tv_1": {
      "p1": {
        "playthroughId": "p1",
        "watched": {
          "s1e1": 1700000100000
        }
      }
    }
  },
  "lists": {
    "list_1": {
      "id": "list_1",
      "name": "必看科幻剧集",
      "kind": "ordered",
      "description": "按推荐顺序排列",
      "pinned": true,
      "rank": "a0",
      "collectionSort": "manual",
      "createdAt": 1700000000000
    }
  },
  "entriesByList": {
    "list_1": [
      {
        "id": "entry_1",
        "titleId": "tmdb_tv_1",
        "rank": "a0",
        "addedAt": 1700000000000
      }
    ]
  }
}
```

---

## 3. 导入兼容与安全策略 (`POST /api/import`)

- **支持版本**：
  - **Version 2**：包含 `"format": "zhenji-export"` 与 `"version": 2`。
  - **Version 1（旧版兼容）**：不包含 `format` 字段，结构为 `{ version: 1, exportedAt, settings, titles, seasonsByTitle, progressByTitle, lists, entriesByList }`。
  - **旧版字段清理**：旧版备份文件中若包含已废弃的 `ratings.douban` 或 `externalIds.douban` 字段，导入时会自动忽略并剥离，不影响其余数据。
- **全量校验**：导入前通过 `src/domain/schemas.ts` 中的 Zod Schema 对全部字段进行严格校验，任何结构错误均会拒绝导入且不修改数据库。
- **自动备份**：校验通过后、写入前，自动调用 `VACUUM INTO` 生成一份当前数据库的备份文件。
- **单事务替换**：在单个 SQLite 事务中清空并写入 `titles`、`seasons`、`progress`、`lists`、`list_entries` 与 `settings['app']`，同时递增全局 `version` 并通过 SSE 推送给所有在线设备。
- **幂等性保证**：导出后再导入所得到的数据库状态与导出前完全一致。
