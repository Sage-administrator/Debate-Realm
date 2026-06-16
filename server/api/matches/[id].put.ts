import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const id = getRouterParam(event, 'id')!
    const { round, orderNum, teamA, teamB, scheduledAt, status } = await readBody<{
      round?: string; orderNum?: number; teamA?: string; teamB?: string; scheduledAt?: string; status?: string
    }>(event)

    const match = await prisma.match.findUnique({
      where: { id },
      include: { tournament: { include: { team: true } } },
    })

    if (!match) throw createError({ statusCode: 404, statusMessage: '场次不存在' })

    if (user.role !== 'system_admin') {
      if (match.tournament?.team.adminId !== user.userId) {
        throw createError({ statusCode: 403, statusMessage: '权限不足' })
      }
    }

    const updated = await prisma.match.update({
      where: { id },
      data: {
        round: round ?? match.round,
        orderNum: orderNum ?? match.orderNum,
        teamA: teamA !== undefined ? teamA : match.teamA,
        teamB: teamB !== undefined ? teamB : match.teamB,
        scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : match.scheduledAt,
        status: status ?? match.status,
      },
    })

    return {
      id: updated.id, round: updated.round, orderNum: updated.orderNum,
      teamA: updated.teamA, teamB: updated.teamB, winner: updated.winner,
      scoreA: updated.scoreA, scoreB: updated.scoreB, status: updated.status, scheduledAt: updated.scheduledAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update match error:', error)
    throw createError({ statusCode: 500, statusMessage: '更新场次信息失败' })
  }
})
