import { readBody } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { hashPassword } from '../../../../lib/jwt'
import { getUserFromEventWithSession } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion，
    // 否则被踢下线的旧 token 在 7 天过期前仍可重置用户密码
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '仅系统管理员可重置密码' })
    }

    const id = getRouterParam(event, 'id')!
    const { newPassword } = await readBody<{ newPassword: string }>(event)

    if (!newPassword) {
      throw createError({ statusCode: 400, message: '新密码不能为空' })
    }

    if (newPassword.length < 6) {
      throw createError({ statusCode: 400, message: '密码长度至少6位' })
    }

    const user = await prisma.user.findUnique({ where: { id } })

    if (!user) {
      throw createError({ statusCode: 404, message: '用户不存在' })
    }

    const hashedPassword = await hashPassword(newPassword)
    // 修复：重置密码时递增 tokenVersion，使该用户所有旧 token 立即失效
    // 同时失效所有活跃会话，强制用户使用新密码重新登录
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { password: hashedPassword, tokenVersion: { increment: 1 } },
      }),
      prisma.userLoginSession.updateMany({
        where: { userId: id, isActive: true },
        data: { isActive: false, loggedOutAt: new Date() },
      }),
    ])

    return { message: '密码重置成功，用户需使用新密码重新登录' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Reset password error:', error)
    throw createError({ statusCode: 500, message: '重置密码失败' })
  }
})
