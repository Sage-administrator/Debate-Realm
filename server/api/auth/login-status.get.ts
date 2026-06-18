// GET /api/auth/login-status — 获取当前用户所有活跃登录会话（用于前端多设备检测弹窗）
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const payload = await getUserFromEventWithSession(event, prisma)

    const sessions = await prisma.userLoginSession.findMany({
      where: { userId: payload.userId },
      orderBy: { loggedInAt: 'desc' },
      take: 20,
    })

    const activeSessions = sessions.filter((s) => s.isActive)

    // 当前会话（与 JWT 中的 sessionId 匹配的会话）
    const currentSession =
      activeSessions.find((s) => s.id === payload.sessionId) || null

    // 其他活跃会话（可能是其他设备同时在线）
    const otherSessions = activeSessions.filter(
      (s) => s.id !== payload.sessionId,
    )

    return {
      currentTokenVersion: payload.tokenVersion,
      currentSession: currentSession
        ? {
            id: currentSession.id,
            deviceInfo: currentSession.deviceInfo,
            ipAddress: currentSession.ipAddress,
            loggedInAt: currentSession.loggedInAt,
            lastSeenAt: currentSession.lastSeenAt,
          }
        : null,
      otherSessions: otherSessions.map((s) => ({
        id: s.id,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        loggedInAt: s.loggedInAt,
        lastSeenAt: s.lastSeenAt,
      })),
      historySessions: sessions
        .filter((s) => !s.isActive)
        .map((s) => ({
          id: s.id,
          deviceInfo: s.deviceInfo,
          ipAddress: s.ipAddress,
          loggedInAt: s.loggedInAt,
          loggedOutAt: s.loggedOutAt,
        })),
      totalActiveCount: activeSessions.length,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Login status error:', error)
    throw createError({ statusCode: 500, statusMessage: '获取登录状态失败' })
  }
})
