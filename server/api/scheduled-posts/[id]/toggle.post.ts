// POST /api/scheduled-posts/[id]/toggle — 启停控制（暂停/恢复）
// body: { paused: boolean }
import { getRouterParam, readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { computeNextRun } from '../../../lib/scheduler'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)
    if (user.role !== 'admin' && user.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '权限不足' })
    }
    if (!user.teamId) throw createError({ statusCode: 400, message: '用户不属于任何团队' })

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: '缺少任务 ID' })

    const body = await readBody<{ paused: boolean }>(event)
    const paused = body.paused === true

    const existing = await prisma.scheduledPost.findFirst({ where: { id, teamId: user.teamId } })
    if (!existing) throw createError({ statusCode: 404, message: '任务不存在' })

    // 仅允许对待发布类状态做启停；已发布(单次完成)/失败的任务不受切换影响（失败可经编辑重试）
    if (existing.status !== 'pending' && existing.status !== 'paused') {
      throw createError({ statusCode: 400, message: `当前状态(${existing.status})不可启停` })
    }

    const data: Record<string, unknown> = { status: paused ? 'paused' : 'pending' }
    if (!paused) {
      // 恢复时若下次触发已过期/为空，重新计算
      const now = new Date()
      if (!existing.nextRunAt || new Date(existing.nextRunAt) <= now) {
        const next = computeNextRun(existing as any, now)
        if (next) data.nextRunAt = next
      }
    }

    const updated = await prisma.scheduledPost.update({ where: { id }, data })
    return { success: true, task: updated }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Scheduled] 启停失败:', error)
    throw createError({ statusCode: 500, message: '启停定时任务失败' })
  }
})
