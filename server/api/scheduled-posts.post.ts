// POST /api/scheduled-posts — 创建定时发布任务
import { readBody } from 'h3'
import { prisma } from '../lib/prisma'
import { getUserFromEventWithSession } from '../utils/auth'
import { computeNextRun, localToUtc } from '../lib/scheduler'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)
    if (user.role !== 'admin' && user.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '权限不足' })
    }
    if (!user.teamId) throw createError({ statusCode: 400, message: '用户不属于任何团队' })

    const body = await readBody<{
      title: string
      content: string
      type?: string
      channelId: string
      tags?: string
      pollOptions?: string[]
      scheduleType: string
      runAt?: string
      timeHHMM?: string
      weekday?: number
      timezone?: string
    }>(event)

    const title = (body.title || '').trim()
    const content = (body.content || '').trim()
    const channelId = (body.channelId || '').trim()
    if (!title) throw createError({ statusCode: 400, message: '标题不能为空' })
    if (!content) throw createError({ statusCode: 400, message: '正文不能为空' })
    if (!channelId) throw createError({ statusCode: 400, message: '目标论坛子频道 ID 不能为空' })

    const scheduleType = body.scheduleType || 'once'
    if (!['once', 'daily', 'weekly'].includes(scheduleType)) {
      throw createError({ statusCode: 400, message: '无效的调度类型' })
    }
    const timezone = body.timezone?.trim() || 'Asia/Shanghai'

    // 调度字段校验 + 计算下次触发
    let nextRunAt: Date | null = null
    let runAt: Date | null = null
    let timeHHMM: string | null = null
    let weekday: number | null = null
    if (scheduleType === 'once') {
      if (!body.runAt) throw createError({ statusCode: 400, message: '单次任务需指定触发时间' })
      runAt = localToUtc(body.runAt, timezone)
      nextRunAt = runAt
    } else if (scheduleType === 'daily') {
      if (!body.timeHHMM) throw createError({ statusCode: 400, message: '每日任务需指定时间' })
      timeHHMM = body.timeHHMM
      nextRunAt = computeNextRun({ scheduleType, timeHHMM, timezone }, new Date())
    } else {
      if (!body.timeHHMM) throw createError({ statusCode: 400, message: '每周任务需指定时间' })
      if (body.weekday === undefined || body.weekday < 0 || body.weekday > 6) {
        throw createError({ statusCode: 400, message: '每周任务需指定星期(0-6)' })
      }
      timeHHMM = body.timeHHMM
      weekday = body.weekday
      nextRunAt = computeNextRun({ scheduleType, timeHHMM, weekday, timezone }, new Date())
    }

    if (!nextRunAt) throw createError({ statusCode: 400, message: '无法计算下次触发时间' })

    const pollOptions = Array.isArray(body.pollOptions) && body.pollOptions.length
      ? JSON.stringify(body.pollOptions)
      : null

    const created = await prisma.scheduledPost.create({
      data: {
        teamId: user.teamId,
        title,
        content,
        type: body.type === 'debate' ? 'debate' : 'discussion',
        channelId,
        tags: body.tags?.trim() || null,
        pollOptions,
        scheduleType,
        runAt,
        timeHHMM,
        weekday,
        timezone,
        nextRunAt,
        status: 'pending',
      },
    })

    return { success: true, task: created }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Scheduled] 创建失败:', error)
    throw createError({ statusCode: 500, message: '创建定时任务失败' })
  }
})
