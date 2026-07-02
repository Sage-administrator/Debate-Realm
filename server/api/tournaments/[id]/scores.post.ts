// ════════════════════════════════════════════════════
// POST /api/tournaments/[id]/scores — 提交评委评分
// 请求体：{ matchId, judgeName, dimensions, reason, scoreTeamA, scoreTeamB, winner, bestDebaterA?, bestDebaterB? }
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { canWriteTournament } from '../../../utils/tournament-auth'
import { submitScore } from '../../../lib/bot-scoring'
import { notifyScoreSubmitted } from '../../../lib/bot-notifications'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion，
    // 否则被踢下线的旧 token 在 7 天过期前仍可提交评分
    const currentUser = await getUserFromEventWithSession(event, prisma)
    const tournamentId = getRouterParam(event, 'id')!

    // 获取赛事信息用于权限校验
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { team: true },
    })

    if (!tournament) {
      throw createError({ statusCode: 404, statusMessage: '赛事不存在' })
    }

    // 修复：使用统一的权限判定函数，避免仅校验 role 而未校验 teamId
    if (!canWriteTournament(currentUser, tournament, tournament.team)) {
      throw createError({ statusCode: 403, statusMessage: '仅赛事所属团队管理员可提交评分' })
    }

    const body = await readBody(event)

    const { matchId, judgeName, dimensions, reason, scoreTeamA, scoreTeamB, winner, bestDebaterA, bestDebaterB } = body

    if (!matchId || !judgeName || !dimensions) {
      throw createError({ statusCode: 400, statusMessage: '缺少必要参数：matchId、judgeName、dimensions' })
    }

    if (typeof scoreTeamA !== 'number' || typeof scoreTeamB !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'scoreTeamA 和 scoreTeamB 必须是数字' })
    }

    const result = await submitScore(prisma, {
      matchId,
      tournamentId,
      judgeName,
      dimensions,
      reason,
      scoreTeamA,
      scoreTeamB,
      winner,
      bestDebaterA,
      bestDebaterB,
    })

    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: result.message })
    }

    // 通过 Bot 发送评分提交通知（异步，不阻塞响应）
    notifyScoreSubmitted(prisma, matchId, judgeName).catch(err => {
      console.error('[Scores] Bot 通知发送失败:', err)
    })

    return {
      success: true,
      message: result.message,
      scoreId: result.scoreId,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Scores Submit] 评分提交失败:', error)
    throw createError({ statusCode: 500, statusMessage: '评分提交失败' })
  }
})