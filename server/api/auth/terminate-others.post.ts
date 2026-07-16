// POST /api/auth/terminate-others — 强制下线其他设备（递增 tokenVersion 使旧 JWT 失效，返回新的 token）
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import { generateToken } from '../../lib/jwt'

export default defineEventHandler(async (event) => {
  try {
    const payload = await getUserFromEventWithSession(event, prisma)

    // 1. 递增 tokenVersion — 使其他所有设备的 JWT 立即失效
    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: { tokenVersion: { increment: 1 } },
    })

    const newVersion = updatedUser.tokenVersion

    // 2. 将除当前会话之外的所有活跃会话标记为失效
    await prisma.userLoginSession.updateMany({
      where: {
        userId: payload.userId,
        isActive: true,
        id: { not: payload.sessionId },
      },
      data: { isActive: false, loggedOutAt: new Date() },
    })

    // 3. 为当前会话更新 tokenVersion（或直接创建一个新的）
    // 先尝试更新当前会话的 tokenVersion
    await prisma.userLoginSession.update({
      where: { id: payload.sessionId, userId: payload.userId },
      data: {
        tokenVersion: newVersion,
        lastSeenAt: new Date(),
      },
    })

    // 4. 生成新的 JWT
    const newToken = generateToken({
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      mode: payload.mode,
      teamId: payload.teamId,
      tokenVersion: newVersion,
      sessionId: payload.sessionId,
    })

    return {
      success: true,
      token: newToken,
      message: '已强制下线其他设备',
      tokenVersion: newVersion,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Terminate session error:', error)
    throw createError({ statusCode: 500, message: '强制下线操作失败' })
  }
})
