// 获取独立赛事的计时器环节模板
import { prisma } from '../../../lib/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

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