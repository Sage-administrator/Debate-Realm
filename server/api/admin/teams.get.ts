import { prisma } from '../../lib/prisma'
import { requireRole } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    requireRole(event, 'system_admin')

    const teams = await prisma.team.findMany({
      include: {
        members: true,
        _count: {
          select: { tournaments: true },
        },
      },
    })

    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      mode: team.mode,
      memberCount: team.members.length,
      tournamentCount: team._count.tournaments,
      createdAt: team.createdAt,
    }))
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get teams error:', error)
    throw createError({ statusCode: 500, message: '获取团队列表失败' })
  }
})
