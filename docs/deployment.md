# 部署指南

帧迹只有一个 Node.js 进程和一个数据目录：没有外部数据库，没有后台队列。下面三种方式部署的是同一份代码，数据目录可以在它们之间直接搬迁。

| 方式                  | 适合                                     | 小节                       |
| :-------------------- | :--------------------------------------- | :------------------------- |
| Docker Compose        | 已经在用 Docker 的主机、NAS、VPS         | [§2](#2-docker-compose)    |
| Podman（含 Rootless） | Fedora / RHEL 系、不想运行 root 守护进程 | [§3](#3-podman含-rootless) |
| 直接运行 Node.js      | 不用容器，或想自己管进程                 | [§4](#4-直接运行-nodejs)   |

三种方式的后续步骤相同：[首次设置密码](#5-首次启动设置密码)、[通过 HTTPS 访问](#6-通过-https-访问)、[升级](#7-升级)、[备份与恢复](#8-备份恢复与迁移)。

---

## 1. 准备配置

```bash
git clone https://github.com/KingCrimsonJY/tv-tracker.git
cd tv-tracker
cp .env.example .env
```

编辑 `.env`。密钥只保存在服务端，不会发送给浏览器：

```dotenv
# 必填：TMDB Read Access Token（Bearer）或 v3 API Key，二者自动识别
TMDB_READ_TOKEN=

# 可选：OMDb API Key，用于 IMDb / 烂番茄 / Metacritic 评分
OMDB_API_KEY=

# 可选：自定义首次设置码；留空则启动时随机生成并打印到日志
SETUP_CODE=

# 仅当前面有会覆盖转发头的反向代理或 Cloudflare Tunnel 时设为 1
TRUST_PROXY=0
```

全部变量见 README 的「配置说明」。容器部署时 `DATA_DIR` 与 `PORT` 由镜像和 compose 文件固定，`.env` 里的同名项不生效。

---

## 2. Docker Compose

容器内以非 root 用户 `node`（uid 1000）运行，所以宿主机的数据目录要先交给 uid 1000，否则 Docker 会以 root 创建它，服务启动时会报「DATA_DIR is not writable」并退出：

```bash
mkdir -p data && sudo chown 1000:1000 data
docker compose up -d --build
```

服务监听在宿主机的 `127.0.0.1:8080`。只绑定回环地址是有意的：对外访问应当经过终结 HTTPS 的隧道或反向代理（见 [§6](#6-通过-https-访问)）。

常用命令：

```bash
docker compose logs -f zhenji      # 查看日志
docker compose ps                  # 健康检查状态（镜像自带 HEALTHCHECK）
docker compose down                # 停止
```

---

## 3. Podman（含 Rootless）

镜像和 compose 文件里的镜像名都是完整名称（`docker.io/library/node:24-bookworm-slim` 等），不依赖 Podman 的 `unqualified-search-registries` 配置。

Rootless Podman 与 Docker 有两点不同，都与数据目录有关：

- **用户映射**：容器内的 uid 1000 在宿主机上是你的某个子 uid，而不是你自己，所以属于你的 `./data` 对容器不可写。
- **SELinux**（Fedora、RHEL、CentOS Stream 等）：绑定挂载的目录需要 `:Z` 重新打标签，否则即使权限正确也会被拒绝。

### 3.1 podman run（推荐）

`--userns=keep-id:uid=1000,gid=1000` 把你本人映射为容器内的 uid 1000：数据文件在宿主机上仍然属于你，可以直接备份和编辑。需要 Podman 4.3 或更新版本。

```bash
podman build -t zhenji .
mkdir -p data
podman run -d --name zhenji \
  --userns=keep-id:uid=1000,gid=1000 \
  --env-file .env \
  -p 127.0.0.1:8080:3000 \
  -v ./data:/data:Z \
  localhost/zhenji
```

如果不想用绑定挂载，命名卷不需要任何权限处理（`podman volume export zhenji-data` 可导出）：

```bash
podman run -d --name zhenji --env-file .env -p 127.0.0.1:8080:3000 -v zhenji-data:/data localhost/zhenji
```

### 3.2 开机自启（Quadlet）

Podman 4.4+ 可以让 systemd 直接管理容器。把下面的文件存为 `~/.config/containers/systemd/zhenji.container`（路径换成你的实际目录）：

```ini
[Unit]
Description=Zhenji watch tracker

[Container]
Image=localhost/zhenji:latest
ContainerName=zhenji
UserNS=keep-id:uid=1000,gid=1000
EnvironmentFile=%h/tv-tracker/.env
PublishPort=127.0.0.1:8080:3000
Volume=%h/tv-tracker/data:/data:Z

[Service]
Restart=always

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user start zhenji
loginctl enable-linger "$USER"     # 未登录时也保持运行
```

### 3.3 podman compose

仓库里的 `docker-compose.yml` 可直接使用。compose 文件无法跨引擎表达 `keep-id`，所以改为把数据目录交给容器内的 uid 1000（文件在宿主机上将属于你的子 uid；需要以你本人身份读取时用 `podman unshare`）：

```bash
mkdir -p data && podman unshare chown 1000:1000 data
podman compose up -d --build
```

---

## 4. 直接运行 Node.js

需要 Node.js 24（最低 22.18，服务端直接运行 TypeScript 源文件）。

```bash
npm ci
npm run build              # 生成 dist/
npm run setup:ytdlp        # 可选：下载并校验 yt-dlp 到 ./.bin，用于链接导入
npm start                  # 监听 0.0.0.0:3000，数据写入 ./data
```

- `.env` 从启动目录读取。`PORT` 改端口；`HOST=127.0.0.1` 让服务只接受本机连接（前面有同机反向代理时建议这样设）；`DATA_DIR` 改数据目录。
- 构建完成后可执行 `npm prune --omit=dev` 去掉开发依赖，运行时只需要生产依赖。
- 运行用户需要对 `DATA_DIR` 有读写权限；不要用 root 运行。

systemd 示例（`/etc/systemd/system/zhenji.service`）：

```ini
[Unit]
Description=Zhenji watch tracker
After=network-online.target

[Service]
User=zhenji
WorkingDirectory=/opt/tv-tracker
ExecStart=/usr/bin/node server.ts
Environment=HOST=127.0.0.1
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 5. 首次启动设置密码

尚未设置密码时，服务会生成一次性设置码并打印到日志（在 `.env` 里设置了 `SETUP_CODE` 时使用你设置的值，且不打印）：

```bash
docker compose logs zhenji | grep "First-run setup code"    # Docker
podman logs zhenji | grep "First-run setup code"            # Podman
journalctl -u zhenji | grep "First-run setup code"          # systemd
```

打开页面，输入设置码并设置至少 10 位的密码。设置完成后该接口永久关闭；连续输错设置码或密码会被限流 15 分钟。

**忘记密码**：交互式生成新的密码哈希（不接受命令行参数，避免密码进入 shell 历史），把输出的 `APP_PASSWORD_HASH="scrypt:..."` 写入 `.env` 后重启。`.env` 中的哈希优先于数据库里的旧密码。密码变更后的首次启动会让所有设备的登录失效，需要用新密码重新登录。

```bash
docker compose exec -it zhenji npm run set-password    # 或 podman exec -it zhenji …，或直接 npm run set-password
```

---

## 6. 通过 HTTPS 访问

生产模式下会话 Cookie 带 `Secure` 属性，浏览器只会在 HTTPS 页面保存它。唯一的例外是本机：`http://localhost:端口` 与 `http://127.0.0.1:端口` 可以直接登录。用 `http://局域网IP:端口` 打开时密码正确也无法登录，登录页会说明原因。PWA 安装同样要求 HTTPS。

任选一种方式提供 HTTPS：

### Cloudflare Tunnel（自定义域名，无需公网 IP）

1. 在 [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels 创建隧道，复制 `TUNNEL_TOKEN`。
2. 在隧道的 Public Hostname 中添加映射：Service 选 `HTTP`，URL 填 `zhenji:3000`。
3. 在 `.env` 中加入 `TRUST_PROXY=1` 与 `TUNNEL_TOKEN=…`，然后带上 profile 启动：

```bash
docker compose --profile cloudflare up -d      # 或 podman compose --profile cloudflare up -d
```

### Tailscale Serve / Funnel

1. 在 [Tailscale 管理后台](https://login.tailscale.com/admin/settings/keys)生成 Auth Key，并开启 MagicDNS 与 HTTPS Certificates。
2. 在 `.env` 中加入 `TS_AUTHKEY=…`，启动并暴露服务：

```bash
docker compose --profile tailscale up -d
docker compose exec tailscale tailscale serve --bg http://127.0.0.1:3000     # 仅 tailnet 内访问
docker compose exec tailscale tailscale funnel --bg http://127.0.0.1:3000    # 需要公网访问时
```

`tailscale serve` 只能转发到本机地址，所以 compose 中的 `tailscale` 容器通过 `network_mode: service:zhenji` 与应用共用网络命名空间，目标地址写 `127.0.0.1:3000`（容器内端口，不是宿主机的 8080）。设备在 tailnet 中的名字由 `TS_HOSTNAME=zhenji` 决定。

### 自己的反向代理

Caddy、Nginx、Traefik 等终结 TLS 后转发到 `127.0.0.1:8080`（容器）或 `127.0.0.1:3000`（直接运行）即可。两点要求：

- 实时同步使用 Server-Sent Events（`/api/events`），代理不能缓冲该响应。服务端已发送 `X-Accel-Buffering: no`，Nginx 默认遵守；其他代理请关闭对该路径的缓冲与压缩。
- 只有当代理会**覆盖**（而不是追加）`X-Forwarded-For`、`X-Forwarded-Host` 时才设置 `TRUST_PROXY=1`。直接暴露端口时保持 `0`，否则客户端可以伪造这些头绕过登录限流。

---

## 7. 升级

数据库结构变更由服务在启动时自动迁移，迁移前会在 `data/backups/` 留下一份 `pre-migration` 快照。

```bash
git pull
docker compose up -d --build                                   # Docker（带 profile 时加上 --profile …）
podman build -t zhenji . && systemctl --user restart zhenji    # Podman + Quadlet
npm ci && npm run build && sudo systemctl restart zhenji       # 直接运行
```

不支持降级：旧版本遇到由新版本写入的数据库会拒绝启动而不是修改它。需要回退时，先恢复升级前的快照。

---

## 8. 备份、恢复与迁移

全部数据都在数据目录里：

```text
data/
  tracker.db                                    # 主数据库（SQLite，WAL 模式）
  backups/tracker-YYYY-MM-DD.db                 # 每日完整快照，保留最近 14 份
  backups/tracker-YYYY-MM-DD-HHmmss-pre-*.db    # 迁移或导入前的安全快照，保留最近 10 份
  exports/zhenji-YYYY-MM-DD.json                # 每日 JSON 全量导出，保留最近 14 份
```

**从数据库快照恢复**：停止服务，删除 `tracker.db-wal` 与 `tracker.db-shm`，把快照复制为 `tracker.db`，再启动。已打开的页面会自动加载恢复后的数据。

```bash
docker compose stop zhenji
rm -f data/tracker.db-wal data/tracker.db-shm
cp data/backups/tracker-2026-03-01.db data/tracker.db
docker compose start zhenji
```

**从 JSON 恢复**：在「设置 → 数据备份与迁移 → 导入数据 (JSON)」选择 `exports/` 里的文件。导入会替换全部数据，并先自动留一份 `pre-import` 快照。格式见[《数据格式说明》](./data-format.md)。

**迁移到另一台机器或另一种部署方式**：停止服务，把 `data/` 和 `.env` 复制过去，按对应小节启动。从 Docker 换到 Rootless Podman 时，记得按 [§3](#3-podman含-rootless) 重新处理数据目录的属主。

---

## 9. 排错

| 现象                                              | 原因与处理                                                                                                                                                                                                                                                                                                                                                       |
| :------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 启动即退出，日志提示 `DATA_DIR … is not writable` | 数据目录不属于容器内的 uid 1000。Docker：`sudo chown 1000:1000 data`；Rootless Podman：加 `--userns=keep-id:uid=1000,gid=1000`，或 `podman unshare chown 1000:1000 data`。                                                                                                                                                                                       |
| Podman 下 `Permission denied`，但属主正确         | SELinux 标签。给卷加 `:Z`。                                                                                                                                                                                                                                                                                                                                      |
| Podman 构建时报 `short-name … did not resolve`    | 使用了旧版 Dockerfile。当前版本的镜像名均为完整名称。                                                                                                                                                                                                                                                                                                            |
| 密码正确但登录后又回到登录页                      | 通过 `http://局域网IP` 访问，浏览器丢弃了 `Secure` Cookie。改用 HTTPS 或 `localhost`。                                                                                                                                                                                                                                                                           |
| 其他设备不实时更新                                | 反向代理缓冲了 `/api/events`。关闭对该路径的缓冲。                                                                                                                                                                                                                                                                                                               |
| 链接导入提示无法解析或被限制                      | 数据中心 IP 常被视频站点拦截，家庭宽带效果最好；需要登录的内容可用 `YTDLP_COOKIES_FILE` 指定自己的 Cookie 文件。使用 fake-ip 模式代理时，域名会解析到保留地址而被 SSRF 防护拒绝，请为相关域名改用真实 IP 解析；这项检查同样作用于 yt-dlp 发出的每一个请求（含跳转）。如果为服务进程设置了 `HTTPS_PROXY` / `ALL_PROXY`，yt-dlp 改走该代理，出站范围由该代理决定。 |
| 启动即退出，或导入备份时提示无法写入安全备份      | 升级数据库或导入前要先在 `data/backups` 留一份副本，写不进去就不会继续。检查磁盘剩余空间与该目录的权限后重试，原有数据不受影响。                                                                                                                                                                                                                                 |
| 启动日志提示数据库版本比当前版本新                | 运行的是旧版本代码。升级，或恢复旧版本留下的快照。                                                                                                                                                                                                                                                                                                               |

家用主机长期运行时，记得关闭自动休眠（`sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target`）。
