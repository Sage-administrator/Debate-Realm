// POST /api/auth/confirm-login — 用户确认"继续登录"后：强制原设备下线，创建新会话
import { readBody, getHeader } from 'h3'
import { prisma } from '../../lib/prisma'
import { generateToken, comparePassword } from '../../lib/jwt'

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
      throw createError({ statusCode: 400, statusMessage: '用户名和密码不能为空' })
    }

    // 2. 账号存在性与密码校验（确认登录时仍需验证密码正确性）
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

    return {
      token,
      sessionId: session.id,
      tokenVersion: newVersion,
      message: '已强制下线其他设备',
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
    console.error('Confirm-login error:', error)
    throw createError({ statusCode: 500, statusMessage: '确认登录失败' })
  }
})
