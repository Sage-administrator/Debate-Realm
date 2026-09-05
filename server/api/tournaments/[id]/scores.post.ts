// ════════════════════════════════════════════════════
// POST /api/tournaments/[id]/scores — 提交评委评分
// 权限：
//   1. 赛事管理员/子账号（可代录任何评委的评分）
//   2. 赛事评委名单中的评委（仅能提交自己的评分）
// 请求体：{ matchId, judgeName, dimensions, reason, scoreTeamA, scoreTeamB, winner, bestDebaterA?, bestDebaterB? }
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { canWriteTournament } from '../../../utils/tournament-auth'
import { submitScore } from '../../../lib/bot-scoring'
import { notifyScoreSubmitted } from '../../../lib/bot-notifications'

export default defineEventHandler(async (event) => {
  try {
    const tournamentId = getRouterParam(event, 'id')!

    // 获取赛事信息用于权限校验
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        team: true,
        judges: { select: { name: true } },
      },
    })

    if (!tournament) {
      throw createError({ statusCode: 404, message: '赛事不存在' })
    }

    // 读取请求体（提前读取，因为权限判断需要 judgeName）
    const body = await readBody(event)
    const { matchId, judgeName } = body

    if (!matchId || !judgeName) {
      throw createError({ statusCode: 400, message: '缺少必要参数：matchId、judgeName' })
    }

    // ── 权限判断 ──
    // 策略1：赛事管理员/子账号（使用 getUserFromEventWithSession 校验 tokenVersion）
    let isAdmin = false
    try {
      const currentUser = await getUserFromEventWithSession(event, prisma)
      isAdmin = canWriteTournament(currentUser, tournament, tournament.team)
    } catch {
      // 未登录或 token 无效，继续尝试评委身份
    }

    if (isAdmin) {
      // 管理员可代录任何评委的评分，直接放行
    } else {
      // 策略2：评委身份校验 —— 必须在赛事评委名单中
      const judgeNames = tournament.judges.map((j) => j.name)
      if (!judgeNames.includes(judgeName)) {
        throw createError({
          statusCode: 403,
          message: '您不在该赛事的评委名单中，无法提交评分',
        })
      }
      // 评委只能提交自己的评分（judgeName 必须和自己的名字一致，这里 judgeName 就是本人）
      // 注：这里用姓名做简单校验，生产环境建议结合评委账号体系
    }

    // 从已读取的 body 中解构剩余字段
    const { dimensions, reason, scoreTeamA, scoreTeamB, winner, bestDebaterA, bestDebaterB } = body

    if (!matchId || !judgeName || !dimensions) {
      throw createError({
        statusCode: 400,
        message: '缺少必要参数：matchId、judgeName、dimensions',
      })
    }

    if (typeof scoreTeamA !== 'number' || typeof scoreTeamB !== 'number') {
      throw createError({ statusCode: 400, message: 'scoreTeamA 和 scoreTeamB 必须是数字' })
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
      throw createError({ statusCode: 400, message: result.message })
    }

    // 通过 Bot 发送评分提交通知（异步，不阻塞响应）
    notifyScoreSubmitted(prisma, matchId, judgeName).catch((err) => {
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
    throw createError({ statusCode: 500, message: '评分提交失败' })
  }
})
