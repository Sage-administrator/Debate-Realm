import { prisma } from '../../../lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const teamId = getRouterParam(event, 'teamId')!

    const tournaments = await prisma.tournament.findMany({
      where: { teamId },
      include: {
        teams: true, judges: true,
        _count: { select: { matches: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return tournaments.map((t) => ({
      id: t.id, name: t.name, description: t.description,
      format: t.format, status: t.status, scheduledAt: t.scheduledAt, venue: t.venue,
      teams: t.teams.map((team) => team.name),
      judges: t.judges.map((judge) => judge.name),
      matchCount: t._count.matches, createdAt: t.createdAt,
    }))
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get tournaments error:', error)
    throw createError({ statusCode: 500, message: '获取赛事列表失败' })
  }
})
