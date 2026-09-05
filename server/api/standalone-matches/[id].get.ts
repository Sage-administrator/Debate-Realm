import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)
    const id = getRouterParam(event, 'id')!

    const match = await prisma.standaloneMatch.findUnique({
      where: { id },
      include: { matches: { include: { timer: true }, orderBy: { createdAt: 'asc' } } },
    })

    if (!match) throw createError({ statusCode: 404, message: '独立赛事不存在' })

    if (match.userId !== user.userId && user.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    const firstMatchWithTimer = match.matches.find((m) => m.timer)

    return {
      id: match.id,
      name: match.name,
      description: match.description,
      venue: match.venue,
      status: match.status,
      scheduledAt: match.scheduledAt,
      matches: match.matches.map((m) => ({
        id: m.id,
        round: m.round,
        orderNum: m.orderNum,
        teamA: m.teamA,
        teamB: m.teamB,
        winner: m.winner,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        status: m.status,
        timer: m.timer
          ? {
              id: m.timer.id,
              topicPro: m.timer.topicPro,
              topicCon: m.timer.topicCon,
              phases: JSON.parse(m.timer.phases),
              currentPhase: m.timer.currentPhase,
              proRemaining: m.timer.proRemaining,
              conRemaining: m.timer.conRemaining,
              proRunning: m.timer.proRunning,
              conRunning: m.timer.conRunning,
            }
          : null,
      })),
      timer: firstMatchWithTimer?.timer
        ? {
            id: firstMatchWithTimer.timer.id,
            matchId: firstMatchWithTimer.timer.matchId,
            topicPro: firstMatchWithTimer.timer.topicPro,
            topicCon: firstMatchWithTimer.timer.topicCon,
            phases: JSON.parse(firstMatchWithTimer.timer.phases),
            currentPhase: firstMatchWithTimer.timer.currentPhase,
            proRemaining: firstMatchWithTimer.timer.proRemaining,
            conRemaining: firstMatchWithTimer.timer.conRemaining,
            proRunning: firstMatchWithTimer.timer.proRunning,
            conRunning: firstMatchWithTimer.timer.conRunning,
          }
        : null,
      createdAt: match.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get standalone match error:', error)
    throw createError({ statusCode: 500, message: '获取独立赛事详情失败' })
  }
})
