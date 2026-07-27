import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import { canReadTournament } from '../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const user = await getUserFromEventWithSession(event, prisma)

    // 单次查询：同时获取权限所需字段和业务数据
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        team: true, teams: true, judges: true,
        regFields: { orderBy: { sortOrder: 'asc' } },
        matches: {
          where: { deletedAt: null },
          orderBy: [{ round: 'asc' }, { orderNum: 'asc' }],
        },
      },
    })

    if (!tournament) throw createError({ statusCode: 404, message: '赛事不存在' })

    // 权限检查：复用已查询的 tournament.teamId
    if (!canReadTournament(user, tournament)) {
      // 参赛者（已报名用户）也可查看赛事信息（用于聊天室等参赛者功能）
      const reg = await prisma.registration.findFirst({
        where: { userId: user.userId, tournamentId: id },
        select: { id: true },
      })
      if (!reg) {
        throw createError({ statusCode: 403, message: '无权限查看此赛事' })
      }
    }

    return {
      id: tournament.id, name: tournament.name, description: tournament.description,
      format: tournament.format, status: tournament.status,
      scheduledAt: tournament.scheduledAt, venue: tournament.venue,
      team: { id: tournament.team.id, name: tournament.team.name, adminId: tournament.team.adminId },
      teams: tournament.teams.map((t) => t.name),
      judges: tournament.judges.map((j) => j.name),
      // 赛程页面所需的扩展配置字段
      bestDebaterMode: tournament.bestDebaterMode,
      groupCount: tournament.groupCount,
      topicPool: tournament.topicPool,
      assignments: (tournament as any).assignments,
      // 报名系统配置字段
      registrationOpen: tournament.registrationOpen,
      registrationDeadline: tournament.registrationDeadline,
      isPublic: tournament.isPublic,
      registrationType: tournament.registrationType,
      teamSize: tournament.teamSize,
      registrationInfo: tournament.registrationInfo,
      // 统一字段配置（系统字段 + 自定义字段，已包含所有字段属性）
      fields: (tournament as any).regFields || [],
      matches: tournament.matches.map((m) => ({
        id: m.id, round: m.round, orderNum: m.orderNum,
        teamA: m.teamA, teamB: m.teamB, winner: m.winner,
        scoreA: m.scoreA, scoreB: m.scoreB, status: m.status, scheduledAt: m.scheduledAt,
        topic: (m as any).topic,
        affirmativeSide: (m as any).affirmativeSide,
        bestDebaterA: (m as any).bestDebaterA,
        bestDebaterB: (m as any).bestDebaterB,
        judge: (m as any).judge,
      })),
      createdAt: tournament.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get tournament error:', error)
    throw createError({ statusCode: 500, message: '获取赛事详情失败' })
  }
})
