import { PrismaClient } from './generated/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

// 数据库连接 URL：优先使用环境变量，默认使用本地开发库
const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db'

const adapter = new PrismaLibSql({
  url: dbUrl,
})

// 慢查询阈值（毫秒）：超过此时间的查询会被记录警告日志
const SLOW_QUERY_THRESHOLD = 200

// Prisma 客户端配置：
// - 开发环境：打印 query/warn/error 日志，便于排查慢查询与 N+1 问题
// - 生产环境：仅打印 error 日志，避免日志量过大
const prisma = new PrismaClient({
  adapter,
  log:
    process.env.NODE_ENV === 'development'
      ? [{ level: 'query', emit: 'event' }, 'warn', 'error']
      : ['error'],
})

// 开发环境：启用慢查询监控
if (process.env.NODE_ENV === 'development') {
  // 监听查询事件，记录慢查询
  prisma.$on('query' as any, (e: any) => {
    const duration = e.duration as number
    if (duration > SLOW_QUERY_THRESHOLD) {
      console.warn(
        `[慢查询] ${duration}ms | ${e.query.substring(0, 120)}${e.query.length > 120 ? '...' : ''}`,
      )
    }
  })
}

export { prisma }

// 注意：BotArena.originalChannelName 列已在 schema.prisma 中定义，
// 通过 `npx prisma db push` 同步到 DB，不再需要在启动时运行时 ALTER TABLE。
// 之前的运行时 ALTER 是反模式（schema 与 DB 真相脱节，prisma generate 不识别），已移除。
