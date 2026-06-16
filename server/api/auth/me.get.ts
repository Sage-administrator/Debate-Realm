import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      include: { team: true },
    })

    if (!dbUser) {
      throw createError({ statusCode: 404, statusMessage: '用户不存在' })
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      mode: dbUser.mode,
      team: dbUser.team
        ? {
            id: dbUser.team.id,
            name: dbUser.team.name,
            mode: dbUser.team.mode,
          }
        : null,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get user error:', error)
    throw createError({ statusCode: 500, statusMessage: '获取用户信息失败' })
  }
})
