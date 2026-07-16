// GET /api/scheduled-posts/[id]/runs — 任务发布历史
import { getRouterParam } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)
    if (!user.teamId) throw createError({ statusCode: 400, message: '用户不属于任何团队' })

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: '缺少任务 ID' })

    const existing = await prisma.scheduledPost.findFirst({ where: { id, teamId: user.teamId } })
    if (!existing) throw createError({ statusCode: 404, message: '任务不存在' })

    const runs = await prisma.scheduledPostRun.findMany({
      where: { scheduledPostId: id },
      orderBy: { runAt: 'desc' },
      take: 50,
    })
    return { success: true, runs }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Scheduled] 历史查询失败:', error)
    throw createError({ statusCode: 500, message: '获取发布历史失败' })
  }
})
