import { prisma } from '../lib/prisma'
import { getUserFromEvent } from '../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    if (user.mode !== 'individual') throw createError({ statusCode: 403, statusMessage: '只有个人用户可以访问独立赛事' })

    const matches = await prisma.standaloneMatch.findMany({
      where: { userId: user.userId },
      include: { _count: { select: { matches: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return matches.map((m) => ({
      id: m.id, name: m.name, description: m.description,
      status: m.status, scheduledAt: m.scheduledAt,
      matchCount: m._count.matches, createdAt: m.createdAt,
    }))
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get standalone matches error:', error)
    throw createError({ statusCode: 500, statusMessage: '获取独立赛事列表失败' })
  }
})
