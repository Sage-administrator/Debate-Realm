import { prisma } from '../../lib/prisma'
import { requireRole } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    requireRole(event, 'system_admin')

    const users = await prisma.user.findMany({
      include: { team: true },
    })

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      mode: user.mode,
      team: user.team
        ? { id: user.team.id, name: user.team.name }
        : null,
      createdAt: user.createdAt,
    }))
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get users error:', error)
    throw createError({ statusCode: 500, statusMessage: '获取用户列表失败' })
  }
})
