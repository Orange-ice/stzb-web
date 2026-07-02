# Web 部署文档（Docker Compose：Next.js + Postgres）

技术栈：**Next.js 16** + **Prisma 7**（`@prisma/adapter-pg`）+ **PostgreSQL**。
本方案用 **docker-compose** 同时编排「Next.js 应用」和「Postgres 数据库」，部署到 **Ubuntu** 服务器，
客户端（Wails 助手）通过 **公网 IP:端口** 访问，数据库 **全新空库** 起步（建表交给 Prisma 迁移）。

> 本次已确认的前提（写在最前面便于核对）：
> - 应用 + 数据库都跑在 Docker（整套 compose）。
> - 客户端用 `http://<服务器IP>:3000` 访问，不配域名 / HTTPS / Nginx。
> - 远程库从零开始，不迁移本地现有数据。
> - 服务器尚未安装 Docker。

---

## 〇、给方案之前，仍建议你确认这几件事

这些不影响主流程，但会影响安全和稳定，建议部署前过一遍：

1. **数据库密码**：生产务必用强密码，不要沿用本地的 `123456`（下面 `.env` 里设置）。
2. **对外端口**：默认对公网开放 `3000`。公网 IP + 明文 HTTP 意味着任何人知道地址都能调用同步接口——
   当前 Web 端 API **没有鉴权**。若服务器有公网 IP，建议至少用防火墙限制来源 IP，或后续加一层访问令牌。
3. **服务器内存**：`next build` 比较吃内存，**建议 ≥ 2GB**。若只有 1GB，需要先加 Swap（文末附命令），否则构建会 OOM。
4. **备份**：数据只在服务器，建议定期 `pg_dump`（文末附命令 / 定时任务思路）。
5. **时区**：容器默认 UTC，数据库存的是 UTC 时间，前端展示按本地时区格式化即可；如需容器内本地时间可加 `TZ` 环境变量。
6. **Postgres 端口**：本方案 **不对外暴露 5432**，数据库仅在 compose 内网被 app 访问，更安全。

---

## 一、服务器安装 Docker（Ubuntu，从零开始）

```bash
# 1. 安装依赖并添加 Docker 官方源
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 2. 安装 Docker Engine + Compose 插件
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 3. 验证
sudo docker version
sudo docker compose version

# 4.（可选）让当前用户免 sudo 使用 docker，需重新登录生效
sudo usermod -aG docker $USER
```

> 如果服务器在国内拉取镜像慢，可给 Docker 配置镜像加速器（`/etc/docker/daemon.json` 里加 `registry-mirrors`），再 `sudo systemctl restart docker`。

---

## 二、准备项目文件

把 `web` 目录上传到服务器，例如 `/opt/stzb-web`（用 git clone 或 scp/rsync 均可）。
**不要上传 `node_modules` 和 `.next`**，构建在容器内完成。

在 `web` 目录下需要新增以下 4 个文件（内容见本节）：`Dockerfile`、`docker-entrypoint.sh`、`docker-compose.yml`、`.dockerignore`，以及一个部署用 `.env`。

### 1. `Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1

# ---------- 构建阶段 ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# Prisma 引擎依赖 openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 构建期需要一个占位 DATABASE_URL（prisma.ts 在模块加载时会读取它，但不会真正连库）
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"
RUN npx prisma generate
RUN npm run build

# ---------- 运行阶段 ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
# 仅安装生产依赖（含 next / prisma / @prisma/client / @prisma/adapter-pg / dotenv）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Prisma：schema + 迁移文件 + 配置，并重新生成 client
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"
RUN npx prisma generate
# Next 构建产物
COPY --from=builder /app/.next ./.next
COPY public ./public
COPY next.config.ts ./
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
```

### 2. `docker-entrypoint.sh`

容器启动时：先跑迁移建表（幂等，已建过不会重复），再启动服务。

```sh
#!/bin/sh
set -e

echo "[entrypoint] 执行数据库迁移 prisma migrate deploy ..."
npx prisma migrate deploy

echo "[entrypoint] 启动 Next 服务 ..."
exec npm run start
```

> 注意：在 Windows 上创建此文件后，换行符需为 LF（不要 CRLF），否则容器内 `sh` 会报错。

### 3. `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16
    container_name: stzb-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    # 仅容器内网络可访问，不对外暴露 5432
    expose:
      - "5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: stzb-web
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      # app 通过 compose 内网用服务名 db 连库（覆盖仓库里 .env 的 localhost）
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
      NODE_ENV: production
      PORT: "3000"
    ports:
      - "${APP_PORT:-3000}:3000"

