import { prisma } from '../../../lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!

    const matches = await prisma.match.findMany({
      where: { tournamentId: id },
      orderBy: [{ round: 'asc' }, { orderNum: 'asc' }],
    })

    return matches.map((m) => ({
      id: m.id, round: m.round, orderNum: m.orderNum,
      teamA: m.teamA, teamB: m.teamB, winner: m.winner,
      scoreA: m.scoreA, scoreB: m.scoreB, status: m.status, scheduledAt: m.scheduledAt,
    }))
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get matches error:', error)
    throw createError({ statusCode: 500, statusMessage: '获取场次列表失败' })
  }
})
