import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const id = getRouterParam(event, 'id')!

    const tournament = await prisma.tournament.findUnique({
      where: { id }, include: { team: true },
    })

    if (!tournament) throw createError({ statusCode: 404, statusMessage: '赛事不存在' })

    if (user.role !== 'system_admin' && tournament.team.adminId !== user.userId) {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    await prisma.tournament.delete({ where: { id } })
    return { message: '赛事已删除' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete tournament error:', error)
    throw createError({ statusCode: 500, statusMessage: '删除赛事失败' })
  }
})
