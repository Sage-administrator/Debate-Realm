// ════════════════════════════════════════════════════
// GET /api/internal/tournament/rankings — 获取赛事排名
// 请求参数：?teamId=xxx&internalKey=xxx
// 由计时程序、Bot 后台等内部模块调用
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getRankings, formatRankingsText } from '../../../lib/bot-scoring'
import { verifyInternalKey } from '../../../utils/internal-auth'

export default defineEventHandler(async (event) => {
  try {
    await verifyInternalKey(event)
    const query = getQuery(event)
    const { teamId, format } = query

    if (!teamId) {
      throw createError({ statusCode: 400, message: '缺少 teamId 参数' })
    }

    // 查找团队活跃赛事
    const tournament = await prisma.tournament.findFirst({
      where: {
        teamId: teamId as string,
        status: { in: ['pending', 'active', 'in_progress'] },
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!tournament) {
      return { success: false, message: '当前没有进行中的赛事', rankings: [] }
    }

    const result = await getRankings(prisma, tournament.id)

    // 如果请求文本格式（用于 Bot 消息），返回格式化文本
    if (format === 'text' && result.rankings.length > 0) {
      return {
        success: true,
        tournamentName: result.tournamentName,
        rankings: result.rankings,
        text: formatRankingsText(result.rankings, result.tournamentName),
      }
    }

    return {
      success: true,
      tournamentName: result.tournamentName,
      rankings: result.rankings,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Internal Rankings] 获取排名失败:', error)
    throw createError({ statusCode: 500, message: '获取赛事排名失败' })
  }
})
