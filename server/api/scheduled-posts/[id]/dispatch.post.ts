// POST /api/scheduled-posts/[id]/dispatch — WorkBuddy 自动化触发入口（服务令牌鉴权）
// 立即发布指定任务，不依赖 nextRunAt。返回 { success, run }
import { getRouterParam } from 'h3'
import { prisma } from '../../../lib/prisma'
import { requireServiceToken } from '../../../utils/auth'
import { dispatchPostById } from '../../../lib/scheduler'

export default defineEventHandler(async (event) => {
  // 服务令牌鉴权（与用户会话令牌隔离）
  const team = await requireServiceToken(event, prisma)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少任务 ID' })

  // 可选：校验任务归属该令牌对应的团队
  const task = await prisma.scheduledPost.findFirst({ where: { id, teamId: team.id } })
  if (!task) throw createError({ statusCode: 403, message: '无权操作该任务' })

  const result = await dispatchPostById(prisma, id)
  return result
})
