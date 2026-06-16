import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const id = getRouterParam(event, 'id')!

    const match = await prisma.standaloneMatch.findUnique({ where: { id } })
    if (!match) throw createError({ statusCode: 404, statusMessage: '独立赛事不存在' })
    if (match.userId !== user.userId) throw createError({ statusCode: 403, statusMessage: '权限不足' })

    await prisma.standaloneMatch.delete({ where: { id } })
    return { message: '独立赛事已删除' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete standalone match error:', error)
    throw createError({ statusCode: 500, statusMessage: '删除独立赛事失败' })
  }
})
