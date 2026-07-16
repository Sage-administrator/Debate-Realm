// POST /api/auth/login — 登录（严格限制多端登录：如检测到活跃会话则返回 needConfirm，需用户确认后踢掉原设备）
import { readBody, setCookie, getHeader } from 'h3'
import { prisma } from '../../lib/prisma'
import { generateToken, comparePassword } from '../../lib/jwt'
import { formatDeviceInfo, getClientIp } from '../../utils/common'

// Cookie 配置（与客户端 useAuthCookie.ts 保持一致）
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7天
const TOKEN_COOKIE = 'auth_token'
const USER_COOKIE = 'auth_user'

export default defineEventHandler(async (event) => {
  try {
    const { username, password } = await readBody<{
      username: string; password: string
    }>(event)

    // 1. 参数校验
    if (!username || !password) {
      throw createError({ statusCode: 400, message: '用户名和密码不能为空' })
    }

    // 2. 用户存在性与密码校验
    const user = await prisma.user.findUnique({
      where: { username },
      include: { team: true },
    })

    if (!user) {
      throw createError({ statusCode: 401, message: '用户名或密码错误' })
    }

    const isValid = await comparePassword(password, user.password)
    if (!isValid) {
      throw createError({ statusCode: 401, message: '用户名或密码错误' })
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
      const ipAddress = getClientIp(event)
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
          nickname: user.nickname,
          email: user.email,
          avatar: user.avatar,
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
    const ipAddress = getClientIp(event)
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

    const userInfo = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      mode: user.mode,
      team: user.team
        ? { id: user.team.id, name: user.team.name, mode: user.team.mode }
        : null,
    }

    // 通过 Set-Cookie 头设置认证 Cookie，确保 SSR 阶段能读取到登录状态
    // 这样刷新页面时服务端就能知道用户已登录，不会误跳转登录页
    const isProduction = process.env.NODE_ENV === 'production'
    setCookie(event, TOKEN_COOKIE, token, {
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      httpOnly: false, // 客户端需要读取 token 用于 API 调用的 Authorization header
      secure: isProduction,
      sameSite: 'lax',
    })
    setCookie(event, USER_COOKIE, JSON.stringify(userInfo), {
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
    })

    return {
      token,
      sessionId: session.id,
      needConfirm: false,
      user: userInfo,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Login error:', error)
    throw createError({ statusCode: 500, message: '登录失败' })
  }
})
