// ════════════════════════════════════════════════════
// POST /api/matches/[id]/start — 开始比赛
// 将比赛状态从 pending 改为 in_progress，并发送 Bot 通知
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'
import { notifyMatchStart } from '../../../lib/bot-notifications'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const matchId = getRouterParam(event, 'id')!

    // 获取比赛信息（用于权限校验）
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { include: { team: true } },
      },
    })

    if (!match) throw createError({ statusCode: 404, statusMessage: '比赛不存在' })

    // 权限校验
    const isAdmin = user.role === 'system_admin' || (match.tournament && match.tournament.team.adminId === user.userId)
    if (!isAdmin) throw createError({ statusCode: 403, statusMessage: '权限不足' })

    // 校验比赛状态
    if (match.status !== 'pending') {
      throw createError({ statusCode: 400, statusMessage: `比赛状态为「${match.status}」，无法开始` })
    }

    // 更新比赛状态为进行中
    const updated = await prisma.match.update({
      where: { id: matchId },
      data: { status: 'in_progress' },
    })

    // 通过 Bot 发送比赛开始通知（异步）
    notifyMatchStart(prisma, matchId).catch(err => {
      console.error('[Match Start] Bot 通知发送失败:', err)
    })

    return {
      success: true,
      message: '比赛已开始',
      data: {
        id: updated.id,
        status: updated.status,
        teamA: updated.teamA,
        teamB: updated.teamB,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('[Match Start] 开始比赛失败:', error)
    throw createError({ statusCode: 500, statusMessage: '开始比赛失败' })
  }
})