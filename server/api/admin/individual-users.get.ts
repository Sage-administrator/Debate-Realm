import { prisma } from '../../lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    // 获取所有个人用户
    const individualUsers = await prisma.user.findMany({
      where: { role: 'individual', mode: 'individual' },
      include: {
        standaloneMatches: {
          include: { _count: { select: { matches: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return individualUsers.map((user) => ({
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      standaloneMatchCount: user.standaloneMatches.length,
      standaloneMatches: user.standaloneMatches.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        status: m.status,
        scheduledAt: m.scheduledAt,
        matchCount: m._count.matches,
        createdAt: m.createdAt,
      })),
    }))
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get individual users error:', error)
    throw createError({ statusCode: 500, statusMessage: '获取个人用户数据失败' })
  }
})
