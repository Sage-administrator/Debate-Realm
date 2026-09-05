import { prisma } from '../../../lib/prisma'
import { requireReadTournament } from '../../../utils/tournament-auth'
import { parseTopics, computeVoteStats } from '../../../utils/topic-vote'

// 管理端：获取某赛事下的全部辩题投票列表（含每条统计摘要）
// 支持按 status（draft/open/closed）与 matchId 筛选
export default defineEventHandler(async (event) => {
  try {
    // 1. 解析赛事 ID 并鉴权（读权限即可查看）
    const id = getRouterParam(event, 'id') as string
    await requireReadTournament(event, prisma, id)

    // 2. 解析可选筛选参数
    const query = getQuery(event)
    const status = typeof query.status === 'string' ? query.status : undefined
    const matchId = typeof query.matchId === 'string' ? query.matchId : undefined

    // 3. 构建查询条件
    const where: { tournamentId: string; status?: string; matchId?: string } = { tournamentId: id }
    if (status) where.status = status
    // 特殊处理：matchId=none 表示仅赛事级（matchId 为 null）
    if (matchId === 'none') {
      // SQLite 不支持直接 where matchId = null 的字符串传递，需用 null
    } else if (matchId) {
      where.matchId = matchId
    }

    // 4. 查询投票列表，包含记录用于统计
    const votes = await prisma.topicVote.findMany({
      where,
      include: { records: true, match: true },
      orderBy: { createdAt: 'desc' },
    })

    // 5. 为每条投票附加统计摘要
    return votes
      .map((v) => {
        const topics = parseTopics(v.topics)
        const stats = computeVoteStats(topics, v.records)
        // 过滤掉 matchId=none 的情况（在 JS 层处理 null 筛选）
        return {
          id: v.id,
          tournamentId: v.tournamentId,
          matchId: v.matchId,
          match: v.match
            ? { id: v.match.id, round: v.match.round, teamA: v.match.teamA, teamB: v.match.teamB }
            : null,
          title: v.title,
          description: v.description,
          topics,
          status: v.status,
          allowedVoters: v.allowedVoters,
          multipleChoice: v.multipleChoice,
          deadline: v.deadline,
          showResults: v.showResults,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          totalVotes: stats.total,
        }
      })
      .filter((v) => {
        // JS 层过滤赛事级投票（matchId === none 时仅返回 matchId 为 null 的）
        if (matchId === 'none') return v.matchId === null
        return true
      })
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('List topic votes error:', error)
    throw createError({ statusCode: 500, message: '获取辩题投票列表失败' })
  }
})
