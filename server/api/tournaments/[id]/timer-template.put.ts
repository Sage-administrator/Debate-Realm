// 保存赛事的计时器环节模板
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'

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

  // 权限：系统管理员 或 该赛事所属团队的管理员
  await requireWriteTournament(event, prisma, id)

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
