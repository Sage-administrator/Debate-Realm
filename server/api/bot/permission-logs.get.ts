// ════════════════════════════════════════════════════
// GET /api/bot/permission-logs — 查询权限操作日志
// 请求参数：?teamId=xxx&limit=50&action=ROUND_SWITCH_ALLOW
// ════════════════════════════════════════════════════
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import type { BotPermissionLog } from '../../lib/generated/client'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '仅团队管理员可查看权限日志' })
    }

    const query = getQuery(event)
    const teamId = (query.teamId as string) || currentUser.teamId
    const limit = Math.min(parseInt(query.limit as string) || 50, 200) // 最多 200 条
    const action = query.action as string | undefined
    const offset = parseInt(query.offset as string) || 0

    if (!teamId) {
      throw createError({ statusCode: 400, message: '缺少 teamId 参数' })
    }

    // 构建查询条件
    const where: any = { teamId }
    if (action) {
      where.action = action
    }

    // 查询日志
    const [logs, total] = await Promise.all([
      prisma.botPermissionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.botPermissionLog.count({ where }),
    ])

    return {
      success: true,
      total,
      limit,
      offset,
      logs: logs.map((log: BotPermissionLog) => ({
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetName: log.targetName,
        targetId: log.targetId,
        operator: log.operator,
        detail: log.detail,
        channelId: log.channelId,
        createdAt: log.createdAt,
      })),
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Permission Logs] 查询失败:', error)
    throw createError({ statusCode: 500, message: '查询权限日志失败' })
  }
})