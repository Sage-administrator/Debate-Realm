import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const { round, orderNum, teamA, teamB, scheduledAt } = await readBody<{
      round: string; orderNum: number; teamA?: string; teamB?: string; scheduledAt?: string
    }>(event)

    if (!round || orderNum === undefined) throw createError({ statusCode: 400, statusMessage: '轮次和顺序不能为空' })
    if (teamA && teamB && teamA.trim() === teamB.trim()) throw createError({ statusCode: 400, statusMessage: '两支队伍不能相同' })

    // 权限：系统管理员 或 该赛事所属团队的管理员
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
    throw createError({ statusCode: 500, statusMessage: '创建场次失败' })
  }
})
