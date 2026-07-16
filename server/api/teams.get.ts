import { prisma } from '../lib/prisma'
import { getUserFromEventWithSession } from '../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)

    // System admin sees all teams, team admin sees own team
    const where = user.role === 'system_admin' ? {} : { adminId: user.userId }

    const teams = await prisma.team.findMany({
      where,
      include: { _count: { select: { members: true, tournaments: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      mode: t.mode,
      memberCount: t._count.members,
      tournamentCount: t._count.tournaments,
      createdAt: t.createdAt,
    }))
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get teams error:', error)
    throw createError({ statusCode: 500, message: '获取团队列表失败' })
  }
})
