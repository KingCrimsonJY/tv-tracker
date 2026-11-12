<div align="center">

# 帧迹 Zhenji

**个人自托管的电影与剧集观看进度追踪应用 —— 影院级界面、单目录便携存储、多设备实时同步。**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![HeroUI v3](https://img.shields.io/badge/HeroUI-v3-006FEE)](https://heroui.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x_Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](./Dockerfile)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](./LICENSE)

**简体中文** | [English](./README.en.md)

<br />

<picture>
  <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/desktop-home-light.webp" />
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/desktop-home.webp" />
  <img src="docs/screenshots/desktop-home.webp" alt="帧迹桌面端首页预览（自动适配深色与浅色主题）" width="880" />
</picture>

</div>

## 界面预览

### 追剧

<table>
  <tr>
    <td align="center">
      <img src="docs/screenshots/phone-home.webp" alt="手机端首页：继续观看、有新集提醒与置顶片单进度" width="250" /><br />
      <sub>首页（继续观看与有新集提醒）</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/phone-detail.webp" alt="手机端剧集详情页：评分徽标、主操作按钮、分季与分集勾选列表" width="250" /><br />
      <sub>剧集详情与分集记录</sub>
    </td>
  </tr>
</table>

### 片单

<table>
  <tr>
    <td align="center">
      <img src="docs/screenshots/phone-list.webp" alt="手机端顺序片单：漫威无限传奇观影顺序与下一部待看高亮" width="250" /><br />
      <sub>顺序片单（自动高亮下一部待看）</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/phone-library.webp" alt="手机端个人片库：海报墙与状态、类型筛选" width="250" /><br />
      <sub>个人片库海报墙</sub>
    </td>
  </tr>
</table>

### 批量管理与平板布局

<table>
  <tr>
    <td align="center">
      <img src="docs/screenshots/phone-library-select.webp" alt="手机端片库多选：已选三部作品，浮动操作条提供修改状态、加入列表与删除" width="250" /><br />
      <sub>片库多选批量管理</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/tablet-library.webp" alt="平板端片库：左侧导航导轨与海报墙" width="420" /><br />
      <sub>平板布局（导航导轨）</sub>
    </td>
  </tr>
</table>

### 链接导入

<table>
  <tr>
    <td align="center">
      <img src="docs/screenshots/phone-link-import.webp" alt="手机端通过链接添加：解析视频合集并预览分集列表" width="250" /><br />
      <sub>播放列表链接解析预览</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/phone-playlist-detail.webp" alt="手机端链接导入合集详情页：共 N 集元数据与单列表分集记录" width="250" /><br />
      <sub>导入合集的详情与分集追踪</sub>
    </td>
  </tr>
</table>

### 深浅色主题

<table>
  <tr>
    <td align="center">
      <img src="docs/screenshots/phone-home.webp" alt="手机端深色影院主题首页" width="250" /><br />
      <sub>深色主题（默认）</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/phone-home-light.webp" alt="手机端浅色主题首页" width="250" /><br />
      <sub>浅色主题</sub>
    </td>
  </tr>
</table>

<details>
<summary>更多截图（桌面端详情页）</summary>
<br />
<p align="center">
  <img src="docs/screenshots/desktop-detail.webp" alt="桌面端剧集详情页：海报叠层、多平台评分与带剧照的分集列表" width="880" />
</p>
</details>

## 功能特性

### 追剧与观影记录

- **清晰的状态归类**：自动将作品归为「未开播」「未看」「观看中」「已追平」「已看完」，并支持随时手动设为「暂停」或「弃剧」。
- **连载更新提醒**：正在追的连载剧追平后显示「已追平」；当新剧集播出后会自动回到「观看中」并点亮 **有新集** 提醒。
- **顺手的分集勾选**：支持单集点选、整季一键标记或取消、「标记到此集」（自动勾选当前集及之前所有已开播剧集，不会取消后面已勾过的集数）以及整部标记已看；尚未开播的剧集会显示开播日期并防止误触。
- **精确断点记录**：看到一半时可记录具体时间点（如 `S2·E5 · 42:15`），下次打开首页或详情页即可接着看；看完该集后断点自动清除。
- **多刷历史与随时撤回**：看完的作品可一键开启「二刷 / 多刷」，完整保留每一次观看的起止日期；如果误操作，可随时逐级撤回最新一轮观看记录（直至恢复为「未看」），或单独删除任意一条历史记录。

### 片单与整理

- **顺序片单**：适合「漫威无限传奇观影顺序」等系列作品，按编号排列并自动高亮第一部还没看完的作品（`下一部待看`），置顶后直接在首页展示下一部与整体进度。
- **收藏合集**：适合「周末想看的电影」等主题片单，以海报墙展示，支持按添加时间、名称、年份、评分排序或手动拖拽调整顺序。
- **片库批量管理**：在片库进入「选择」模式后点选作品（或全选当前筛选结果），即可一次性修改状态（已看 / 未看 / 暂停 / 弃剧 / 恢复追剧）、加入列表或删除（删除前二次确认）。几十部作品作为一次操作提交并同步到所有设备；支持键盘操作（空格勾选、`Ctrl/⌘+A` 全选、`Esc` 退出）。

### 丰富的添加方式

- **TMDB 搜索**：支持中文、原名或英文搜索全球电影、剧集与番剧，自动获取中英双语标题、简介、海报、分季分集与开播日期，并在展示 **TMDB** 评分的同时按需聚合 **IMDb**、**烂番茄 (Rotten Tomatoes)** 与 **Metacritic** 评分。
- **通过链接导入视频与合集**：遇到 TMDB 没有收录的网络课程、纪录片或视频合集，可直接粘贴 YouTube、哔哩哔哩 (Bilibili) 等链接或带标题的分享口令，自动解析单视频、播放列表、合集与分P，后续还能一键「刷新列表」追加新发布的分集。若粘贴的是番剧或剧集链接，会自动提示跳转 TMDB 搜索。
- **手动添加**：支持完全自定义录入标题、类型、海报链接与总集数。

### 多端体验与数据便携

- **手机、平板、电脑自适应**：手机端（< 640px）采用底部导航栏与抽屉菜单；平板端（640–1023px）采用左侧导航导轨，置顶列表、设置与安装入口都在导轨上；电脑端（≥ 1024px）提供完整侧边栏与置顶列表快捷入口。支持作为 PWA 添加到主屏幕全屏使用。
- **多设备实时同步**：在手机上勾选一集，平板和电脑页面会立即同步更新。
- **高度可定制**：支持深色、浅色与跟随系统主题，支持全局或单部作品独立切换标题语言（中文 / 原名 / 英文），可自由开关是否将特别篇 (Season 0) 计入进度，以及自定义首页显示的模块与顺序。
- **单文件夹便携备份**：所有数据库、每日自动备份与 JSON 导出文件均存放在同一个 `./data` 文件夹内，复制文件夹即可迁移到新机器，也支持在设置页随时导出或恢复 JSON 备份。

## 技术架构

- **前端**：React 19 + TypeScript 6（严格模式）+ HeroUI v3（`@heroui/react` + `@heroui/styles`）+ Tailwind CSS v4。
- **纯函数实时状态推导**：数据库不存储易过期的派生状态，所有作品与分季状态均由 `src/domain/` 中的纯函数根据分集开播日期、当前轮次勾选记录与手动状态实时计算。
- **单事务原子操作与乐观更新**：服务端采用 Express + Node.js 内置 `node:sqlite`（WAL 模式 + 外键级联删除）。每次写入都在单个 SQLite 事务内完成并递增全局 `version`：单部作品的多步修改走原子动作接口（`POST /api/titles/:id/actions`），片库批量操作走 `POST /api/titles/batch`。前端的界面状态是「服务端已确认的状态 + 本机尚未确认的修改」：修改立即可见，请求失败时撤销该修改并提示，其他设备的事件不会打断正在提交的修改。
- **实时同步与分数索引排序**：服务端通过 Server-Sent Events (`/api/events`) 推送增量变更与进程 `epoch`，断线重连或切回前台时自动校验快照；列表拖拽基于 `fractional-indexing` 与 `@dnd-kit`，每次调整仅写入单行排序键。
- **安全防护**：基于 `node:crypto` `scrypt` 随机盐哈希与 `timingSafeEqual` 校验单用户密码，配合首次启动一次性设置码 (`SETUP_CODE`)、`HttpOnly; SameSite=Lax` 365 天滑动会话、CSRF `Origin` 校验、按 IP 与全局双重登录限流、以及外链抓取 SSRF 内网地址拦截。

## 链接导入支持

B站的 BV/AV、移动端、短链接、分P、合集、系列、番剧、电影、课堂及直播回放优先读取公开元数据；YouTube 单视频、Shorts、播放列表及直播回放通过 yt-dlp 解析。直播间、进行中的直播、收藏夹、稍后再看和频道投稿页不支持导入。番剧会自动查找 TMDB 匹配，没有匹配时仍可按链接保存。YouTube 列表先保存条目，再在后台补齐缺失的标题和时长。刷新保留本地结构与观看记录；删除、拆季和重新编号须在详情页预览后确认，也可锁定结构。

- 空列表、失效链接、登录／年龄／地区限制会明确提示；网页降级结果不会伪装成完整解析。
- 单次最多 2000 条。分集补全有并发和时间限制；未取得的字段保持未知并提示，不生成虚假日期。
- 元数据可读不代表具有播放权限；本应用不下载视频，也不绕过付费、会员或地区限制。

## 已知限制

- **仅限单用户使用**：专为个人片库设计，使用单一访问密码保护，不包含多账号系统或社交分享功能。
- **不支持离线使用**：为彻底避免多设备离线修改引发合并冲突，检测到连接失败后等待 5 秒，或心跳中断约 15 秒后再等待 5 秒，会全屏提示「无法连接到服务器」并暂停编辑操作。
- **云服务器 IP 可能受限于部分视频站点**：YouTube 等平台常对数据中心（VPS）IP 触发人机验证拦截 `yt-dlp`，因此「通过链接添加」功能在家庭宽带自托管环境（如家用 Linux 主机 + 内网穿透隧道）下效果最佳。
- **无豆瓣评分**：由于豆瓣没有公开稳定的官方 API，应用不抓取豆瓣评分，提供 TMDB、IMDb、烂番茄与 Metacritic 评分。
- **API 密钥要求**：需要申请一个免费的 **TMDB Read Access Token 或 v3 API Key** 才能使用影视搜索与元数据自动更新；**OMDb API Key** 为可选配置（仅用于补充 IMDb / 烂番茄 / Metacritic 评分）。

## 快速开始（本地开发）

### 环境要求

- **Node.js `>= 22.18.0`**（推荐使用 **Node.js 24 LTS**；内置 `node:sqlite` 模块开箱即用）
- **npm `>= 10`**
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**（可选但推荐，用于「通过链接添加」解析视频、合集与播放列表；可通过 `npm run setup:ytdlp` 一键下载至 `./.bin/yt-dlp`，Docker 镜像已内置至 `/opt/yt-dlp/yt-dlp`）

### 启动步骤

```bash
# 1. 克隆仓库
git clone https://github.com/KingCrimsonJY/tv-tracker.git
cd tv-tracker

# 2. 复制环境变量模板并填入 TMDB_READ_TOKEN
cp .env.example .env

# 3. 安装依赖
npm ci

# 4. 启动开发服务器（默认监听 http://localhost:3000）
npm run dev
```

### 首次启动设置密码

首次启动且数据库尚未设置密码时，终端日志会打印一行**一次性设置码**：

```text
[Auth] First-run setup code: X7k9Pq2mR4vL
```

打开浏览器访问 `http://localhost:3000`，输入终端里显示的设置码（或 `.env` 中预设的 `SETUP_CODE`）并设置至少 10 个字符的访问密码即可进入应用。

> 如需生成包含精选示例影视、漫威观影顺序与 3Blue1Brown 播放列表的演示数据库（写入 `./data-demo`，绝不修改 `./data`），可运行 `npm run seed:demo`。

## 配置说明

所有配置项均位于服务端 `.env` 文件中（参考 [`.env.example`](./.env.example)）：

| 变量名              |   必填   | 默认值    | 用途说明                                                                                                                     | 获取方式 / 备注                                                                              |
| :------------------ | :------: | :-------- | :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| `TMDB_READ_TOKEN`   | **必填** | 空        | TMDB Read Access Token（Bearer）或 v3 API Key（自动识别），用于影视搜索与元数据                                              | 在 [TMDB 开发者设置](https://www.themoviedb.org/settings/api) 免费申请 API Read Access Token |
| `OMDB_API_KEY`      |   可选   | 空        | 按 IMDb ID 查询 IMDb、烂番茄、Metacritic 评分（详情页按需请求并缓存 7 天）                                                   | 在 [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) 免费申请（1,000 次/天）    |
| `DATA_DIR`          |   可选   | `./data`  | SQLite 数据库、自动备份与每日 JSON 导出的统一存储目录                                                                        | Docker 容器内固定为 `/data`                                                                  |
| `YTDLP_PATH`        | 可选覆盖 | 自动探测  | 自定义 `yt-dlp` 可执行文件路径（不在 `.env.example` 中列出，仅在需覆盖默认路径时设置）                                       | 未设置或为空时按顺序探测 `/opt/yt-dlp/yt-dlp`、`./.bin/yt-dlp` 与系统 `PATH` 中的 `yt-dlp`   |
| `SETUP_CODE`        |   可选   | 随机生成  | 首次启动设置密码时要求输入的一次性验证设置码                                                                                 | 留空时会在服务端启动日志中自动生成并打印                                                     |
| `APP_PASSWORD_HASH` |   可选   | 空        | 覆盖数据库密码的 `scrypt` 哈希值（用于重置忘记的密码）                                                                       | 通过 `npm run set-password` 交互式生成                                                       |
| `TRUST_PROXY`       |   可选   | `0`       | 设为 `1` 时信任反代头：`CF-Connecting-IP` 或 `X-Forwarded-For` 最后一段用于按 IP 限流，`X-Forwarded-Host` 用于 CSRF 来源校验 | 仅在 Cloudflare Tunnel 或会覆盖这些请求头的反向代理之后设为 `1`；直接暴露端口时保持 `0`      |
| `PORT`              |   可选   | `3000`    | Node.js 服务端监听端口                                                                                                       | 本地或容器内默认 `3000`                                                                      |
| `HOST`              |   可选   | `0.0.0.0` | Node.js 服务端监听的网络接口                                                                                                 | 同机反向代理部署时可设为 `127.0.0.1`                                                         |

## 部署

同一份代码支持三种部署方式，数据目录可以在它们之间直接搬迁：

```bash
git clone https://github.com/KingCrimsonJY/tv-tracker.git
cd tv-tracker
cp .env.example .env          # 填入 TMDB_READ_TOKEN 等配置
```

**Docker Compose**

```bash
mkdir -p data && sudo chown 1000:1000 data
docker compose up -d --build
docker compose logs zhenji | grep "First-run setup code"    # 首次启动的一次性设置码
```

**Podman（Rootless）**

```bash
podman build -t zhenji .
mkdir -p data
podman run -d --name zhenji --userns=keep-id:uid=1000,gid=1000 --env-file .env \
  -p 127.0.0.1:8080:3000 -v ./data:/data:Z localhost/zhenji
```

**直接运行（Node.js 24）**

```bash
npm ci && npm run build
npm run setup:ytdlp           # 可选：链接导入所需的 yt-dlp
npm start                     # http://localhost:3000，数据写入 ./data
```

容器内以非 root 用户（uid 1000）运行，上面的 `chown` 与 `--userns=keep-id` 就是为了让它能写入 `./data`；镜像名均为完整名称，Podman 无需配置默认仓库。容器方式默认把服务绑定在宿主机的 `127.0.0.1:8080`。

> **对外访问请使用 HTTPS。** 生产模式的会话 Cookie 带 `Secure` 属性，浏览器只在 HTTPS 或本机（`localhost` / `127.0.0.1`）下保存它。用 `http://局域网IP:端口` 打开时，密码正确也无法登录，登录页会给出相应提示。

compose 文件内置 `cloudflare`（Cloudflare Tunnel）与 `tailscale`（Tailscale Serve / Funnel）两个可选 Profile。Quadlet 开机自启、`podman compose`、systemd 服务、反向代理要求、升级、密码重置与排错，请参阅 **[《部署指南》(docs/deployment.md)](./docs/deployment.md)**。

## 数据与备份

所有持久化数据全部保存在单一文件夹 `DATA_DIR`（默认 `./data`）中，不依赖任何外部数据库服务，也不在目录外写入任何文件：

```text
data/
  tracker.db                                    # 主 SQLite 数据库（开启 WAL 与外键级联）
  backups/tracker-YYYY-MM-DD.db                 # 每日自动 VACUUM INTO 快照（保留最新 14 份）
  backups/tracker-YYYY-MM-DD-HHmmss-pre-*.db    # 数据库迁移或导入前的安全快照（保留最新 10 份）
  exports/zhenji-YYYY-MM-DD.json                # 每日原子写入的 JSON 全量导出（保留最新 14 份）
```

- **迁移到新机器**：停止服务，将 `./data` 文件夹与 `.env` 复制到新机器后启动即可；也可以借此在 Docker、Podman 与直接运行之间切换。
- **恢复备份**：既可以在停止服务后用 `backups/*.db` 替换 `tracker.db`，也可以在应用「设置 → 数据备份与迁移 → 导入数据 (JSON)」中直接上传 `exports/*.json` 恢复（导入会替换全部数据）。
- **导出文件格式**：完整的 JSON 导出结构与跨版本兼容规范请参阅 **[《数据导出格式说明》(docs/data-format.md)](./docs/data-format.md)**。

## 开发与测试

```bash
# 启动前后端开发服务器 (http://localhost:3000)
npm run dev

# 运行 TypeScript 类型检查 (tsc --noEmit) 与 ESLint 代码检查
npm run lint

# 运行 Vitest 单元测试与集成测试
npm test

# 构建生产环境前端静态资源至 dist/
npm run build

# 以生产模式启动服务端
npm start

# 下载并校验 yt-dlp 独立可执行文件至 ./.bin/yt-dlp
npm run setup:ytdlp

# 生成密码重置哈希（终端隐藏输入两次新密码，至少 10 位）
npm run set-password

# 生成精选演示数据库至 ./data-demo（不会修改 ./data）
npm run seed:demo

# 检查代码格式（CI 同样执行）
npm run format:check

# 基于演示数据库重新生成 README 截图至 docs/screenshots（需先 seed:demo 与 build；
# 两步都应在 TMDB_READ_TOKEN 与 OMDB_API_KEY 为空时执行，以使用仓库内置的固定数据）
npm run screenshots
```

### 性能与界面验收

性能与界面验收脚本需要 Playwright 的 Chromium（在开发容器内执行）：

```sh
npx playwright install --with-deps chromium
npm run build
npm run perf
npm run qa
```

性能脚本使用独立的临时 SQLite 数据库，不读取或覆盖 `DATA_DIR`。夹具包含 300 部作品：普通 40 集剧集、150 集剧集、564 集合集和 12 部电影。浏览器采用 390 × 844 视口、4 倍 CPU 降速、150ms 延迟、1.6Mbps 下行和 750Kbps 上行，并关闭缓存与 Service Worker，测量冷启动。

双语文本由固定种子生成，图片使用本地夹具；不需要 API Key，也不请求上游服务。结果不包含 Cloudflare Tunnel 或外部图片服务的额外延迟。性能报告逐项列出预算是否达标；设置 `PERF_ENFORCE_BUDGETS=1` 可在超标时返回失败。`PERF_OUTPUT_DIR` 指定容器内的报告目录。可选的 `PERF_PROFILE` 指定 CPU 采样文件路径，仅用于诊断；正式对比时不要开启。

片库索引不传输单集名称、简介和剧照；进入详情页后按需加载并缓存。导出始终读取服务端完整资料，保持 v2 备份格式。

批量管理也在同一份 300 部作品的片库上计量：进入选择模式、点选、全选、对 48 部和对全部作品提交批量操作的最长任务，以及一次批量操作恰好产生一个请求且不重新拉取状态。

界面验收脚本在手机（320、390px）、平板（768、820px）与电脑（1280、1440px）六种视口下，以中英文和深浅色主题运行：检查每种布局显示的导航是否正确、平板导轨能否到达置顶列表、电影页、上游变更页、预览弹窗和集数范围选择，并在两台设备间验证片库多选批量管理（一次请求、一次同步事件）、勾选同步、详情缓存和备份替换；浏览器控制台出现任何错误都会失败。`QA_OUTPUT_DIR` 指定容器内的截图与报告目录；未指定时创建独立临时目录。截图和运行数据不提交到仓库。

## 致谢与数据来源

<p>
  <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
    <img src="public/tmdb-logo.svg" alt="TMDB Logo" height="16" />
  </a>
</p>

> **This product uses the TMDB API but is not endorsed or certified by TMDB.**

- **[The Movie Database (TMDB)](https://www.themoviedb.org/)**：提供影视搜索、多语言标题、TMDB 评分、分季分集元数据以及海报与剧照图片。
- **[OMDb API](https://www.omdbapi.com/)**：提供 IMDb、Rotten Tomatoes 与 Metacritic 评分数据。
- **开源社区项目**：感谢 [React 19](https://react.dev/)、[HeroUI v3](https://heroui.com/)、[Tailwind CSS v4](https://tailwindcss.com/)、[yt-dlp](https://github.com/yt-dlp/yt-dlp)、[@dnd-kit](https://dndkit.com/)、[Lucide Icons](https://lucide.dev/) 与 [Zod](https://zod.dev/)。

## 许可证

本项目基于 [MIT License](./LICENSE) 开源，Copyright (c) 2026 KingCrimsonJY。
