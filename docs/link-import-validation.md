# 链接导入验证 / Link import validation

验证日期：2026-11-07。运行环境：隔离 Podman 容器、Node 24.22.2、yt-dlp 2026.10.26、HeroUI 3.2.7。未使用 YouTube API Key 或平台登录 Cookie。

This report records representative public-link tests, not a guarantee that every video or account is accessible. Importing metadata does not download media or grant playback access. Platform responses can change with location, availability, authentication and rate limits.

## 结果与范围

- 66 个真实链接样例：B站 41 个、YouTube 25 个。下表保留成功、部分成功、明确失败和批量限流后的复测区别。
- B站公开元数据直接读取：23P 视频、64 条合集、564 条系列、87 条公开收藏夹均取得分集名称与时长；指定 `p` 只导入该 P。
- 番剧、国创、电影、纪录片可提供 TMDB 搜索建议，也可以按链接保存。`ss` 为整季，`ep` 为单集；整季当前读取平台主分集列表，不保证包含预告、花絮等额外分区。
- 课堂预览与付费课程不会被误判为 TMDB 剧集。能读取公开目录不代表能观看付费内容；当前课程样例返回 16 条目录。
- YouTube 普通视频、Shorts、电影、直播/回放、播放列表和频道页均有成功记录。连续批量运行曾触发反机器人限制，冷却后代表性单链接恢复。Shorts 频道首次补全 84/84 条时长，批量复测只取得 84 条标题并明确标记信息不完整；没有把这个结果当作完整成功。
- 第二轮矩阵中返回成功的 41 项，通过实际前端数据 action 保存到 API/SQLite，校验年份、时长、直播状态和集数。9 个已导入系列执行刷新，均未重复追加且保留观看进度。之后新增的收藏夹补测未计入这 41 项保存断言。

## 真实链接矩阵

“成功”表示取得可用元数据；“提示”表示伴随限制或部分信息，不代表播放权限。部分 YouTube 行列出批量回归结果和冷却后的定点复测，避免用某一次成功掩盖间歇性失败。数量为测试时快照。

