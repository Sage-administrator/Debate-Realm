import { prisma } from '../../../lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'teamId')!

    const members = await prisma.teamMember.findMany({
      where: { teamId: id },
      include: {
        user: true,
        assignedMatches: {
          include: { match: true },
        },
      },
    })

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      nickname: m.user.nickname,
      email: m.user.email,
      avatar: m.user.avatar,
      role: m.user.role,
      assignedMatches: m.assignedMatches.map((am) => ({
        matchId: am.matchId,
        matchRound: am.match.round,
      })),
      createdAt: m.createdAt,
    }))
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get team members error:', error)
    throw createError({ statusCode: 500, message: '获取团队成员失败' })
  }
})
