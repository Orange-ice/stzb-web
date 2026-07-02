#!/bin/sh
set -e

echo "[entrypoint] 执行数据库迁移 prisma migrate deploy ..."
npx prisma migrate deploy

echo "[entrypoint] 启动 Next 服务 ..."
exec npm run start