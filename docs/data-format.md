# 数据格式说明

本文描述帧迹的数据目录，以及可移植的 JSON 导出格式（第 2 版）。文中的示例基于 `npm run seed:demo` 生成的演示库的真实导出：内容有删减，并补上了演示数据里没有、但从 TMDB 实际添加作品时会出现的字段（`genreIds`、`tmdbEpisodeId`、`structureLocked` 等）。字段的权威定义是 [`src/domain/types.ts`](../src/domain/types.ts)，导入时的校验规则是 [`src/domain/schemas.ts`](../src/domain/schemas.ts)。

## 1. 数据目录

默认是 `./data`，可用环境变量 `DATA_DIR` 修改（容器内固定为 `/data`）。应用不在这个目录之外写入任何文件。

```text
DATA_DIR/
  tracker.db                                    # 主数据库：SQLite，WAL 模式，外键级联删除
  backups/tracker-YYYY-MM-DD.db                 # 每日完整快照（VACUUM INTO），保留最近 14 份
  backups/tracker-YYYY-MM-DD-HHmmss-pre-*.db    # 结构迁移或导入之前的安全快照，保留最近 10 份
  exports/zhenji-YYYY-MM-DD.json                # 每日 JSON 全量导出，保留最近 14 份
```

数据库的结构版本记录在 `PRAGMA user_version` 中，迁移步骤定义在 [`server/db/migrations.ts`](../server/db/migrations.ts)，启动时自动执行。

## 2. 导出文件（第 2 版）

「设置 → 数据备份与迁移 → 导出数据 (JSON)」、`GET /api/export` 和每日自动导出产生的是同一种文件。它包含恢复整个片库所需的一切，**不包含**访问密码和登录会话。

### 2.1 顶层结构

```json
{
  "format": "zhenji-export",
  "version": 2,
  "exportedAt": "2026-11-12T08:00:00.000Z",
  "settings": {},
  "titles": {},
  "seasonsByTitle": {},
  "progressByTitle": {},
  "lists": {},
  "entriesByList": {}
}
```

| 字段                | 内容                            |
| :------------------ | :------------------------------ |
| `format`、`version` | 固定为 `"zhenji-export"` 和 `2` |
| `exportedAt`        | 导出时间，ISO 8601（UTC）       |
| `settings`          | 应用设置                        |
| `titles`            | 作品，按作品 id 索引            |
| `seasonsByTitle`    | 每部作品的季与分集，按季号升序  |
| `progressByTitle`   | 每部作品每一轮观看的勾选记录    |
| `lists`             | 列表，按列表 id 索引            |
| `entriesByList`     | 每个列表的条目，按排序键升序    |

所有时间戳都是 Unix 毫秒数；日期是 `YYYY-MM-DD` 字符串。

### 2.2 settings

```json
{
  "uiLang": "system",
  "defaultTitleLang": "auto",
  "includeSpecials": false,
  "homeSections": [
    { "id": "continue_watching", "enabled": true },
    { "id": "new_episodes", "enabled": true },
    { "id": "pinned_lists", "enabled": true },
    { "id": "recently_added", "enabled": false },
    { "id": "watchlist", "enabled": false }
  ],
  "theme": "dark"
}
```

`uiLang`：`system` / `zh-CN` / `en`。`defaultTitleLang`：`auto` / `zh` / `original` / `en`。`theme`：`system` / `dark` / `light`。`homeSections` 的数组顺序就是首页的显示顺序。

### 2.3 titles

来自 TMDB 的剧集：

```json
{
  "tmdb_tv_95396": {
    "id": "tmdb_tv_95396",
    "source": "tmdb",
    "sourceId": "95396",
    "mediaType": "tv",
    "names": { "original": "Severance", "zh": "人生切割术", "en": "Severance" },
    "displayLang": null,
    "year": 2022,
    "releaseDate": "2022-02-18",
    "runtimeMin": 50,
    "genres": ["剧情", "悬疑", "科幻"],
    "genreIds": [18, 9648, 10765],
    "posterPath": "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
    "posters": { "zh": "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg", "en": "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg" },
    "backdropPath": "/ixgFmf1X59PUZam2qbAfskx2gQr.jpg",
    "overview": { "zh": "马克领导着卢蒙工业的一支办公室团队……", "en": "Mark leads a team of office workers…" },
    "showStatus": "Returning Series",
    "externalIds": { "imdb": "tt11280740" },
    "ratings": {
      "tmdb": "8.4",
      "imdb": "8.7",
      "rottenTomatoes": "97%",
      "metacritic": "84",
      "fetchedAt": 1794495470687
    },
    "manualState": null,
    "playthroughs": [{ "id": "p1", "number": 1, "startedAt": 1791903470687 }],
    "activePlaythroughId": "p1",
    "resume": null,
    "structureLocked": false,
    "sourceUnavailable": false,
    "metaFetchedAt": 1794495470687,
    "addedAt": 1792335470687,
    "updatedAt": 1794495470687,
    "lastActivityAt": 1794322670687
  }
}
```

