import { PrismaClient } from './generated/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

// 数据库连接 URL：优先使用环境变量，默认使用本地开发库
const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db'

const adapter = new PrismaLibSql({
  url: dbUrl,
})

// Prisma 客户端配置：
// - 开发环境：打印 query/warn/error 日志，便于排查慢查询与 N+1 问题
// - 生产环境：仅打印 error 日志，避免日志量过大
const prisma = new PrismaClient({
  adapter,
  log:
    process.env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['error'],
})

export { prisma }

// 启动时确保 BotArena 含 originalChannelName 列（记录语音子频道原名，赛场结束后还原）。
// 用 raw SQL 加列，避免依赖 `prisma generate` / 单独迁移步骤；列已存在则忽略报错。
prisma.$executeRawUnsafe('ALTER TABLE "BotArena" ADD COLUMN "originalChannelName" TEXT')
  .catch(() => { /* 列已存在，忽略 */ })
