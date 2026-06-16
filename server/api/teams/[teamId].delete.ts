import { prisma } from '../../lib/prisma'
import { requireRole } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    requireRole(event, 'system_admin')
    const id = getRouterParam(event, 'teamId')!

    const team = await prisma.team.findUnique({ where: { id } })

    if (!team) {
      throw createError({ statusCode: 404, statusMessage: '团队不存在' })
    }

    await prisma.team.delete({ where: { id } })

    return { message: '团队已删除' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete team error:', error)
    throw createError({ statusCode: 500, statusMessage: '删除团队失败' })
  }
})
