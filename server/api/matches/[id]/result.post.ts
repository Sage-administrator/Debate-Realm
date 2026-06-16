import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const id = getRouterParam(event, 'id')!
    const { winner, scoreA, scoreB } = await readBody<{ winner: string; scoreA: number; scoreB: number }>(event)

    if (!winner || scoreA === undefined || scoreB === undefined) throw createError({ statusCode: 400, statusMessage: '赛果信息不完整' })
    if (!['A', 'B', 'draw'].includes(winner)) throw createError({ statusCode: 400, statusMessage: '无效的获胜方' })

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        tournament: { include: { team: true } },
        assignedMembers: { where: { member: { userId: user.userId } } },
      },
    })

    if (!match) throw createError({ statusCode: 404, statusMessage: '场次不存在' })

    const isAdmin = user.role === 'system_admin' || (match.tournament && match.tournament.team.adminId === user.userId)
    const isAssigned = match.assignedMembers.length > 0

    if (!isAdmin && !isAssigned) throw createError({ statusCode: 403, statusMessage: '权限不足' })

    const resolvedWinner = winner === 'draw' ? null : (winner === 'A' ? match.teamA : match.teamB)

    const updated = await prisma.match.update({
      where: { id },
      data: { winner: resolvedWinner, scoreA, scoreB, status: 'finished' },
    })

    return { id: updated.id, winner: updated.winner, scoreA: updated.scoreA, scoreB: updated.scoreB, status: updated.status }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Submit result error:', error)
    throw createError({ statusCode: 500, statusMessage: '登记赛果失败' })
  }
})
