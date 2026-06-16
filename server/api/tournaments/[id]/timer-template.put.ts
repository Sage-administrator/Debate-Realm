// 保存赛事的计时器环节模板
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const auth = getUserFromEvent(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: '缺少赛事ID' })

  const body = await readBody<{ phases: string }>(event)
  if (!body.phases) throw createError({ statusCode: 400, statusMessage: '缺少phases参数' })

  // 验证 JSON 合法性
  try {
    JSON.parse(body.phases)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'phases不是有效的JSON格式' })
  }

  // 权限：系统管理员或团队管理员
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { team: { select: { adminId: true } } },
  })
  if (!tournament) throw createError({ statusCode: 404, statusMessage: '赛事不存在' })

  if (auth.role !== 'system_admin' && auth.userId !== tournament.team.adminId) {
    throw createError({ statusCode: 403, statusMessage: '无权限修改此赛事' })
  }

  const template = await prisma.timerTemplate.upsert({
    where: { tournamentId: id },
    create: { tournamentId: id, phases: body.phases },
    update: { phases: body.phases },
  })

  return {
    id: template.id,
    phases: template.phases,
    updatedAt: template.updatedAt,
  }
})
