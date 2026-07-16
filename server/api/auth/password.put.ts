import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { comparePassword, hashPassword } from '../../lib/jwt'
import { getUserFromEventWithSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion
    const user = await getUserFromEventWithSession(event, prisma)
    const { oldPassword, newPassword } = await readBody<{ oldPassword: string; newPassword: string }>(event)

    if (!oldPassword || !newPassword) {
      throw createError({ statusCode: 400, message: '旧密码和新密码不能为空' })
    }

    if (newPassword.length < 6) {
      throw createError({ statusCode: 400, message: '新密码长度至少6位' })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    })

    if (!dbUser) {
      throw createError({ statusCode: 404, message: '用户不存在' })
    }

    const isValid = await comparePassword(oldPassword, dbUser.password)
    if (!isValid) {
      throw createError({ statusCode: 401, message: '旧密码错误' })
    }

    const hashedPassword = await hashPassword(newPassword)
    // 修改密码时递增 tokenVersion，使旧 token 立即失效（防止密码泄露后旧 token 仍可用 7 天）
    // 同时将所有活跃会话标记为失效，强制用户使用新密码重新登录
    await prisma.$transaction([
      prisma.user.update({
        where: { id: dbUser.id },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.userLoginSession.updateMany({
        where: { userId: dbUser.id, isActive: true },
        data: { isActive: false, loggedOutAt: new Date() },
      }),
    ])

    return { message: '密码修改成功，请使用新密码重新登录' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Change password error:', error)
    throw createError({ statusCode: 500, message: '修改密码失败' })
  }
})