通过链接导入的播放列表（与上面不同的字段）：

```json
{
  "url_yt_3b1b_linear_algebra": {
    "source": "url",
    "sourceId": "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab",
    "mediaType": "other",
    "uploader": "3Blue1Brown",
    "names": {
      "original": "Essence of linear algebra",
      "zh": "Essence of linear algebra",
      "en": "Essence of linear algebra"
    },
    "posterPath": "https://i.ytimg.com/vi/fNk_zzaMoSs/maxresdefault.jpg",
    "showStatus": "Ended",
    "resume": { "episodeKey": "s1e7", "seconds": 340, "updatedAt": 1794466670687 }
  }
}
```

| 字段                                    | 说明                                                                                                                                                   |
| :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                    | 作品 id，与所在的键相同。TMDB 作品为 `tmdb_<movie或tv>_<TMDB id>`，链接导入为 `url_…`，手动添加为 `custom_…`                                           |
| `source`、`sourceId`                    | `tmdb`（`sourceId` 是 TMDB id）、`url`（`sourceId` 是规范化后的来源链接）、`custom`（`sourceId` 为 `null`）                                            |
| `mediaType`                             | `movie` / `tv` / `other`（课程、视频合集等）                                                                                                           |
| `names`                                 | `original` 必有；`zh`、`en`、`custom`（用户自定义名）可选                                                                                              |
| `displayLang`                           | 这部作品单独指定的标题语言：`zh` / `original` / `en` / `custom`，`null` 表示跟随全局设置                                                               |
| `posterPath`、`backdropPath`、`posters` | **TMDB 图片保存为路径**（以 `/` 开头，显示时按所需尺寸拼出地址）；其他来源保存完整的 `https://` 地址。`posters` 按语言给出海报：`zh`、`en`、`textless` |
| `releaseDate`                           | 首映或首播日期，未知为 `null`                                                                                                                          |
| `showStatus`                            | TMDB 的状态原文，如 `Returning Series`、`Ended`、`Released`；可为 `null`                                                                               |
| `ratings`                               | 字符串形式的评分；`fetchedAt` 是 OMDb 评分的抓取时间                                                                                                   |
| `manualState`                           | `paused` / `dropped` / `null`。其余状态（未看、观看中、已追平、已看完……）都由分集日期与勾选记录实时推导，不保存                                        |
| `playthroughs`、`activePlaythroughId`   | 每一轮观看（一刷、二刷……）及当前这一轮。`completedAt` 在该轮看完时出现                                                                                 |
| `resume`                                | 断点：`episodeKey`（电影为 `null`）、`seconds`、`updatedAt`；没有断点为 `null`                                                                         |
| `structureLocked`                       | 为 `true` 时，刷新元数据不会删除、重排或跨季移动分集                                                                                                   |
| `sourceUnavailable`                     | 上游已删除该作品；本地数据全部保留，自动刷新停止                                                                                                       |
| `upstreamChange`                        | 仅当上游的季/集结构与本地不同、等待用户确认时出现：`{ "signature", "fetchedAt", "seasons": [上游的完整季结构] }`                                       |
| `ignoredStructure`                      | 用户选择「保留本地结构」时记下的上游结构签名，同一结构不再提示                                                                                         |
| `episodeDetailsVersion`                 | 服务端内部使用的分集详情修订号，导入时会重新生成                                                                                                       |

### 2.4 seasonsByTitle

```json
{
  "tmdb_tv_95396": [
    {
      "seasonNumber": 2,
      "name": null,
      "episodes": [
        {
          "number": 1,
          "key": "s2e1",
          "tmdbEpisodeId": 2548411,
          "name": { "zh": "你好，科贝尔女士", "en": "Hello, Ms. Cobel" },
          "airDate": "2025-01-17",
          "runtime": 52,
          "stillPath": "/a97vNY8Knu45FLQib0uQZ2VReLy.jpg",
          "overview": { "zh": "……" }
        }
      ]
    }
  ],
  "url_yt_3b1b_linear_algebra": [
    {
      "seasonNumber": 1,
      "name": null,
      "episodes": [
        {
          "number": 1,
          "key": "s1e1",
          "sourceVideoId": "fNk_zzaMoSs",
          "name": {
            "zh": "Vectors | Chapter 1, Essence of linear algebra",
            "en": "Vectors | Chapter 1, Essence of linear algebra"
          },
          "airDate": "2016-08-04",
          "runtime": 10,
          "stillPath": "https://i.ytimg.com/vi/fNk_zzaMoSs/maxresdefault.jpg",
          "overview": {}
        }
      ]
    }
  ]
}
```

