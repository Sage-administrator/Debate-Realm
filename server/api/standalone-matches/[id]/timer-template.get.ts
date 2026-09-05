// 获取独立赛事的计时器环节模板
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

  // 权限校验：登录用户 + 是本人创建或系统管理员
  const user = await getUserFromEventWithSession(event, prisma)
  const match = await prisma.standaloneMatch.findUnique({ where: { id } })
  if (!match) throw createError({ statusCode: 404, message: '独立赛事不存在' })
  if (match.userId !== user.userId && user.role !== 'system_admin') {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  let template = await prisma.timerTemplate.findUnique({
    where: { standaloneMatchId: id },
  })

  if (!template) {
    return { phases: '[]' }
  }

  return {
    id: template.id,
    phases: template.phases,
    updatedAt: template.updatedAt,
  }
})
