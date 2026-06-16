import { prisma } from '../../../../lib/prisma'
import { getUserFromEvent } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)
    const teamId = getRouterParam(event, 'teamId')!

    // 获取团队信息
    const team = await prisma.team.findUnique({ where: { id: teamId } })

    if (!team) {
      throw createError({ statusCode: 404, statusMessage: '团队不存在' })
    }

    // 权限检查：系统管理员或团队管理员
    if (currentUser.role !== 'system_admin' && team.adminId !== currentUser.userId) {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    // 获取所有子账号（role=subaccount 的 TeamMember）
    const subaccountMembers = await prisma.teamMember.findMany({
      where: { teamId },
      include: { user: true },
    })

    // 过滤出子账号成员（排除管理员）
    const subaccounts = subaccountMembers.filter(m => m.user.role === 'subaccount')

    if (subaccounts.length === 0) {
      return { deleted: 0, message: '没有子账号需要清理' }
    }

    // 删除所有子账号的 TeamMember 和 User 记录
    const userIds = subaccounts.map(m => m.userId)

    // 删除 TeamMember 记录
    await prisma.teamMember.deleteMany({
      where: {
        teamId,
        userId: { in: userIds },
      },
    })

    // 删除 User 记录
    await prisma.user.deleteMany({
      where: {
        id: { in: userIds },
        role: 'subaccount',
      },
    })

    return {
      deleted: subaccounts.length,
      message: `已清理 ${subaccounts.length} 个子账号`,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Cleanup members error:', error)
    throw createError({ statusCode: 500, statusMessage: '清理子账号失败' })
  }
})
