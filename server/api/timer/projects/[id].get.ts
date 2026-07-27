import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'

// GET /api/timer/projects/[id] — 获取单个项目（含所有环节）
export default defineEventHandler(async (event) => {
  const payload = await getUserFromEventWithSession(event, prisma)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少项目ID' })

  const project = await prisma.debateTimerProject.findUnique({
    where: { id },
    include: {
      stages: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  })

  if (!project) {
    throw createError({ statusCode: 404, message: '项目不存在' })
  }

  // 权限检查：仅项目创建者可访问
  if (project.userId !== payload.userId) {
    throw createError({ statusCode: 403, message: '无权访问此项目' })
  }

  return {
    success: true,
    data: {
      id: project.id,
      name: project.name,
      title: project.title,
      positiveTopic: project.positiveTopic,
      negativeTopic: project.negativeTopic,
      teamPositiveName: project.teamPositiveName,
      teamNegativeName: project.teamNegativeName,
      uiConfig: project.uiConfig ? JSON.parse(project.uiConfig) : null,
      audioConfig: project.audioConfig ? JSON.parse(project.audioConfig) : null,
      stages: project.stages.map((s) => ({
        id: s.id,
        name: s.name,
        duration: s.duration,
        type: s.type,
        description: s.description,
        order: s.orderIndex,
        positiveDuration: s.positiveDuration,
        negativeDuration: s.negativeDuration,
        allowedRoles: s.allowedRoles ? JSON.parse(s.allowedRoles) : null,
        speaker: s.speaker,
        questioner: s.questioner,
        responder: s.responder,
        firstSpeaker: s.firstSpeaker,
        protectionTime: s.protectionTime,
        positiveSpeakers: s.positiveSpeakers ? JSON.parse(s.positiveSpeakers) : null,
        negativeSpeakers: s.negativeSpeakers ? JSON.parse(s.negativeSpeakers) : null,
        speakers: s.speakers ? JSON.parse(s.speakers) : null,
        questionDuration: s.questionDuration,
        answerDuration: s.answerDuration,
        enabled: s.enabled,
        pptImage: s.pptImage || null,
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  }
})
