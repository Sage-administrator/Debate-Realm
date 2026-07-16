// GET /api/auth/me — 获取当前用户信息（含单设备登录 session 校验）
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 使用带 session 校验的认证（tokenVersion 不匹配 → 401 被踢下线）
    const user = await getUserFromEventWithSession(event, prisma)

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      include: { team: true },
    })

    if (!dbUser) {
      throw createError({ statusCode: 404, message: '用户不存在' })
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      nickname: dbUser.nickname,
      email: dbUser.email,
      avatar: dbUser.avatar,
      role: dbUser.role,
      mode: dbUser.mode,
      team: dbUser.team
        ? { id: dbUser.team.id, name: dbUser.team.name, mode: dbUser.team.mode }
        : null,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get user error:', error)
    throw createError({ statusCode: 500, message: '获取用户信息失败' })
  }
})
