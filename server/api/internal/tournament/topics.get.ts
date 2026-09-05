// ════════════════════════════════════════════════════
// GET /api/internal/tournament/topics — 获取辩题库
// 请求参数：?teamId=xxx&internalKey=xxx
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getTopicPool } from '../../../lib/bot-data-sync'
import { verifyInternalKey } from '../../../utils/internal-auth'

export default defineEventHandler(async (event) => {
  try {
    await verifyInternalKey(event)
    const query = getQuery(event)
    const { teamId } = query

    if (!teamId) {
      throw createError({ statusCode: 400, message: '缺少 teamId 参数' })
    }

    const result = await getTopicPool(prisma, teamId as string)

    return {
      success: true,
      ...result,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Internal Topics] 获取辩题失败:', error)
    throw createError({ statusCode: 500, message: '获取辩题失败' })
  }
})
