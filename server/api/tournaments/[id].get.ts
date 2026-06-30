import { prisma } from '../../lib/prisma'
import { requireReadTournament } from '../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!

    // 权限：系统管理员 或 该赛事所属团队的管理员 / 子账号
    // 注：这里我们只检查权限不直接使用返回值，后续依然走原来的查询
    await requireReadTournament(event, prisma, id)

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        team: true, teams: true, judges: true,
        matches: { orderBy: [{ round: 'asc' }, { orderNum: 'asc' }] },
      },
    })

    if (!tournament) throw createError({ statusCode: 404, statusMessage: '赛事不存在' })

    return {
      id: tournament.id, name: tournament.name, description: tournament.description,
      format: tournament.format, status: tournament.status,
      scheduledAt: tournament.scheduledAt, venue: tournament.venue,
      team: { id: tournament.team.id, name: tournament.team.name },
      teams: tournament.teams.map((t) => t.name),
      judges: tournament.judges.map((j) => j.name),
      // 赛程页面所需的扩展配置字段
      bestDebaterMode: tournament.bestDebaterMode,
      groupCount: tournament.groupCount,
      topicPool: tournament.topicPool,
      assignments: (tournament as any).assignments,
      matches: tournament.matches.map((m) => ({
        id: m.id, round: m.round, orderNum: m.orderNum,
        teamA: m.teamA, teamB: m.teamB, winner: m.winner,
        scoreA: m.scoreA, scoreB: m.scoreB, status: m.status, scheduledAt: m.scheduledAt,
        topic: (m as any).topic,
        affirmativeSide: (m as any).affirmativeSide,
        bestDebaterA: (m as any).bestDebaterA,
        bestDebaterB: (m as any).bestDebaterB,
        judge: (m as any).judge,
      })),
      createdAt: tournament.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get tournament error:', error)
    throw createError({ statusCode: 500, statusMessage: '获取赛事详情失败' })
  }
})
