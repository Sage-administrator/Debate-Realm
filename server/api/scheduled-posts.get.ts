// GET /api/scheduled-posts — 列出当前团队的定时发布任务
import { prisma } from '../lib/prisma'
import { getUserFromEventWithSession } from '../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)
    if (!user.teamId) throw createError({ statusCode: 400, message: '用户不属于任何团队' })
    const tasks = await prisma.scheduledPost.findMany({
      where: { teamId: user.teamId },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, tasks }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Scheduled] 列表失败:', error)
    throw createError({ statusCode: 500, message: '获取定时任务失败' })
  }
})
