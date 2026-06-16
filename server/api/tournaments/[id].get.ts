import { prisma } from '../../lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!

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
      matches: tournament.matches.map((m) => ({
        id: m.id, round: m.round, orderNum: m.orderNum,
        teamA: m.teamA, teamB: m.teamB, winner: m.winner,
        scoreA: m.scoreA, scoreB: m.scoreB, status: m.status, scheduledAt: m.scheduledAt,
      })),
      createdAt: tournament.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get tournament error:', error)
    throw createError({ statusCode: 500, statusMessage: '获取赛事详情失败' })
  }
})
