// ════════════════════════════════════════════════════
// GET /api/internal/tournament/next-match — 获取下一场待比赛信息
// 请求参数：?teamId=xxx&internalKey=xxx
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getNextMatch, getMatchTopic } from '../../../lib/bot-data-sync'
import { verifyInternalKey } from '../../../utils/internal-auth'

export default defineEventHandler(async (event) => {
  try {
    await verifyInternalKey(event)
    const query = getQuery(event)
    const { teamId, matchId } = query

    // 如果指定了 matchId，返回该比赛的辩题
    if (matchId) {
      if (!teamId) {
        throw createError({ statusCode: 400, message: '缺少 teamId 参数' })
      }
      const result = await getMatchTopic(prisma, matchId as string)
      return result
    }

    if (!teamId) {
      throw createError({ statusCode: 400, message: '缺少 teamId 参数' })
    }

    const result = await getNextMatch(prisma, teamId as string)
    return result
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Internal Next Match] 获取失败:', error)
    throw createError({ statusCode: 500, message: '获取下一场比赛信息失败' })
  }
})
