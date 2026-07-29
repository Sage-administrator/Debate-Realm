import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 鉴权：仅 system_admin 可查看个人用户列表
    const user = await getUserFromEventWithSession(event, prisma)
    if (user.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

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

    return individualUsers.map((u) => ({
      id: u.id,
      username: u.username,
      createdAt: u.createdAt,
      standaloneMatchCount: u.standaloneMatches.length,
      standaloneMatches: u.standaloneMatches.map((m) => ({
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
    throw createError({ statusCode: 500, message: '获取个人用户数据失败' })
  }
})
