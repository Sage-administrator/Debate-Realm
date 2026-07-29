/**
 * POST /api/tournaments/[id]/matches — 创建比赛
 * 使用共享 Schema 校验请求体 (#shared/schemas/match)
 */
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'
import { CreateMatchRequest } from '../../../../shared/schemas/match'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!

    // 使用共享 Schema 校验请求体（前后端同一份类型定义）
    const { round, orderNum, teamA, teamB, scheduledAt } =
      await validateBody(event, CreateMatchRequest)

    if (teamA && teamB && teamA.trim() === teamB.trim()) {
      throw createError({ statusCode: 400, message: '两支队伍不能相同' })
    }

    // 权限
    await requireWriteTournament(event, prisma, id)

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
      code: 0, message: 'success',
      data: {
        id: match.id, round: match.round, orderNum: match.orderNum,
        teamA: match.teamA, teamB: match.teamB, status: match.status,
        scheduledAt: match.scheduledAt, version: match.version,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Create match error:', error)
    throw createError({ statusCode: 500, message: '创建场次失败' })
  }
})
