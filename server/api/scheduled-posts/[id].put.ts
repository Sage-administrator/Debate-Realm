// PUT /api/scheduled-posts/[id] — 编辑定时发布任务
import { getRouterParam, readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import { computeNextRun, localToUtc } from '../../lib/scheduler'

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

    const body = await readBody<{
      title?: string
      content?: string
      type?: string
      channelId?: string
      tags?: string
      pollOptions?: string[]
      scheduleType?: string
      runAt?: string
      timeHHMM?: string
      weekday?: number
      timezone?: string
    }>(event)

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title.trim()
    if (body.content !== undefined) data.content = body.content.trim()
    if (body.type !== undefined) data.type = body.type === 'debate' ? 'debate' : 'discussion'
    if (body.channelId !== undefined) data.channelId = body.channelId.trim()
    if (body.tags !== undefined) data.tags = body.tags.trim() || null
    if (body.pollOptions !== undefined) {
      data.pollOptions =
        Array.isArray(body.pollOptions) && body.pollOptions.length
          ? JSON.stringify(body.pollOptions)
          : null
    }

    // 调度字段变更 → 重新计算 nextRunAt
    const scheduleChanged =
      body.scheduleType !== undefined ||
      body.runAt !== undefined ||
      body.timeHHMM !== undefined ||
      body.weekday !== undefined ||
      body.timezone !== undefined
    if (scheduleChanged) {
      const scheduleType = body.scheduleType || existing.scheduleType
      if (!['once', 'daily', 'weekly'].includes(scheduleType)) {
        throw createError({ statusCode: 400, message: '无效的调度类型' })
      }
      const timezone = body.timezone?.trim() || existing.timezone || 'Asia/Shanghai'
      let nextRunAt: Date | null = null
      if (scheduleType === 'once') {
        const runAtStr =
          body.runAt || (existing.runAt ? new Date(existing.runAt).toISOString() : '')
        if (!runAtStr) throw createError({ statusCode: 400, message: '单次任务需指定触发时间' })
        const runAt = localToUtc(runAtStr, timezone)
        data.runAt = runAt
        data.timeHHMM = null
        data.weekday = null
        nextRunAt = runAt
      } else if (scheduleType === 'daily') {
        const timeHHMM = body.timeHHMM || existing.timeHHMM
        if (!timeHHMM) throw createError({ statusCode: 400, message: '每日任务需指定时间' })
        data.scheduleType = scheduleType
        data.timeHHMM = timeHHMM
        data.runAt = null
        data.weekday = null
        nextRunAt = computeNextRun({ scheduleType, timeHHMM, timezone }, new Date())
      } else {
        const timeHHMM = body.timeHHMM || existing.timeHHMM
        const weekday = body.weekday !== undefined ? body.weekday : existing.weekday
        if (!timeHHMM) throw createError({ statusCode: 400, message: '每周任务需指定时间' })
        if (weekday === undefined || weekday === null || weekday < 0 || weekday > 6) {
          throw createError({ statusCode: 400, message: '每周任务需指定星期(0-6)' })
        }
        data.scheduleType = scheduleType
        data.timeHHMM = timeHHMM
        data.weekday = weekday
        data.runAt = null
        nextRunAt = computeNextRun({ scheduleType, timeHHMM, weekday, timezone }, new Date())
      }
      data.timezone = timezone
      data.nextRunAt = nextRunAt
      // 编辑后若之前失败，则恢复为待发布以便重试
      if (existing.status === 'failed') data.status = 'pending'
    }

    const updated = await prisma.scheduledPost.update({ where: { id }, data })
    return { success: true, task: updated }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Scheduled] 更新失败:', error)
    throw createError({ statusCode: 500, message: '更新定时任务失败' })
  }
})
