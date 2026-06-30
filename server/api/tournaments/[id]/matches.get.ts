import { prisma } from '../../../lib/prisma'
import { requireReadTournament } from '../../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!

    // 权限：系统管理员 或 该赛事所属团队的管理员 / 子账号
    await requireReadTournament(event, prisma, id)

    const matches = await prisma.match.findMany({
      where: { tournamentId: id, deletedAt: null },
      orderBy: [{ round: 'asc' }, { orderNum: 'asc' }],
    })

    return matches.map((m) => ({
      id: m.id, round: m.round, orderNum: m.orderNum,
      teamA: m.teamA, teamB: m.teamB, winner: m.winner,
      scoreA: m.scoreA, scoreB: m.scoreB, status: m.status,
      scheduledAt: m.scheduledAt, topic: m.topic,
      affirmativeSide: m.affirmativeSide,
      bestDebaterA: m.bestDebaterA, bestDebaterB: m.bestDebaterB,
      judge: m.judge, deletedAt: m.deletedAt, version: m.version,
      promotedFromA: m.promotedFromA, promotedFromB: m.promotedFromB,
      isBye: m.isBye,
    }))
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get matches error:', error)
    throw createError({ statusCode: 500, statusMessage: '获取场次列表失败' })
  }
})
