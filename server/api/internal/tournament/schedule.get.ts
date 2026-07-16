// ════════════════════════════════════════════════════
// GET /api/internal/tournament/schedule — 获取赛程列表
// 请求参数：?teamId=xxx&status=pending&limit=20&internalKey=xxx
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getSchedule } from '../../../lib/bot-data-sync'
import { verifyInternalKey } from '../../../utils/internal-auth'

export default defineEventHandler(async (event) => {
  try {
    await verifyInternalKey(event)
    const query = getQuery(event)
    const { teamId, status, limit } = query

    if (!teamId) {
      throw createError({ statusCode: 400, message: '缺少 teamId 参数' })
    }

    const result = await getSchedule(
      prisma,
      teamId as string,
      (status as string) || 'all',
      parseInt(limit as string) || 20,
    )

    return {
      success: true,
      ...result,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Internal Schedule] 获取赛程失败:', error)
    throw createError({ statusCode: 500, message: '获取赛程失败' })
  }
})