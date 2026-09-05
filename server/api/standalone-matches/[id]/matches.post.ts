import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)
    const id = getRouterParam(event, 'id')!
    const { round, orderNum, teamA, teamB, scheduledAt } = await readBody<{
      round: string
      orderNum: number
      teamA?: string
      teamB?: string
      scheduledAt?: string
    }>(event)

    if (!round || orderNum === undefined)
      throw createError({ statusCode: 400, message: '轮次和顺序不能为空' })

    const match = await prisma.standaloneMatch.findUnique({ where: { id } })
    if (!match) throw createError({ statusCode: 404, message: '独立赛事不存在' })
    if (match.userId !== user.userId) throw createError({ statusCode: 403, message: '权限不足' })

    const newMatch = await prisma.match.create({
      data: {
        standaloneMatchId: id,
        round,
        orderNum,
        teamA: teamA || null,
        teamB: teamB || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'pending',
      },
    })

    setResponseStatus(event, 201)
    return {
      id: newMatch.id,
      round: newMatch.round,
      orderNum: newMatch.orderNum,
      teamA: newMatch.teamA,
      teamB: newMatch.teamB,
      status: newMatch.status,
      scheduledAt: newMatch.scheduledAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Create match error:', error)
    throw createError({ statusCode: 500, message: '创建场次失败' })
  }
})
