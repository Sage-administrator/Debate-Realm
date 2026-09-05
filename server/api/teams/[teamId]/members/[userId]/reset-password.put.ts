// PUT /api/teams/[teamId]/members/[userId]/reset-password — 团队管理员重置成员密码
// 权限：仅 system_admin 或团队 admin 可操作
import { readBody } from 'h3'
import { prisma } from '../../../../../lib/prisma'
import { hashPassword } from '../../../../../lib/jwt'
import { getUserFromEventWithSession } from '../../../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 校验登录态 + 单设备登录一致性
    const currentUser = await getUserFromEventWithSession(event, prisma)
    const teamId = getRouterParam(event, 'teamId')!
    const userId = getRouterParam(event, 'userId')!

    // 查询团队是否存在
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) {
      throw createError({ statusCode: 404, message: '团队不存在' })
    }

    // 权限校验：仅 system_admin 或该团队的 admin 可操作
    if (currentUser.role !== 'system_admin' && team.adminId !== currentUser.userId) {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    // 确认目标用户是该团队成员
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    })
    if (!member) {
      throw createError({ statusCode: 404, message: '成员不存在' })
    }

    // 不能重置自己的密码（防止误操作，自己改密走 /api/auth/password）
    if (userId === currentUser.userId) {
      throw createError({
        statusCode: 400,
        message: '不能在此处重置自己的密码，请前往账户设置修改',
      })
    }

    // 读取新密码
    const { newPassword } = await readBody<{ newPassword: string }>(event)

    if (!newPassword) {
      throw createError({ statusCode: 400, message: '新密码不能为空' })
    }
    if (newPassword.length < 6) {
      throw createError({ statusCode: 400, message: '密码长度至少6位' })
    }

    const hashedPassword = await hashPassword(newPassword)

    // 重置密码：更新密码哈希 + 递增 tokenVersion 使旧 token 失效 + 清理活跃会话
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword, tokenVersion: { increment: 1 } },
      }),
      prisma.userLoginSession.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false, loggedOutAt: new Date() },
      }),
    ])

    return { message: '密码重置成功，成员需使用新密码重新登录' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Reset team member password error:', error)
    throw createError({ statusCode: 500, message: '重置密码失败' })
  }
})
