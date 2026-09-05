import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import { canWriteTournament } from '../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion
    const user = await getUserFromEventWithSession(event, prisma)
    const id = getRouterParam(event, 'id')!
    const {
      round,
      orderNum,
      teamA,
      teamB,
      scheduledAt,
      status,
      currentVersion, // 新增：乐观锁版本号，由前端传入当前持有的 version
    } = await readBody<{
      round?: string
      orderNum?: number
      teamA?: string
      teamB?: string
      scheduledAt?: string
      status?: string
      currentVersion?: number
    }>(event)

    // 修复：使用 findFirst 配合 deletedAt: null 过滤软删除记录
    const match = await prisma.match.findFirst({
      where: { id, deletedAt: null },
      include: { tournament: { include: { team: true } } },
    })

    if (!match) throw createError({ statusCode: 404, message: '场次不存在或已删除' })

    // 修复：使用统一的权限判定函数，避免内联权限逻辑
    if (!match.tournament || !canWriteTournament(user, match.tournament, match.tournament.team)) {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    // 修复：乐观锁校验，避免并发覆盖
    if (currentVersion !== undefined && currentVersion !== match.version) {
      throw createError({
        statusCode: 409,
        message: '数据版本冲突，请刷新后重试',
      })
    }

    // 修复：使用 updateMany 配合 version 条件实现乐观锁更新
    const updateResult = await prisma.match.updateMany({
      where: { id, deletedAt: null, version: match.version },
      data: {
        round: round ?? match.round,
        orderNum: orderNum ?? match.orderNum,
        teamA: teamA !== undefined ? teamA : match.teamA,
        teamB: teamB !== undefined ? teamB : match.teamB,
        scheduledAt:
          scheduledAt !== undefined
            ? scheduledAt
              ? new Date(scheduledAt)
              : null
            : match.scheduledAt,
        status: status ?? match.status,
        version: { increment: 1 },
      },
    })

    if (updateResult.count === 0) {
      throw createError({
        statusCode: 409,
        message: '数据版本冲突，请刷新后重试',
      })
    }

    const updated = await prisma.match.findUnique({ where: { id } })

    return {
      id: updated!.id,
      round: updated!.round,
      orderNum: updated!.orderNum,
      teamA: updated!.teamA,
      teamB: updated!.teamB,
      winner: updated!.winner,
      scoreA: updated!.scoreA,
      scoreB: updated!.scoreB,
      status: updated!.status,
      scheduledAt: updated!.scheduledAt,
      version: updated!.version,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update match error:', error)
    throw createError({ statusCode: 500, message: '更新场次信息失败' })
  }
})
