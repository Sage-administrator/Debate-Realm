import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { syncStages } from '../../../utils/syncStages'

// PUT /api/timer/projects/[id] — 更新项目（基本信息+环节）
export default defineEventHandler(async (event) => {
  const payload = await getUserFromEventWithSession(event, prisma)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少项目ID' })

  // 检查项目是否存在且属于当前用户
  const existing = await prisma.debateTimerProject.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!existing) {
    throw createError({ statusCode: 404, message: '项目不存在' })
  }
  if (existing.userId !== payload.userId) {
    throw createError({ statusCode: 403, message: '无权编辑此项目' })
  }

  const body = await readBody(event)

  // 事务：更新项目 + syncStages（diff + update + create + delete）
  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.debateTimerProject.update({
      where: { id },
      data: {
        name: String(body.title || body.name || '辩论赛').trim(),
        title: String(body.title || '辩论赛').trim(),
        positiveTopic: body.positiveTopic || null,
        negativeTopic: body.negativeTopic || null,
        teamPositiveName: body.teamPositiveName || null,
        teamNegativeName: body.teamNegativeName || null,
        uiConfig: body.uiConfig ? JSON.stringify(body.uiConfig) : null,
      },
    })

    const incomingStages = Array.isArray(body.stages) ? body.stages : []
    const returnedStages = await syncStages(tx, id, incomingStages)

    return { project, stages: returnedStages }
  })

  return {
    success: true,
    data: {
      id: result.project.id,
      name: result.project.name,
      title: result.project.title,
      stageCount: result.stages.length,
    },
  }
})
