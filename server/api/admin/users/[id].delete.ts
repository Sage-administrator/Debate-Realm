import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion，
    // 否则被踢下线的旧 token 在 7 天过期前仍可删除用户
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '仅系统管理员可删除用户' })
    }

    const id = getRouterParam(event, 'id')!

    if (id === currentUser.userId) {
      throw createError({ statusCode: 400, statusMessage: '不能删除自己' })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { adminOfTeams: { select: { id: true, name: true } } },
    })

    if (!user) {
      throw createError({ statusCode: 404, statusMessage: '用户不存在' })
    }

    // 修复：Team.adminId 已建立外键关系（onDelete: Restrict），
    // 若用户是团队管理员，删除会失败。需先检查并提示用户先转移管理员权限
    if (user.adminOfTeams && user.adminOfTeams.length > 0) {
      const teamNames = user.adminOfTeams.map(t => t.name).join('、')
      throw createError({
        statusCode: 400,
        statusMessage: `无法删除该用户，因为该用户是以下团队的管理员：${teamNames}。请先将团队管理员转移给其他用户后再删除。`,
      })
    }

    // 修复：删除用户前清理关联数据，避免 SQLite 外键约束错误或产生孤儿数据
    // 1. 失效所有登录会话
    // 2. 删除独立的计时器项目（用户创建的）
    // 3. 删除独立比赛
    // 注意：Registration 已加 onDelete: SetNull，会自动解除关联
    await prisma.$transaction([
      prisma.userLoginSession.updateMany({
        where: { userId: id, isActive: true },
        data: { isActive: false, loggedOutAt: new Date() },
      }),
      prisma.debateTimerProject.deleteMany({
        where: { userId: id, tournamentId: null }, // 仅删除独立项目，赛事关联项目保留
      }),
      prisma.standaloneMatch.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ])

    return { message: '用户已删除' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete user error:', error)
    throw createError({ statusCode: 500, statusMessage: '删除用户失败' })
  }
})
