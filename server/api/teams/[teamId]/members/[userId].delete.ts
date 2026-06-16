import { prisma } from '../../../../lib/prisma'
import { getUserFromEvent } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)
    const id = getRouterParam(event, 'teamId')!
    const userId = getRouterParam(event, 'userId')!

    const team = await prisma.team.findUnique({ where: { id } })

    if (!team) {
      throw createError({ statusCode: 404, statusMessage: '团队不存在' })
    }

    if (currentUser.role !== 'system_admin' && team.adminId !== currentUser.userId) {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    if (team.adminId === userId) {
      throw createError({ statusCode: 400, statusMessage: '不能删除团队管理员' })
    }

    await prisma.teamMember.deleteMany({
      where: { teamId: id, userId },
    })

    await prisma.user.update({
      where: { id: userId },
      data: { role: 'individual', mode: 'individual', teamId: null },
    })

    return { message: '子账号已删除' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete member error:', error)
    throw createError({ statusCode: 500, statusMessage: '删除子账号失败' })
  }
})