| 编号 | 类型 / 输入 | 结果 |
| --- | --- | --- |
| B01 | [single-bv](https://www.bilibili.com/video/BV13x41117TL) | 成功：video |
| B02 | [single-av](https://www.bilibili.com/video/av8903802/) | 成功：video |
| B03 | [multipart](https://www.bilibili.com/video/BV1bK411W797) | 成功：playlist；23 条 |
| B04 | [part2](https://www.bilibili.com/video/BV1bK411W797?p=2) | 成功：video |
| B05 | [collection](https://space.bilibili.com/2142762/lists/3662502?type=season) | 成功：playlist；64 条 |
| B06 | [series](https://space.bilibili.com/1958703906/lists/547718?type=series) | 成功：playlist；564 条 |
| B07 | [favorite](https://space.bilibili.com/84912/favlist?fid=1103407912&ftype=create) | 明确失败：`LINK_EMPTY_PLAYLIST` |
| B08 | [mobile-single](https://m.bilibili.com/video/BV13x41117TL) | 成功：video |
| B09 | [alias-short](https://b23.tv/BV16aDpB4E29) | 成功：video |
| B10 | [share-single](https://www.bilibili.com/video/BV13x41117TL) | 成功：video |
| B11 | [bangumi-ss](https://www.bilibili.com/bangumi/play/ss26801) | 成功：tmdb-suggestion；26 条；提示 `LINK_PLAYBACK_RESTRICTED` |
| B12 | [bangumi-ep](https://www.bilibili.com/bangumi/play/ep267851) | 成功：tmdb-suggestion；提示 `LINK_PLAYBACK_RESTRICTED` |
| B13 | [movie-ep](https://www.bilibili.com/bangumi/play/ep319063) | 成功：tmdb-suggestion；提示 `LINK_PLAYBACK_RESTRICTED` |
| B14 | [movie-ss](https://www.bilibili.com/bangumi/play/ss28198) | 成功：tmdb-suggestion；1 条；提示 `LINK_PLAYBACK_RESTRICTED` |
| B15 | [guochuang-ss](https://www.bilibili.com/bangumi/play/ss1733) | 成功：tmdb-suggestion；46 条 |
| B16 | [guochuang-ep](https://www.bilibili.com/bangumi/play/ep32373) | 成功：tmdb-suggestion |
| B17 | [media](https://www.bilibili.com/bangumi/media/md1733) | 成功：tmdb-suggestion；46 条 |
| B18 | [documentary](https://www.bilibili.com/bangumi/play/ep678060) | 成功：tmdb-suggestion |
| B19 | [offline](https://live.bilibili.com/196) | 成功：video；offline；提示 `LINK_NOT_LIVE` |
| B20 | [offline-blanc](https://live.bilibili.com/blanc/196) | 成功：video；offline；提示 `LINK_NOT_LIVE` |
| B21 | [festival](https://www.bilibili.com/festival/2023honkaiimpact3gala?bvid=BV1ay4y1d77f) | 成功：video |
| B22 | [watchlater](https://www.bilibili.com/medialist/play/watchlater) | 明确失败：`LINK_LOGIN_REQUIRED` |
| B23 | [course-preview](https://www.bilibili.com/cheese/play/ep229832) | 成功：video |
| B24 | [old-collection](https://space.bilibili.com/2142762/channel/collectiondetail?sid=3662502) | 成功：playlist；64 条 |
| B25 | [live](https://live.bilibili.com/1894863826) | 成功：video；live |
| B26 | [expired-short](https://b23.tv/uzU7XA) | 明确失败：`LINK_UNAVAILABLE` |
| B27 | [expired-short2](https://b23.tv/s9wvl0O) | 明确失败：`LINK_UNAVAILABLE` |
| B28 | [short-multipart](https://b23.tv/BV1bK411W797) | 成功：playlist；23 条 |
| B29 | [mobile-multipart](https://m.bilibili.com/video/BV1bK411W797) | 成功：playlist；23 条 |
| B30 | [mobile-part2](https://m.bilibili.com/video/BV1bK411W797?p=2) | 成功：video |
| B31 | [paid-course](https://www.bilibili.com/cheese/play/ss5918) | 成功：playlist；16 条；提示 `LINK_PLAYBACK_RESTRICTED` |
| B32 | bare-bv（仅 ID，无 URL） | 明确失败：`UNSAFE_URL` |
| B33 | [uploaded-movie](https://www.bilibili.com/video/BV1du4y1C7SG/) | 成功：playlist；2 条 |
| B34 | [live-blanc](https://live.bilibili.com/blanc/1894863826) | 成功：video；live |
| B35 | [share-multipart](https://b23.tv/BV1bK411W797。) | 成功：playlist；23 条 |
| B36 | [movie-ss2](https://www.bilibili.com/bangumi/play/ss33220) | 成功：tmdb-suggestion；1 条；提示 `LINK_PLAYBACK_RESTRICTED` |
| B37 | [random-short](https://b23.tv/iNubuXQ) | 成功：video |
| B38 | [removed-target-short](https://b23.tv/4bdIZBf) | 明确失败：`LINK_UNAVAILABLE` |
| B39 | [random-short-direct](https://www.bilibili.com/video/BV1hoVh6kErs/?p=1) | 成功：video |
| B40 | [random-short-share](https://b23.tv/iNubuXQ。) | 成功：video |
| Y01 | [single](https://www.youtube.com/watch?v=fNk_zzaMoSs) | 成功：video（冷却后复测） |
| Y02 | [short-url](https://youtu.be/fNk_zzaMoSs?t=30) | 成功：video |
| Y03 | [shorts](https://www.youtube.com/shorts/TaopSi3Ucfc) | 成功：video（冷却后复测） |
| Y04 | [shorts-watch](https://www.youtube.com/watch?v=TaopSi3Ucfc) | 首轮成功；批量复测触发反机器人限制，未再次单独复测 |
| Y05 | [playlist](https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab) | 成功：playlist；16 条 |
| Y06 | [watch-list](https://www.youtube.com/watch?v=fNk_zzaMoSs&list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab&index=2) | 成功：playlist；16 条 |
| Y07 | [embed](https://www.youtube.com/embed/fNk_zzaMoSs) | 成功：video（冷却后复测） |
| Y08 | [mobile](https://m.youtube.com/watch?v=fNk_zzaMoSs) | 成功：video（冷却后复测） |
| Y09 | [unavailable-live](https://www.youtube.com/live/jfKfPfyJRdk) | 明确失败：`LINK_UNAVAILABLE` |
| Y10 | [replay](https://www.youtube.com/live/qVv6vCqciTM) | 成功：video；ended（冷却后复测） |
| Y11 | [channel-videos](https://www.youtube.com/@3blue1brown/videos) | 成功：playlist；153 条 |
| Y12 | [music](https://music.youtube.com/watch?v=fNk_zzaMoSs) | 成功：video（冷却后复测） |
| Y13 | [movie](https://www.youtube.com/watch?v=bjQ4MSwgV98) | 成功：video（冷却后复测） |
| Y14 | [regional-anime](https://www.youtube.com/watch?v=2fggx6tq3-Q) | 地区限制；按真实 yt-dlp 返回补全匹配，最终定点复测为 `LINK_REGION_RESTRICTED` |
| Y15 | [age-restricted](https://www.youtube.com/watch?v=Tq92D6wQ1mg) | 明确失败：`LINK_AGE_RESTRICTED` |
| Y16 | [nonexistent](https://www.youtube.com/watch?v=00000000000) | 明确失败：`LINK_UNAVAILABLE` |
| Y17 | bare-id（仅 ID，无 URL） | 明确失败：`UNSAFE_URL` |
| Y18 | [share](https://youtu.be/fNk_zzaMoSs。) | 成功：video（冷却后复测） |
| Y19 | [live-channel](https://www.youtube.com/@LofiGirl/live) | 成功：video；live |
| Y20 | [channel-streams](https://www.youtube.com/@LofiGirl/streams) | 成功：playlist；24 条；提示 `LINK_METADATA_INCOMPLETE`；实时流本身没有固定时长，其他缺失项仍提示不完整 |
| Y21 | [channel-shorts](https://www.youtube.com/@3blue1brown/shorts) | 成功：playlist；84 条；提示 `LINK_METADATA_INCOMPLETE`；首轮时长 84/84，第二轮时长 0/84 |
| Y22 | [nocookie](https://www.youtube-nocookie.com/embed/fNk_zzaMoSs) | 成功：video（冷却后复测） |
| Y23 | [watchlater](https://www.youtube.com/playlist?list=WL) | 明确失败：`LINK_UNAVAILABLE`；未登录的个人稍后观看列表不可公开读取 |
| Y24 | [live-id](https://www.youtube.com/live/4t4AQ15yj1M) | 成功：video；live（冷却后复测） |
| Y25 | [live-watch](https://www.youtube.com/watch?v=4t4AQ15yj1M) | 成功：video；live（冷却后复测） |
| B41 | [public-favorite](https://space.bilibili.com/2142762/favlist?fid=472824462) | 成功：playlist；87 条 |

## 自动化与浏览器回归

容器内执行 `npm ci`、`npm run lint`、`npm test`、`npm run build`。112 项测试通过，包含 URL/短链安全、分页被平台缩小页数、空列表、2000 条上限、限制错误分类、直播映射、停止受限补取、缓存隔离、旧元数据补全和观看记录保留。

通过内置浏览器操作真实服务，检查 320×740、390×844 手机、768×1024 平板、1440×900 桌面视口：

- B站短链 23P 导入、确认保存、第 2P 标记、刷新不重复且进度保留。
- YouTube 单视频年份/时长预览、非法年份阻止保存、保存后标记已看，以及直播状态徽标。
- 番剧转 TMDB 搜索、中文结果加入片库、详情季集与 TMDB/IMDb 评分。
- 新建列表、详情打开、添加作品、首页置顶显示；修复原有 `listId` 与 `id` 路由参数不一致。
- 内网链接拒绝、片库过滤、中英文切换、深浅主题、长标题换行、滚动弹窗及图片加载。

以上是桌面浏览器视口模拟，未声称进行 iOS Safari/Android 真机、离线安装或所有辅助技术组合测试。

生产镜像通过全新 `npm ci` 构建；补齐运行时 i18n 文件，使用非 root 用户。加入 SIGTERM/SIGINT 处理，关闭数据库并对 SSE 长连接设置 5 秒退出上限。

## 实现边界与后续优化

- 单次最多 2000 条；超大列表明确报错。B站分页最多 100 次请求且有总超时；少于平台声明数量时提示不完整。
- YouTube 仍依赖平台可访问性和 yt-dlp，不保证登录、会员、年龄或地区受限内容。不能通过本项目绕过购买或访问限制。
- 公开视频元数据短时缓存；并发上限 4。频道补取最多 4 个工作任务、60 秒预算，遇到反机器人或登录限制停止发起新补取。显式刷新绕过结果缓存。
- 直播状态是导入/刷新时的快照，不会持续轮询房间状态；直播通常没有固定总时长。
- 可选 `YTDLP_COOKIES_FILE` 仅供部署者配置自己的私有 Netscape 格式 Cookie 文件；不写入 Git，不向前端返回，yt-dlp 可能更新该文件。本轮没有提供或测试账号 Cookie。
- 前端构建仍有约 994 kB（gzip 294 kB）的入口分块提示，后续可独立做路由拆包。当前未为消除提示而引入未经验证的大版本变更。
- 构建时开发依赖审计为 2 low、13 moderate，集中于工具链传递依赖；生产依赖 `npm audit --omit=dev` 为 0。未使用会降级/破坏主工具链的 `npm audit fix --force`。审计数字仅对测试时的锁文件和数据库有效。

## 参考文档

- [HeroUI Modal](https://heroui.com/en/docs/react/components/modal)、[TextField](https://heroui.com/en/docs/react/components/text-field)、[Toast](https://heroui.com/en/docs/react/components/toast)
- [Node.js TypeScript 支持与 erasableSyntaxOnly](https://nodejs.org/api/typescript.html)
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/)
- [yt-dlp 官方文档](https://github.com/yt-dlp/yt-dlp)、[Bilibili extractor](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/bilibili.py)
- [TMDB 应用认证](https://developer.themoviedb.org/docs/authentication-application)、[OMDb API](https://www.omdbapi.com/)
