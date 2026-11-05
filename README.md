<div align="center">

# 帧迹 Zhenji

**个人自托管的电影与剧集观看进度追踪应用 —— HeroUI v3 影院级界面、单文件 SQLite 便携存储、多端实时同步。**

[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![HeroUI v3](https://img.shields.io/badge/HeroUI-v3-006FEE)](https://heroui.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x_Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](./Dockerfile)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](./LICENSE)

**简体中文** | [English](./README.en.md)

</div>

---

## 界面预览

### 手机端（`390×844`）

| 首页（深色） | 个人片库 | 剧集详情与分集 | 顺序片单（漫威无限传奇观影顺序） |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/phone-home.webp" alt="手机端首页（深色）" width="190" /> | <img src="docs/screenshots/phone-library.webp" alt="手机端个人片库" width="190" /> | <img src="docs/screenshots/phone-detail.webp" alt="手机端剧集详情与分集列表" width="190" /> | <img src="docs/screenshots/phone-list.webp" alt="手机端顺序片单（漫威无限传奇观影顺序）" width="190" /> |

| 外链导入预览（播放列表） | 合集详情与剧集列表 | 首页（浅色） |
| :---: | :---: | :---: |
| <img src="docs/screenshots/phone-link-import.webp" alt="手机端播放列表外链解析预览" width="220" /> | <img src="docs/screenshots/phone-playlist-detail.webp" alt="手机端合集详情与分集列表" width="220" /> | <img src="docs/screenshots/phone-home-light.webp" alt="手机端首页（浅色）" width="220" /> |

### 桌面端（`1280×800`）

<p align="center">
  <img src="docs/screenshots/desktop-home.webp" alt="桌面端首页" width="880" />
</p>
<p align="center">
  <img src="docs/screenshots/desktop-detail.webp" alt="桌面端影视详情页" width="880" />
</p>

---

## 功能特性

### 进度追踪
- **纯函数实时状态推导**：绝不存储易过期的派生状态，所有状态（`未开播` / `未看` / `观看中` / `已追平` / `已看完` / `暂停` / `弃剧`）均根据分集开播日期与勾选记录实时计算。
- **追剧感知与「有新集」提醒**：连载剧追平后显示「已追平」；当后续剧集开播后自动转为「观看中」并点亮 **有新集** 徽标。
- **高效批量操作**：支持单集勾选、整季一键标记/取消、「标记到此集」（自动勾选当前集及之前所有已开播剧集，不会误取消后续集）、整部标记已看；未开播剧集自动禁用防误触。
- **精确时间点记录**：支持为电影或当前剧集记录 `mm:ss` / `h:mm:ss` 观看位置（如 `S2·E5 · 42:15`），勾选该集已看后自动清除断点。
- **多刷历史与逐级撤回**：已看完或已追平的作品可开启新一轮重看（`二刷中`），完整保留历次观看起止时间（「看过 2 次」）。支持随时**逐级撤回**最新一轮观看记录（如从第 3 刷撤回至第 2 刷、第 1 刷直至重置为 `未看`），也可单独删除任意一轮历史记录并按开始日期自动重新编号。

### 列表
- **顺序片单 (Ordered List)**：适合「漫威无限传奇观影顺序」等系列片单，自动高亮第一部尚未看完的作品（`下一部待看`），并在首页置顶卡片展示下一部待看与总进度。
- **收藏合集 (Collection)**：海报墙视图，支持按添加时间、名称、年份、评分或手动拖拽排序。
- **分数索引单行排序**：基于 `fractional-indexing` 与 `@dnd-kit`，移动端长按手柄拖拽排序每次仅更新单行记录。

### 数据来源
- **TMDB 主数据源**：自动获取中英双语标题、原始片名、TMDB 评分、分季分集信息、开播日期、剧照与海报，打开详情页时按策略自动刷新连载元数据。
- **多平台评分聚合**：展示 **TMDB** 评分，并结合 OMDb 按 IMDb ID 获取 **IMDb**、**烂番茄 (Rotten Tomatoes)** 与 **Metacritic** 评分（7 天缓存，按需拉取不消耗多余配额）。
- **yt-dlp 链接解析与自定义条目**：基于 **yt-dlp** 解析 YouTube、哔哩哔哩 (Bilibili) 等网站的单视频、播放列表、合集与分P（支持直接粘贴带标题的分享口令，支持后续增量「刷新列表」追加新集且保留已有观看记录；检测到番剧/剧集时自动提示一键跳转 TMDB 搜索；未安装 `yt-dlp` 时自动降级为基础 Open Graph 解析），也可随时手动创建自定义影视条目。

### 同步与安全
- **多端实时同步 (SSE)**：服务端基于单调递增版本号 (`version`) 与进程纪元 (`epoch`) 通过 Server-Sent Events 实时推送变更；乐观更新配合原子事务接口 (`POST /api/titles/:id/actions`)，确保多步状态修改在单事务内完成。
- **有意禁用离线模式**：为彻底杜绝多设备离线缓存合并冲突，当与服务端断开连接超过 5 秒时将全屏提示「无法连接到服务器」并阻止编辑，重连后自动拉取最新快照。
- **单用户密码与设置码防护**：`node:crypto` `scrypt` 随机盐哈希、`timingSafeEqual` 恒定时间比对、首次运行一次性设置码 (`SETUP_CODE`) 验证、登录失败 IP 与全局双重限流、以及 SSRF 内网地址拦截。

### 界面
- **HeroUI v3 影院级设计**：灵感源自 Infuse 与 Apple TV，基于 **HeroUI v3** (`@heroui/react` + `@heroui/styles`) 与 **Tailwind CSS v4** 构建；移动端底部安全区导航栏、平板侧边导轨、桌面端侧边栏与置顶列表快捷入口。
- **主题与个性化**：默认深色影院模式，支持浅色模式与跟随系统；支持全局/单作品标题语言切换、是否计入特别篇 (Season 0)、首页模块开关与拖拽排序。
- **PWA 桌面/主屏安装**：符合 Web App Manifest 规范，可添加到手机主屏幕全屏独立运行（Service Worker 仅缓存应用外壳，绝不缓存 `/api/*` 数据）。

---

## 快速开始（本地开发）

### 环境要求
- **Node.js `>= 22.13.0`**（推荐使用 **Node.js 24 LTS**；内置 `node:sqlite` 模块自 Node.js `22.13.0` 起无需实验性参数即可直接使用）
- **npm `>= 10`**
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**（可选但推荐，用于「通过链接添加」解析视频、合集与播放列表；可通过 `npm run setup:ytdlp` 一键下载至 `./.bin/yt-dlp`，Docker 镜像已内置至 `/opt/yt-dlp/yt-dlp`）

### 启动步骤

```bash
# 1. 克隆仓库
git clone https://github.com/KingCrimsonJY/zhenji.git
cd zhenji

# 2. 复制环境变量模板并填入 TMDB_READ_TOKEN
cp .env.example .env

# 3. 安装依赖
npm install

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

---

## 配置说明

所有配置项均位于服务端 `.env` 文件中（参考 [`.env.example`](./.env.example)）：

| 变量名 | 必填 | 默认值 | 用途说明 | 获取方式 / 备注 |
| :--- | :---: | :--- | :--- | :--- |
| `TMDB_READ_TOKEN` | **推荐** | 空 | TMDB API v4 读访问令牌（Bearer 认证），用于搜索影视与获取分季分集元数据 | 在 [TMDB 开发者设置](https://www.themoviedb.org/settings/api) 免费申请 API Read Access Token |
| `OMDB_API_KEY` | 可选 | 空 | 按 IMDb ID 查询 IMDb、烂番茄、Metacritic 评分（详情页按需请求并缓存 7 天） | 在 [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) 免费申请（1,000 次/天） |
| `DATA_DIR` | 可选 | `./data` | SQLite 数据库、自动备份与每日 JSON 导出的统一存储目录 | Docker 容器内固定为 `/data` |
| `YTDLP_PATH` | 可选覆盖 | 自动探测 | 自定义 `yt-dlp` 可执行文件路径（不在 `.env.example` 中列出，仅在需覆盖默认路径时设置） | 未设置或为空时按顺序探测 `/opt/yt-dlp/yt-dlp`、`./.bin/yt-dlp` 与系统 `PATH` 中的 `yt-dlp` |
| `SETUP_CODE` | 可选 | 随机生成 | 首次启动设置密码时要求输入的一次性验证设置码 | 留空时会在服务端启动日志中自动生成并打印 |
| `APP_PASSWORD_HASH` | 可选 | 空 | 覆盖数据库密码的 `scrypt` 哈希值（用于重置忘记的密码） | 通过 `npm run set-password` 交互式生成 |
| `TRUST_PROXY` | 可选 | `0` | 设为 `1` 时信任反代头（`CF-Connecting-IP` / `X-Forwarded-For`）以准确按客户端 IP 限流 | 使用 Cloudflare Tunnel 或反向代理时设为 `1` |
| `PORT` | 可选 | `3000` | Node.js 服务端监听端口 | 本地或容器内默认 `3000` |

---

## 部署

使用 Docker Compose 即可在两分钟内完成自托管部署：

```bash
git clone https://github.com/KingCrimsonJY/zhenji.git
cd zhenji
cp .env.example .env
# 编辑 .env 填入 TMDB_READ_TOKEN 等配置
mkdir -p data && sudo chown 1000:1000 data
docker compose up -d --build

# 查看首次启动的一次性设置码
docker compose logs zhenji | grep "First-run setup code"
```

默认配置将服务绑定在宿主机 `127.0.0.1:8080:3000`，并内置 `cloudflare`（Cloudflare Tunnel）与 `tailscale`（Tailscale Funnel）两个可选 Compose Profile。完整的 Linux 环境配置、隧道接入、版本升级、密码重置与防休眠设置请参阅 **[《部署指南》(docs/deployment.md)](./docs/deployment.md)**。

---

## 数据与备份

所有持久化数据全部保存在单一文件夹 `DATA_DIR`（默认 `./data`）中，不依赖任何外部数据库服务，也不在目录外写入任何文件：

```text
data/
  tracker.db                                    # 主 SQLite 数据库（开启 WAL 与外键级联）
  backups/tracker-YYYY-MM-DD.db                 # 每日自动 VACUUM INTO 快照（保留最新 14 份）
  backups/tracker-YYYY-MM-DD-HHmmss-pre-*.db    # 数据库迁移或导入前的安全快照（保留最新 10 份）
  exports/zhenji-YYYY-MM-DD.json                # 每日原子写入的 JSON 全量导出（保留最新 14 份）
```

- **迁移到新机器**：只需停止容器，将 `./data` 文件夹与 `.env` 复制到新机器，启动同一个 Docker 镜像即可无缝衔接。
- **恢复备份**：既可以在停止容器后用 `backups/*.db` 替换 `tracker.db`，也可以在应用「设置 → 导入数据 (JSON)」中直接上传 `exports/*.json` 恢复。
- **导出文件格式**：完整的 JSON 导出结构与跨版本兼容规范请参阅 **[《数据导出格式说明》(docs/data-format.md)](./docs/data-format.md)**。

---

## 开发与测试

```bash
# 启动前后端开发服务器 (http://localhost:3000)
npm run dev

# 运行 TypeScript 严格模式类型检查
npm run lint

# 运行 Vitest 单元测试与集成测试（纯函数进度推导、重看撤回、SQLite 仓储、API 路由、SSRF 防护）
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
```

---

## 致谢与数据来源

<p>
  <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
    <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB Logo" height="20" />
  </a>
</p>

> **This product uses the TMDB API but is not endorsed or certified by TMDB.**

- **[The Movie Database (TMDB)](https://www.themoviedb.org/)**：提供影视搜索、多语言标题、TMDB 评分、分季分集元数据以及海报与剧照图片。
- **[OMDb API](https://www.omdbapi.com/)**：提供 IMDb、Rotten Tomatoes 与 Metacritic 评分数据。
- **开源社区项目**：感谢 [React 19](https://react.dev/)、[HeroUI v3](https://heroui.com/)、[Tailwind CSS v4](https://tailwindcss.com/)、[yt-dlp](https://github.com/yt-dlp/yt-dlp)、[@dnd-kit](https://dndkit.com/)、[Lucide Icons](https://lucide.dev/) 与 [Zod](https://zod.dev/)。

---

## 许可证

本项目基于 [MIT License](./LICENSE) 开源，Copyright (c) 2026 KingCrimsonJY。
