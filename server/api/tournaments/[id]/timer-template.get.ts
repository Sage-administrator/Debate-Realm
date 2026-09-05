// 获取赛事的计时器环节模板
import { prisma } from '../../../lib/prisma'
import { requireReadTournament } from '../../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

  // 权限：系统管理员 或 该赛事所属团队的管理员 / 子账号
  await requireReadTournament(event, prisma, id)

  const template = await prisma.timerTemplate.findUnique({
    where: { tournamentId: id },
  })

  // 如果不存在则返回空模板
  if (!template) {
    return { phases: '[]' }
  }

  return {
    id: template.id,
    phases: template.phases,
    updatedAt: template.updatedAt,
  }
})
