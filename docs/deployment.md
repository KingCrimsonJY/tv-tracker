# 部署指南（Linux + Docker Compose）

本文档介绍如何在个人 Linux 主机（家用 PC、迷你主机、NAS 或云服务器 VPS）上通过 Docker Compose 部署 **帧迹 (Zhenji)**，并通过内网穿透隧道（Cloudflare Tunnel 或 Tailscale Funnel）在手机、平板与电脑上随时随地安全访问。

---

## 1. 在 Linux 上安装 Docker 与 Docker Compose

以 Ubuntu / Debian 为例，使用 Docker 官方脚本或 APT 仓库安装 Docker Engine 与 Compose 插件：

```bash
# 1. 安装基础依赖并运行官方安装脚本
curl -fsSL https://get.docker.com | sh

# 2. 将当前用户加入 docker 用户组（重新登录后生效，免 sudo 运行 docker）
sudo usermod -aG docker "$USER"

# 3. 启动并设置 Docker 开机自启
sudo systemctl enable --now docker

# 4. 验证安装版本
docker --version
docker compose version
```

---

## 2. 克隆代码与配置环境变量

```bash
git clone https://github.com/KingCrimsonJY/tv-tracker.git
cd tv-tracker
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API 密钥（所有密钥仅保存在服务端，绝不会暴露给浏览器）：

```dotenv
# TMDB v4 Read Access Token（必填，用于搜索影视、剧集分季与中英双语元数据）
TMDB_READ_TOKEN=eyJhbGciOiJIUzI1NiJ9...

# OMDb API Key（可选，用于获取 IMDb、烂番茄、Metacritic 评分）
OMDB_API_KEY=your_omdb_api_key

# 容器内固定挂载在 /data，宿主机对应 ./data
DATA_DIR=./data

# 若通过 Cloudflare Tunnel 或会覆盖转发头的反向代理访问，设为 1 以读取真实客户端 IP 进行登录限流。
# 直接暴露端口时请保持 0，否则客户端可以伪造这些请求头。
TRUST_PROXY=1
```

---

## 3. 首次启动与获取一次性设置码

在首次运行 `docker compose up` 之前，请先在宿主机创建 `./data` 目录并将其归属设为容器内的 `node` 用户（`uid 1000`），避免 Docker 自动以 `root` 权限创建该目录导致容器无法写入：

```bash
mkdir -p data && sudo chown 1000:1000 data
docker compose up -d --build
```

首次启动且尚未设置密码时，服务端会自动生成随机的**一次性设置码 (Setup Code)** 并打印到容器日志中。运行以下命令查看：

```bash
docker compose logs zhenji | grep "First-run setup code"
```

输出示例：

```text
zhenji  | [Auth] First-run setup code: X7k9Pq2mR4vL
```

> 你也可以在首次启动前在 `.env` 中预设 `SETUP_CODE=你的自定义设置码`。打开网页后输入该设置码并设置至少 10 位的访问密码，初始化完成后设置接口将永久锁定关闭。

---

## 4. 配置安全外网访问（二选一）

由于应用使用 `HttpOnly` 会话 Cookie、Web Crypto 与 PWA Service Worker，**必须通过 HTTPS 域名访问**。推荐使用以下任一零公网 IP 方案：

### 方案 A：Cloudflare Tunnel（推荐，支持自定义域名）

1. 登录 [Cloudflare Zero Trust 控制台](https://one.dash.cloudflare.com/)，进入 **Networks → Tunnels**。
2. 点击 **Create a tunnel**，选择 **Cloudflared**，命名为 `zhenji`，复制生成的 `TUNNEL_TOKEN`。
3. 在 Tunnel 的 **Public Hostname** 页面添加一条映射：
   - **Subdomain + Domain**：例如 `watch.example.com`
   - **Service Type**：`HTTP`
   - **URL**：`zhenji:3000`
4. 在 `.env` 文件中添加：
   ```dotenv
   TRUST_PROXY=1
   TUNNEL_TOKEN=eyJhIjoi...
   ```
5. 使用 `cloudflare` profile 启动服务：
   ```bash
   docker compose --profile cloudflare up -d
   ```

### 方案 B：Tailscale Funnel / Tailscale 组网

1. 登录 [Tailscale 管理控制台](https://login.tailscale.com/admin/settings/keys)，生成用于容器的 `Auth Key`（勾选 Reusable），并在 DNS 页面开启 **MagicDNS** 与 **HTTPS Certificates**。
2. 在 `.env` 文件中添加：
   ```dotenv
   TS_AUTHKEY=tskey-auth-...
   ```
3. 使用 `tailscale` profile 启动：
   ```bash
   docker compose --profile tailscale up -d
   ```
4. 将容器内端口通过 Tailscale Serve / Funnel 暴露为 HTTPS：
   ```bash
   docker compose exec tailscale tailscale serve --bg http://zhenji:3000
   # 如需公网免客户端访问，可执行：
   docker compose exec tailscale tailscale funnel --bg http://zhenji:3000
   ```

---

## 5. 日常更新版本

当仓库发布新版本时，只需拉取代码并重新构建镜像，所有数据都保存在 `./data` 目录中，并会在数据库迁移前自动创建安全备份：

```bash
git pull
docker compose up -d --build
```

如果你启用了 `cloudflare` 或 `tailscale` profile：

```bash
git pull
docker compose --profile cloudflare up -d --build
```

---

## 6. 数据备份与恢复

所有持久化数据全部位于 `./data` 文件夹内：

```text
data/
  tracker.db                                    # 主 SQLite 数据库 (WAL 模式)
  backups/tracker-YYYY-MM-DD.db                 # 每日自动 VACUUM INTO 完整快照（保留最新 14 份）
  backups/tracker-YYYY-MM-DD-HHmmss-pre-*.db    # 迁移与导入前的自动安全快照（保留最新 10 份）
  exports/zhenji-YYYY-MM-DD.json                # 每日自动 JSON 全量导出（保留最新 14 份）
