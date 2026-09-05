// ════════════════════════════════════════════════
// GET /api/tournaments/[id]/standings — 赛事积分榜/统计数据
// 公开访问（只要赛事 isPublic），用于赛事统计页面展示
// 非公开赛事：仅管理员和已登录的团队成员可访问
// 返回：积分榜、比赛统计、最佳辩手榜等
// ════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { canReadTournament } from '../../../utils/tournament-auth'
import { getUserFromEvent } from '../../../utils/auth'
import type { JWTPayload } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const tournamentId = getRouterParam(event, 'id')!

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { team: { select: { id: true, name: true, adminId: true } } },
    })

    if (!tournament) {
      throw createError({ statusCode: 404, message: '赛事不存在' })
    }

    // 非公开赛事：需要权限校验
    if (!tournament.isPublic) {
      let user: JWTPayload | null = null
      try {
        user = getUserFromEvent(event)
      } catch {
        // 未登录用户访问非公开赛事，返回 404 避免暴露赛事存在
        throw createError({ statusCode: 404, message: '赛事不存在' })
      }
      // 构造兼容 canReadTournament 的对象，确保 teamId 存在
      const tournamentWithTeam = {
        ...tournament,
        teamId: tournament.teamId || '',
      }
      if (!canReadTournament(user, tournamentWithTeam)) {
        throw createError({ statusCode: 403, message: '无权限查看此赛事' })
      }
    }

    // ════════ 并行执行所有数据库查询（Promise.all 减少总等待时间） ════════
    const [teams, allMatches, scores] = await Promise.all([
      // 1. 积分榜（按积分排序）
      prisma.tournamentTeam.findMany({
        where: { tournamentId },
        orderBy: [{ points: 'desc' }, { wins: 'desc' }, { scoreFor: 'desc' }],
        select: {
          id: true,
          name: true,
          groupLabel: true,
          points: true,
          wins: true,
          draws: true,
          losses: true,
          scoreFor: true,
          scoreAgainst: true,
        },
      }),
      // 2. 比赛统计（仅选择需要的字段，减少数据传输）
      prisma.match.findMany({
        where: { tournamentId, deletedAt: null },
        select: {
          id: true,
          status: true,
        },
      }),
      // 3. 评分数据（最佳辩手 + 评委统计共用）
      prisma.matchScore.findMany({
        where: { tournamentId },
        select: {
          bestDebaterA: true,
          bestDebaterB: true,
          judgeName: true,
        },
      }),
    ])

    // 计算净胜分和参赛场次
    const standings = teams.map((t) => ({
      ...t,
      scoreDiff: t.scoreFor - t.scoreAgainst,
      played: t.wins + t.draws + t.losses,
    }))

    // 单次遍历统计所有比赛状态（避免多次 filter）
    let finishedMatches = 0
    let ongoingMatches = 0
    let pendingMatches = 0
    const totalMatches = allMatches.length
    for (const m of allMatches) {
      if (m.status === 'finished') finishedMatches++
      else if (m.status === 'ongoing') ongoingMatches++
      else if (m.status === 'pending') pendingMatches++
    }

    // 单次遍历同时统计最佳辩手和评委评分（减少一次循环）
    const bestDebaterCount: Record<string, number> = {}
    const judgeScores: Record<string, number> = {}
    for (const s of scores) {
      // 统计评委评分
      if (s.judgeName) {
        judgeScores[s.judgeName] = (judgeScores[s.judgeName] || 0) + 1
      }
      // 统计最佳辩手
      if (s.bestDebaterA) {
        bestDebaterCount[s.bestDebaterA] = (bestDebaterCount[s.bestDebaterA] || 0) + 1
      }
      if (s.bestDebaterB) {
        bestDebaterCount[s.bestDebaterB] = (bestDebaterCount[s.bestDebaterB] || 0) + 1
      }
    }

    const bestDebaters = Object.entries(bestDebaterCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // 前10名

    const judgeRankings = Object.entries(judgeScores)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // ════════ 5. 分组积分榜（如有分组） ════════
    type StandingItem = (typeof standings)[number]
    const groups = new Map<string, StandingItem[]>()
    for (const team of standings) {
      if (team.groupLabel) {
        if (!groups.has(team.groupLabel)) {
          groups.set(team.groupLabel, [])
        }
        groups.get(team.groupLabel)!.push(team)
      }
    }
    const groupStandings = Array.from(groups.entries()).map(([group, list]) => ({
      group,
      teams: list.sort((a, b) => b.points - a.points || b.wins - a.wins),
    }))

    return {
      success: true,
      data: {
        // 赛事基本信息
        tournament: {
          id: tournament.id,
          name: tournament.name,
          format: tournament.format,
          status: tournament.status,
          organizer: tournament.team?.name ?? '',
        },
        // 积分榜
        standings,
        // 分组积分榜
        groupStandings,
        // 比赛统计
        matchStats: {
          total: totalMatches,
          finished: finishedMatches,
          ongoing: ongoingMatches,
          pending: pendingMatches,
          progress: totalMatches > 0 ? Math.round((finishedMatches / totalMatches) * 100) : 0,
        },
        // 最佳辩手榜
        bestDebaters,
        // 评委评分榜
        judgeRankings,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Standings error:', error)
    throw createError({ statusCode: 500, message: '获取统计数据失败' })
  }
})
