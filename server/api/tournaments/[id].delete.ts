import { prisma } from '../../lib/prisma'
import { requireWriteTournament } from '../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!

    // 权限：系统管理员 或 该赛事所属团队的管理员
    await requireWriteTournament(event, prisma, id)

    await prisma.tournament.delete({ where: { id } })
    return { message: '赛事已删除' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete tournament error:', error)
    throw createError({ statusCode: 500, message: '删除赛事失败' })
  }
})
