import { prisma } from '../../lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        tournament: true,
        standaloneMatch: true,
        timer: true,
        assignedMembers: { include: { member: { include: { user: true } } } },
      },
    })

    if (!match) throw createError({ statusCode: 404, message: '场次不存在' })

    return {
      id: match.id,
      round: match.round,
      orderNum: match.orderNum,
      teamA: match.teamA,
      teamB: match.teamB,
      winner: match.winner,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      status: match.status,
      scheduledAt: match.scheduledAt,
      tournament: match.tournament
        ? { id: match.tournament.id, name: match.tournament.name }
        : null,
      standaloneMatch: match.standaloneMatch
        ? { id: match.standaloneMatch.id, name: match.standaloneMatch.name }
        : null,
      timer: match.timer,
      assignedUsers: match.assignedMembers.map((am) => ({
        userId: am.member.user.id,
        username: am.member.user.username,
      })),
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get match error:', error)
    throw createError({ statusCode: 500, message: '获取场次详情失败' })
  }
})
