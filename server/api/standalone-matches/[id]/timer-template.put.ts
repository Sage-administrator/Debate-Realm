// 保存独立赛事的计时器环节模板
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

  const body = await readBody<{ phases: string }>(event)
  if (!body.phases) throw createError({ statusCode: 400, message: '缺少phases参数' })

  // 验证 JSON 合法性
  try {
    JSON.parse(body.phases)
  } catch {
    throw createError({ statusCode: 400, message: 'phases不是有效的JSON格式' })
  }

  // 权限：系统管理员 或 该赛事的创建者
  const user = await getUserFromEventWithSession(event, prisma)
  const match = await prisma.standaloneMatch.findUnique({ where: { id } })
  if (!match) throw createError({ statusCode: 404, message: '独立赛事不存在' })
  if (match.userId !== user.userId && user.role !== 'system_admin') {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const template = await prisma.timerTemplate.upsert({
    where: { standaloneMatchId: id },
    create: { standaloneMatchId: id, phases: body.phases },
    update: { phases: body.phases },
  })

  return {
    id: template.id,
    phases: template.phases,
    updatedAt: template.updatedAt,
  }
})
