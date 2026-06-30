// ════════════════════════════════════════════════════
// POST /api/tournaments/[id]/scores — 提交评委评分
// 请求体：{ matchId, judgeName, dimensions, reason, scoreTeamA, scoreTeamB, winner, bestDebaterA?, bestDebaterB? }
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'
import { submitScore } from '../../../lib/bot-scoring'
import { notifyScoreSubmitted } from '../../../lib/bot-notifications'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)
    const tournamentId = getRouterParam(event, 'id')!

    // 权限校验
    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '仅团队管理员可提交评分' })
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