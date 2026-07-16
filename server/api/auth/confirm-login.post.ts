// POST /api/auth/confirm-login — 用户确认"继续登录"后：强制原设备下线，创建新会话
import { readBody, getHeader, setCookie } from 'h3'
import { prisma } from '../../lib/prisma'
import { generateToken, comparePassword } from '../../lib/jwt'

// Cookie 配置（与客户端 useAuthCookie.ts 保持一致）
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7天
const TOKEN_COOKIE = 'auth_token'
const USER_COOKIE = 'auth_user'

/**
 * 解析设备信息（与 login.post.ts 保持一致）
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
      throw createError({ statusCode: 400, message: '用户名和密码不能为空' })
    }

    // 2. 账号存在性与密码校验（确认登录时仍需验证密码正确性）
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

    // 3. 关键：递增 tokenVersion → 使原设备所有旧 token 立即失效
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    })
    const newVersion = updatedUser.tokenVersion

    // 4. 将所有旧活跃会话标记为失效（用于前端/后端统计与审计）
    await prisma.userLoginSession.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false, loggedOutAt: new Date() },
    })

    // 5. 获取新设备信息
    const userAgent = getHeader(event, 'user-agent') || ''
    const ipAddress =
      getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
      getHeader(event, 'x-real-ip') ||
      '127.0.0.1'
    const deviceInfo = formatDeviceInfo(userAgent)

    // 6. 创建新的会话记录（新设备）
    const session = await prisma.userLoginSession.create({
      data: {
        userId: user.id,
        tokenVersion: newVersion,
        deviceInfo,
        ipAddress,
        userAgent,
        isActive: true,
        lastSeenAt: new Date(),
      },
    })

    // 7. 生成新 token（包含新的 tokenVersion）
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      mode: user.mode,
      teamId: user.teamId,
      tokenVersion: newVersion,
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
      tokenVersion: newVersion,
      message: '已强制下线其他设备',
      user: userInfo,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Confirm-login error:', error)
    throw createError({ statusCode: 500, message: '确认登录失败' })
  }
})
