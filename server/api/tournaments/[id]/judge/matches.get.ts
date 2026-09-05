// ════════════════════════════════════════════════
// GET /api/tournaments/[id]/judge/matches — 评委视角比赛列表
// 评委登录后查看自己需要评分的比赛列表
// 支持按姓名查询（judgeName 参数），或从登录用户 profile 中获取
// ════════════════════════════════════════════════
import { prisma } from '../../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../../utils/auth'
import { canReadTournament } from '../../../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  try {
    const tournamentId = getRouterParam(event, 'id')!
    const query = getQuery(event)
    const judgeName = (query.judgeName as string)?.trim() || ''

    if (!judgeName) {
      throw createError({ statusCode: 400, message: '请提供评委姓名' })
    }

    // 权限校验：赛事管理员可查看，或评委本人（公开赛事评委也可查看）
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { team: true },
    })

    if (!tournament) {
      throw createError({ statusCode: 404, message: '赛事不存在' })
    }

    // 尝试获取当前登录用户
    let isAdmin = false
    try {
      const currentUser = await getUserFromEventWithSession(event, prisma)
      isAdmin = canReadTournament(currentUser, tournament)
    } catch {
      // 未登录也没关系，评委可以用姓名查询
    }

    // 非管理员只能查自己的评分
    // （这里简单通过 judgeName 过滤，实际生产环境应结合评委账号体系）

    // 查询该赛事所有进行中/已结束的比赛
    const matches = await prisma.match.findMany({
      where: {
        tournamentId,
        deletedAt: null,
      },
      orderBy: [{ round: 'asc' }, { orderNum: 'asc' }],
      include: {
        tournament: { select: { name: true, teams: { select: { id: true, name: true } } } },
        scores: {
          where: { judgeName },
          select: {
            id: true,
            judgeName: true,
            scoreTeamA: true,
            scoreTeamB: true,
            winner: true,
            dimensions: true,
            reason: true,
            bestDebaterA: true,
            bestDebaterB: true,
            createdAt: true,
          },
        },
      },
    })

    // 计算该评委是否已评分
    const matchList = matches.map((m: any) => {
      const myScore = m.scores && m.scores.length > 0 ? m.scores[0] : null
      return {
        id: m.id,
        round: m.round,
        orderNum: m.orderNum,
        teamA: m.teamA,
        teamB: m.teamB,
        status: m.status,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        winner: m.winner,
        // 评委评分状态
        scored: !!myScore,
        myScore: myScore
          ? {
              scoreTeamA: myScore.scoreTeamA,
              scoreTeamB: myScore.scoreTeamB,
              winner: myScore.winner,
              dimensions: myScore.dimensions,
              reason: myScore.reason,
              bestDebaterA: myScore.bestDebaterA,
              bestDebaterB: myScore.bestDebaterB,
              submittedAt: myScore.createdAt,
            }
          : null,
      }
    })

    // 统计
    const total = matchList.length
    const scored = matchList.filter((m) => m.scored).length

    return {
      success: true,
      data: {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          format: tournament.format,
        },
        judgeName,
        stats: {
          total,
          scored,
          pending: total - scored,
        },
        matches: matchList,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Judge matches error:', error)
    throw createError({ statusCode: 500, message: '获取比赛列表失败' })
  }
})
