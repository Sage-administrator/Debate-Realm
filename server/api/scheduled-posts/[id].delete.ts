// DELETE /api/scheduled-posts/[id] — 删除定时发布任务
import { getRouterParam } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)
    if (user.role !== 'admin' && user.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '权限不足' })
    }
    if (!user.teamId) throw createError({ statusCode: 400, message: '用户不属于任何团队' })

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: '缺少任务 ID' })

    const existing = await prisma.scheduledPost.findFirst({ where: { id, teamId: user.teamId } })
    if (!existing) throw createError({ statusCode: 404, message: '任务不存在' })

    await prisma.scheduledPost.delete({ where: { id } })
    return { success: true }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Scheduled] 删除失败:', error)
    throw createError({ statusCode: 500, message: '删除定时任务失败' })
  }
})
