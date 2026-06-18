import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'

// PUT /api/timer/projects/[id] — 更新项目（基本信息+环节）
export default defineEventHandler(async (event) => {
  const payload = await getUserFromEventWithSession(event, prisma)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: '缺少项目ID' })

  // 检查项目是否存在且属于当前用户
  const existing = await prisma.debateTimerProject.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '项目不存在' })
  }
  if (existing.userId !== payload.userId) {
    throw createError({ statusCode: 403, statusMessage: '无权编辑此项目' })
  }

  const body = await readBody(event)

  // 开始事务：更新项目 + 替换所有环节
  const result = await prisma.$transaction(async (tx) => {
    // 1. 更新项目基本信息
    const project = await tx.debateTimerProject.update({
      where: { id },
      data: {
        name: String(body.name || '新项目').trim(),
        title: String(body.title || '辩论赛').trim(),
        positiveTopic: body.positiveTopic || null,
        negativeTopic: body.negativeTopic || null,
        teamPositiveName: body.teamPositiveName || null,
        teamNegativeName: body.teamNegativeName || null,
        uiConfig: body.uiConfig ? JSON.stringify(body.uiConfig) : null,
      },
    })

    // 2. 删除现有环节
    await tx.debateTimerStage.deleteMany({
      where: { projectId: id },
    })

    // 3. 创建新的环节列表
    const stagesData = Array.isArray(body.stages) ? body.stages : []
    const newStages = await Promise.all(
      stagesData.map((s: any, idx: number) =>
        tx.debateTimerStage.create({
          data: {
            projectId: id,
            name: String(s.name || `环节${idx + 1}`).trim(),
            duration: Number(s.duration) || 0,
            type: String(s.type || 'speech').trim(),
            description: s.description || null,
            orderIndex: Number(s.order ?? idx),
            positiveDuration: s.positiveDuration ? Number(s.positiveDuration) : null,
            negativeDuration: s.negativeDuration ? Number(s.negativeDuration) : null,
            allowedRoles: s.allowedRoles ? JSON.stringify(s.allowedRoles) : null,
          },
        }),
      ),
    )

    return { project, stages: newStages }
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