volumes:
  pgdata:
```

### 4. `.dockerignore`

```
node_modules
.next
.git
.env
npm-debug.log*
Dockerfile
docker-compose.yml
deploy.md
```

> 把仓库里的 `.env`（本地 localhost 配置）排除在镜像外，避免本地配置污染镜像；运行时连接串由 compose 注入。

### 5. 部署用 `.env`（与 docker-compose.yml 同目录，compose 自动读取）

```bash
# /opt/stzb-web/.env  —— 用于 docker-compose 变量替换
POSTGRES_USER=admin
POSTGRES_PASSWORD=请改成强密码
POSTGRES_DB=stzb_web
# 对外端口（客户端访问的端口），可改成别的
APP_PORT=3000
```

> 这个 `.env` 给的是 **compose 变量**（数据库账号/端口）。它和仓库里 Next 用的 `web/.env`（被 `.dockerignore` 排除）互不冲突——
> app 容器真正用的 `DATABASE_URL` 在 compose 的 `environment:` 里拼好了。

---

## 三、构建并启动

```bash
cd /opt/stzb-web

# 构建镜像并后台启动（首次会拉取 postgres 镜像 + 构建 app，耗时数分钟）
docker compose up -d --build

# 查看状态（db 应为 healthy，app 为 running）
docker compose ps

# 看 app 日志，确认迁移执行成功、服务已启动
docker compose logs -f app
```

启动过程：`db` 起来并通过健康检查 → `app` 启动 → entrypoint 执行 `prisma migrate deploy` 建表 → `next start` 监听 3000。

---

## 四、验证

```bash
# 服务器本机自测
curl -i http://localhost:3000

# 确认表已建好（应能看到 Season、SeasonMember 等表）
docker compose exec db psql -U admin -d stzb_web -c '\dt'
```

放行防火墙端口（若启用了 ufw）：

```bash
sudo ufw allow 3000/tcp
# 更安全的做法：只放行你客户端的出口 IP
# sudo ufw allow from <你的IP> to any port 3000 proto tcp
```

然后在 **Wails 助手 → 控制面板 → Web 同步服务器** 里新增一条：
`http://<服务器公网IP>:3000`，设为当前，即可在攻城任务 / 队伍查询 / 队伍胜率 / 同盟成员页同步。

---

## 五、日常运维

### 更新代码并重新部署

```bash
cd /opt/stzb-web
git pull            # 或重新 rsync 代码
docker compose up -d --build app   # 重建并滚动重启 app；db 不受影响
```

> 应用每次启动都会自动执行 `prisma migrate deploy`，所以有新迁移时无需额外操作。

### 常用命令

```bash
docker compose ps                 # 状态
docker compose logs -f app        # 应用日志
docker compose restart app        # 重启应用
docker compose down               # 停止并移除容器（数据卷 pgdata 保留）
docker compose down -v            # ⚠ 连数据卷一起删除（会清空数据库！）
```

### 备份与恢复数据库

```bash
# 备份（导出到宿主机当前目录）
docker compose exec -T db pg_dump -U admin -Fc stzb_web > stzb_web_$(date +%F).dump

# 恢复（先确保库为空或可覆盖）
cat stzb_web_2026-06-30.dump | docker compose exec -T db pg_restore -U admin -d stzb_web --clean --if-exists
```

可加一条 crontab 每天备份：

```bash
# crontab -e
0 4 * * * cd /opt/stzb-web && docker compose exec -T db pg_dump -U admin -Fc stzb_web > /opt/backups/stzb_web_$(date +\%F).dump
```

---

## 六、附录

### 内存不足时加 Swap（服务器 < 2GB 时构建容易 OOM）

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 速查清单

| 步骤 | 命令要点 |
|------|----------|
| 装 Docker | Docker 官方源 → `docker-ce` + `docker-compose-plugin` |
| 上传代码 | `web/` → `/opt/stzb-web`（排除 node_modules/.next） |
| 新增文件 | Dockerfile / docker-entrypoint.sh / docker-compose.yml / .dockerignore / .env |
| 起服务 | `docker compose up -d --build` |
| 建表 | 由 app 容器 entrypoint 自动 `prisma migrate deploy` |
| 验证 | `curl localhost:3000`、`psql ... \dt` |
| 放行端口 | `ufw allow 3000/tcp` |
| 客户端接入 | 控制面板新增 `http://<IP>:3000` 并设为当前 |
| 更新 | `git pull && docker compose up -d --build app` |
| 备份 | `docker compose exec -T db pg_dump -U admin -Fc stzb_web > x.dump` |
