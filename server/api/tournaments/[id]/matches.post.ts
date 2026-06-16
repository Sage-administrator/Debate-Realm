import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const id = getRouterParam(event, 'id')!
    const { round, orderNum, teamA, teamB, scheduledAt } = await readBody<{
      round: string; orderNum: number; teamA?: string; teamB?: string; scheduledAt?: string
    }>(event)

    if (!round || orderNum === undefined) throw createError({ statusCode: 400, statusMessage: '轮次和顺序不能为空' })

    const tournament = await prisma.tournament.findUnique({
      where: { id }, include: { team: true },
    })

    if (!tournament) throw createError({ statusCode: 404, statusMessage: '赛事不存在' })

    if (user.role !== 'system_admin' && tournament.team.adminId !== user.userId) {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const match = await prisma.match.create({
      data: {
        tournamentId: id, round, orderNum,
        teamA: teamA || null, teamB: teamB || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'pending',
      },
    })

    setResponseStatus(event, 201)
    return {
      id: match.id, round: match.round, orderNum: match.orderNum,
      teamA: match.teamA, teamB: match.teamB, status: match.status, scheduledAt: match.scheduledAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Create match error:', error)
    throw createError({ statusCode: 500, statusMessage: '创建场次失败' })
  }
})