- `seasonNumber` 为 `0` 的季是特别篇。电影没有季。
- 季名和集名是**按语言的对象** `{ "zh"?, "en"? }`，或 `null`。「第 1 季」「Episode 3」这类没有信息量的默认名称一律保存为 `null`，由界面按当前语言生成。
- `key` 是分集在这部作品内的标识（`s<季>e<集>`），观看记录引用它。
- `tmdbEpisodeId`（TMDB 作品）与 `sourceVideoId`（链接导入）是上游的稳定标识，刷新时用来对齐分集。
- `airDate` 未知时为 `null`，不会填入占位日期。

### 2.5 progressByTitle

```json
{
  "tmdb_tv_95396": {
    "p1": {
      "playthroughId": "p1",
      "watched": { "s1e1": 1793285870687, "s1e2": 1793289470687 }
    }
  },
  "tmdb_movie_129": {
    "p1": { "playthroughId": "p1", "watched": {}, "movieWatchedAt": 1793000000000 }
  }
}
```

第一层按作品 id，第二层按观看轮次 id。`watched` 是「分集 `key` → 勾选时间」；电影用 `movieWatchedAt`。`archivedWatched`（可选）保存已不在当前结构中的分集的观看记录——采用上游的新结构后，对不上的勾选不会丢失，而是连同当时的分集信息存放在这里，该分集重新出现时自动恢复：

```json
{
  "archivedWatched": [
    {
      "episode": {
        "number": 9,
        "key": "s1e9",
        "name": null,
        "airDate": "2022-04-08",
        "runtime": 40,
        "stillPath": null,
        "overview": {}
      },
      "watchedAt": 1793314670687
    }
  ]
}
```

### 2.6 lists 与 entriesByList

```json
{
  "lists": {
    "list_marvel_order": {
      "id": "list_marvel_order",
      "name": "漫威无限传奇观影顺序",
      "description": "漫威无限传奇阶段核心作品故事时间线观影顺序，自动高亮下一部待看",
      "kind": "ordered",
      "pinned": true,
      "rank": "a0",
      "collectionSort": "added",
      "createdAt": 1792335470687
    }
  },
  "entriesByList": {
    "list_marvel_order": [{ "id": "entry_mcu_1", "titleId": "tmdb_movie_1771", "rank": "a0", "addedAt": 1792335470687 }]
  }
}
```

`kind`：`ordered`（顺序片单）或 `collection`（收藏合集）。`collectionSort`：`added` / `name` / `year` / `rating` / `manual`。`rank` 是分数索引排序键（[fractional-indexing](https://github.com/rocicorp/fractional-indexing)），按字符串比较即为显示顺序；拖动一项只改写这一项的 `rank`。条目的 `note` 可选。

## 3. 导入

「设置 → 数据备份与迁移 → 导入数据 (JSON)」或 `POST /api/import`。

- **替换，而不是合并**：导入后，片库与文件内容完全一致，文件里没有的作品和列表会被删除。所有已打开的设备随即切换到导入后的数据。
- **只接受备份文件**：必须是第 2 版信封，或带有 `titles` 的第 1 版对象。空对象 `{}` 之类不是备份的内容会被拒绝，而不会被当成“空片库”清空数据。
- **先校验，再备份，后写入**：整个文件先按 `src/domain/schemas.ts` 校验，任何一处不合法都会拒绝导入且不改动数据库；通过后先生成一份 `pre-import` 快照，再在单个事务里完成替换。
- **不改动的内容**：访问密码与登录会话不在文件里，导入不会影响它们。
- **往返一致**：导出后原样导入，得到的片库与导出前相同。
- 引用了不存在的作品的进度、季和列表条目会被丢弃，而不是导致导入失败。

### 兼容的旧格式

| 来源                             | 识别方式                                                                     | 导入时的处理                                                                                             |
| :------------------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| 第 1 版导出                      | 没有 `format` 字段，`version` 为 `1` 或缺失；必须有 `titles`，其余部分可缺省 | 按第 2 版结构读取；从链接导入作品的简介里拆出「UP 主」前缀到 `uploader`；按 `genres` 名称补全 `genreIds` |
| 字符串形式的季名、集名           | `name` 是字符串而不是对象                                                    | 转为 `{ "zh": … }`，默认名称转为 `null`                                                                  |
| 完整地址形式的 TMDB 图片         | `https://image.tmdb.org/t/p/<尺寸>/<文件>`                                   | 归一为路径 `/<文件>`                                                                                     |
| 链接导入与手动添加作品的占位日期 | 分集 `airDate` 为 `2020-01-01`                                               | 清除为 `null`（TMDB 作品的真实日期不受影响）                                                             |
| 豆瓣字段                         | `ratings.douban`、`externalIds.douban`                                       | 忽略                                                                                                     |

第 2 版文件同样接受上表中后四种旧写法，因此早期版本生成的第 2 版备份可以直接导入。
