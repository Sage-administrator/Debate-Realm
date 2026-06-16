import { prisma } from '../../../lib/prisma'
import { getUserFromEvent, requireRole } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)
    requireRole(event, 'system_admin')

    const id = getRouterParam(event, 'id')!

    if (id === currentUser.userId) {
      throw createError({ statusCode: 400, statusMessage: '不能删除自己' })
    }

    const user = await prisma.user.findUnique({ where: { id } })

    if (!user) {
      throw createError({ statusCode: 404, statusMessage: '用户不存在' })
    }

    await prisma.user.delete({ where: { id } })

    return { message: '用户已删除' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete user error:', error)
    throw createError({ statusCode: 500, statusMessage: '删除用户失败' })
  }
})
