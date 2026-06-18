import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'

// POST /api/timer/projects — 创建新的计时器项目
export default defineEventHandler(async (event) => {
  const payload = await getUserFromEventWithSession(event, prisma)
  const body = await readBody(event)

  const name = String(body.name || '新项目').trim()
  const title = String(body.title || '辩论赛').trim()

  // 创建项目，默认不生成任何环节，由前端管理
  const project = await prisma.debateTimerProject.create({
    data: {
      userId: payload.userId,
      name,
      title,
      positiveTopic: body.positiveTopic || null,
      negativeTopic: body.negativeTopic || null,
      teamPositiveName: body.teamPositiveName || null,
      teamNegativeName: body.teamNegativeName || null,
      uiConfig: body.uiConfig ? JSON.stringify(body.uiConfig) : null,
    },
  })

  return {
    success: true,
    data: {
      id: project.id,
      name: project.name,
      title: project.title,
    },
  }
})
