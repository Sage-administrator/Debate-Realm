import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const id = getRouterParam(event, 'id')!

    const match = await prisma.match.findUnique({
      where: { id },
      include: { tournament: { include: { team: true } } },
    })

    if (!match) throw createError({ statusCode: 404, statusMessage: '场次不存在' })

    if (user.role !== 'system_admin') {
      if (match.tournament?.team.adminId !== user.userId) {
        throw createError({ statusCode: 403, statusMessage: '权限不足' })
      }
    }

    await prisma.match.delete({ where: { id } })
    return { message: '场次已删除' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete match error:', error)
    throw createError({ statusCode: 500, statusMessage: '删除场次失败' })
  }
})