```

### 从 SQLite 备份文件恢复

1. 停止容器以释放数据库文件锁：
   ```bash
   docker compose stop zhenji
   ```
2. 移除旧的 WAL 临时文件并将指定日期的备份复制为 `tracker.db`：
   ```bash
   rm -f ./data/tracker.db-wal ./data/tracker.db-shm
   cp ./data/backups/tracker-2026-03-01.db ./data/tracker.db
   ```
3. 重新启动容器（服务端重启后会生成新的进程 `epoch`，所有已打开的客户端会自动拉取恢复后的快照）：
   ```bash
   docker compose start zhenji
   ```

### 从 JSON 导出文件恢复

你也可以直接在应用的 **设置 → 数据备份与迁移 → 导入数据 (JSON)** 中选择 `./data/exports/zhenji-YYYY-MM-DD.json` 文件在线恢复（导入前系统会自动生成一份 `pre-import` 数据库快照）。

---

## 7. 迁移到另一台机器（如从家用 PC 迁移到 VPS）

得益于单目录便携架构，迁移完全不需要导出 SQL 或重新配置数据库：

1. 在旧机器上停止服务并打包 `./data` 与 `.env`：
   ```bash
   docker compose down
   tar -czf zhenji-migration.tar.gz data/ .env
   ```
2. 将压缩包传输到新机器，解压到代码目录下：
   ```bash
   scp zhenji-migration.tar.gz user@new-server:~/tv-tracker/
   # 在新机器上：
   cd ~/tv-tracker
   tar -xzf zhenji-migration.tar.gz
   docker compose up -d --build
   ```

---

## 8. 重置忘记的访问密码

如果忘记了登录密码，可在容器内交互式运行密码哈希生成工具（为防止密码残留在 Shell 历史记录中，该工具不接受命令行参数，而是会以隐藏输入方式提示你输入两次新密码，且长度至少 10 位）：

```bash
# 在容器内交互式生成密码哈希
docker compose exec -it zhenji npm run set-password
```

按提示输入两次新密码后，工具会输出一行 `APP_PASSWORD_HASH="scrypt:..."`：

1. 将该行复制到宿主机 `.env` 文件中（当 `.env` 中设置了 `APP_PASSWORD_HASH` 时，优先级高于数据库内的旧密码哈希）。
2. 重启容器使其生效：
   ```bash
   docker compose up -d
   ```

---

## 9. 防止家用 Linux PC 休眠导致断联

如果你将帧迹部署在家用 Linux 台式机或盒盖运行的笔记本电脑上，建议禁用系统自动休眠以确保隧道全天在线：

```bash
# 禁用系统休眠与挂起目标
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

如果是笔记本电脑且需要盒盖运行，编辑 `/etc/systemd/logind.conf`，取消注释并修改以下两项：

```ini
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
```

保存后重启 `systemd-logind` 服务：

```bash
sudo systemctl restart systemd-logind
```
