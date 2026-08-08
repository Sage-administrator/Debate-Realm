# ─── Stage 1: 构建 ───────────────────────────────────────────
    FROM node:22-alpine AS build

    WORKDIR /app

    # 缓存依赖层：先复制 package.json 和 lockfile
    COPY package.json package-lock.json ./
    RUN npm ci

    # 辅助工具（fix-nitro-output.mjs 依赖）
    COPY scripts/fix-nitro-output.mjs ./scripts/
    COPY prisma/schema.prisma ./prisma/schema.prisma
    COPY shared ./shared

    # 复制全部源码
    COPY . .

    # 生产构建：产物写入项目内 .build/ 目录，避免 /tmp 迂回
    ENV BUILD_IN_PLACE=true
    ENV NODE_ENV=production
    RUN npx prisma generate
    RUN npm run build
    RUN node scripts/fix-nitro-output.mjs

    # ─── Stage 2: 运行时 ───────────────────────────────────────
    FROM node:22-alpine AS runtime

    WORKDIR /app

    # 仅复制运行时必需的产物
    COPY --from=build /app/.build/output ./.output
    COPY --from=build /app/start.mjs ./

    # 原生模块（libSQL）—— fix-nitro-output 会复制进 .output，但保险起见直接挂
    # 在生产环境建议改用 PostgreSQL 以消除此依赖
    COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

    # 健康检查所用端口
    EXPOSE 3000

    # SQLite 数据持久化卷
    VOLUME ["/app/prisma/data"]

    # 生产启动
    ENV NODE_ENV=production
    CMD ["node", "start.mjs"]
