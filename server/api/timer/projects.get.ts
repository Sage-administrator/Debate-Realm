import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'

// GET /api/timer/projects — 获取当前用户的所有计时器项目
export default defineEventHandler(async (event) => {
  const payload = await getUserFromEventWithSession(event, prisma)

  const projects = await prisma.debateTimerProject.findMany({
    where: { userId: payload.userId },
    include: {
      stages: {
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    title: p.title,
    positiveTopic: p.positiveTopic,
    negativeTopic: p.negativeTopic,
    teamPositiveName: p.teamPositiveName,
    teamNegativeName: p.teamNegativeName,
    uiConfig: p.uiConfig ? JSON.parse(p.uiConfig) : null,
    stages: p.stages.map((s) => ({
      id: s.id,
      name: s.name,
      duration: s.duration,
      type: s.type,
      description: s.description,
      order: s.orderIndex,
      positiveDuration: s.positiveDuration,
      negativeDuration: s.negativeDuration,
      allowedRoles: s.allowedRoles ? JSON.parse(s.allowedRoles) : null,
    })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }))
})
