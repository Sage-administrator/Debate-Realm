// ════════════════════════════════════════════════════
// GET /api/internal/tournament/scores — 获取比赛评分详情
// 请求参数：?matchId=xxx&internalKey=xxx
// 由计时程序、Bot 后台等内部模块调用
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getMatchScores, getTournamentScoreStats } from '../../../lib/bot-scoring'
import { verifyInternalKey } from '../../../utils/internal-auth'

export default defineEventHandler(async (event) => {
  try {
    await verifyInternalKey(event)
    const query = getQuery(event)
    const { matchId, tournamentId, type } = query

    // 获取赛事评分统计
    if (type === 'stats' && tournamentId) {
      const stats = await getTournamentScoreStats(prisma, tournamentId as string)
      return {
        success: true,
        tournamentId,
        ...stats,
      }
    }

    // 获取指定比赛的评分详情
    if (!matchId) {
      throw createError({ statusCode: 400, message: '缺少 matchId 参数' })
    }

    const result = await getMatchScores(prisma, matchId as string)

    return {
      success: true,
      matchId,
      match: result.match,
      scores: result.scores,
      totalJudges: result.scores.length,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Internal Scores] 获取评分失败:', error)
    throw createError({ statusCode: 500, message: '获取比赛评分失败' })
  }
})