// ════════════════════════════════════════════════════
// GET /api/tournaments/[id]/scores — 获取赛事评分详情
// 请求参数：?matchId=xxx（可选，指定比赛）&type=rankings（可选，获取排名）
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'
import { getMatchScores, getRankings, getTournamentScoreStats } from '../../../lib/bot-scoring'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)
    const tournamentId = getRouterParam(event, 'id')!

    // 权限校验：system_admin / 团队 admin / 团队 subaccount（只读） 可查看评分
    // 注意：系统不存在 'member' 角色，合法角色见 prisma/schema.prisma User.role 注释
    if (
      currentUser.role !== 'admin' &&
      currentUser.role !== 'system_admin' &&
      currentUser.role !== 'subaccount'
    ) {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const query = getQuery(event)
    const matchId = query.matchId as string
    const type = query.type as string

    // 按类型返回不同数据
    if (type === 'rankings') {
      const rankings = await getRankings(prisma, tournamentId)
      return { success: true, ...rankings }
    }

    if (type === 'stats') {
      const stats = await getTournamentScoreStats(prisma, tournamentId)
      return { success: true, ...stats }
    }

    if (matchId) {
      const scores = await getMatchScores(prisma, matchId)
      return { success: true, matchId, ...scores }
    }

    // 默认返回赛事评分统计
    const stats = await getTournamentScoreStats(prisma, tournamentId)
    return { success: true, ...stats }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Scores Get] 查询评分失败:', error)
    throw createError({ statusCode: 500, statusMessage: '查询评分失败' })
  }
})