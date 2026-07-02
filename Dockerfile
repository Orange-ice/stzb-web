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