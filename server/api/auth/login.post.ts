// POST /api/auth/login — 登录（严格限制多端登录：如检测到活跃会话则返回 needConfirm，需用户确认后踢掉原设备）
import { readBody, getHeader } from 'h3'
import { prisma } from '../../lib/prisma'
import { generateToken, comparePassword } from '../../lib/jwt'

/**
 * 从 User-Agent 解析设备信息（浏览器 + 操作系统）
 */
function formatDeviceInfo(userAgent: string | null | undefined): string {
  if (!userAgent) return '未知设备'
  const ua = userAgent.toLowerCase()
  let browser = '未知浏览器'
  let os = '未知系统'

  if (ua.includes('edg')) browser = 'Edge'
  else if (ua.includes('chrome')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari')) browser = 'Safari'
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera'

  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac')) os = 'macOS'
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('linux')) os = 'Linux'

  return `${browser} on ${os}`
}

export default defineEventHandler(async (event) => {
  try {
    const { username, password } = await readBody<{
      username: string; password: string
    }>(event)

    // 1. 参数校验
    if (!username || !password) {
      throw createError({ statusCode: 400, statusMessage: '用户名和密码不能为空' })
    }

    // 2. 用户存在性与密码校验
    const user = await prisma.user.findUnique({
      where: { username },
      include: { team: true },
    })

    if (!user) {
      throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
    }

    const isValid = await comparePassword(password, user.password)
    if (!isValid) {
      throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
    }

    // 3. 检测该账号当前是否有活跃会话（即是否已在其他设备登录）
    const activeSessions = await prisma.userLoginSession.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { loggedInAt: 'desc' },
      take: 5,
    })

    if (activeSessions.length > 0) {
      // ── 已有设备登录：返回 needConfirm，让用户决定是否踢掉原设备 ──
      const currentVersion = user.tokenVersion

      // 获取新设备信息（用于弹窗显示）
      const userAgent = getHeader(event, 'user-agent') || ''
      const ipAddress =
        getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
        getHeader(event, 'x-real-ip') ||
        '127.0.0.1'
      const newDeviceInfo = formatDeviceInfo(userAgent)

      // 返回已有活跃会话的信息 + 新设备信息
      return {
        needConfirm: true,
        userId: user.id,
        existingSessions: activeSessions.map((s) => ({
          id: s.id,
          deviceInfo: s.deviceInfo,
          ipAddress: s.ipAddress,
          loggedInAt: s.loggedInAt,
        })),
        newDevice: {
          deviceInfo: newDeviceInfo,
          ipAddress,
        },
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          mode: user.mode,
          team: user.team
            ? { id: user.team.id, name: user.team.name, mode: user.team.mode }
            : null,
        },
        tokenVersion: currentVersion,
      }
    }

    // ── 无活跃会话：正常创建会话并登录 ──
    const currentVersion = user.tokenVersion
    const userAgent = getHeader(event, 'user-agent') || ''
    const ipAddress =
      getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
      getHeader(event, 'x-real-ip') ||
      '127.0.0.1'
    const deviceInfo = formatDeviceInfo(userAgent)

    const session = await prisma.userLoginSession.create({
      data: {
        userId: user.id,
        tokenVersion: currentVersion,
        deviceInfo,
        ipAddress,
        userAgent,
        isActive: true,
        lastSeenAt: new Date(),
      },
    })

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      mode: user.mode,
      teamId: user.teamId,
      tokenVersion: currentVersion,
      sessionId: session.id,
    })

    return {
      token,
      sessionId: session.id,
      needConfirm: false,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        mode: user.mode,
        team: user.team
          ? { id: user.team.id, name: user.team.name, mode: user.team.mode }
          : null,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Login error:', error)
    throw createError({ statusCode: 500, statusMessage: '登录失败' })
  }
})
