// =====================================================================
// 录入比赛结果 API
// POST /api/matches/{id}/result
// 功能：
//   - 录入比分和胜者（胜方或平局）
//   - 更新比赛状态为 finished
//   - 自动晋级：对于淘汰赛，胜者自动填入下一轮对应位置
//   - 积分累计：更新 TournamentTeam 的积分/胜负记录
// =====================================================================

import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'
import {
  advanceWinnerToNextRound,
  autoPairNextSwissRound,
  autoPromoteFromGroupsToKnockout,
} from '../../../utils/bracket-generator'
import { notifyMatchResult } from '../../../lib/bot-notifications'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const id = getRouterParam(event, 'id')!
    // 新增：bestDebaterA / bestDebaterB + judge 支持评委姓名
    const { winner, scoreA, scoreB, bestDebaterA, bestDebaterB, judge } = await readBody<{
      winner: string; scoreA: number; scoreB: number
      bestDebaterA?: string | null
      bestDebaterB?: string | null
      judge?: string | null
    }>(event)

    if (!winner || scoreA === undefined || scoreB === undefined) {
      throw createError({ statusCode: 400, statusMessage: '40010赛果信息不完整' })
    }
    if (!['A', 'B', 'draw'].includes(winner)) {
      throw createError({ statusCode: 400, statusMessage: '40011无效的获胜方' })
    }

    // 获取比赛信息（用于权限校验和晋级计算）
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        tournament: { include: { team: true } },
      },
    })

    if (!match) throw createError({ statusCode: 404, statusMessage: '40001场次不存在' })

    // 权限校验：仅系统管理员或所属团队的管理员可以录赛果
    const isAdmin = user.role === 'system_admin' || (match.tournament && match.tournament.team.adminId === user.userId)
    if (!isAdmin) throw createError({ statusCode: 403, statusMessage: '40003权限不足' })

    // 计算胜者队伍名
    const resolvedWinner = winner === 'draw' ? null : (winner === 'A' ? match.teamA : match.teamB)

    // ====== 新增：根据 bestDebaterMode 校验最佳辩手合法性 ======
    const tournament = match.tournament
    if (!tournament) throw createError({ statusCode: 400, statusMessage: '赛事不存在' })
    const bdMode = (tournament as any)?.bestDebaterMode || 'both'

    let finalBestA = bestDebaterA
    let finalBestB = bestDebaterB
    if (bdMode === 'winner_only' && winner !== 'draw') {
      // 仅胜方可有最佳辩手：败方置 null
      if (winner === 'A') finalBestB = null
      if (winner === 'B') finalBestA = null
    }
    // ============================================================

    // 更新比赛结果（包含最佳辩手 + 评委）
    const updated = await prisma.match.update({
      where: { id },
      data: {
        winner: resolvedWinner,
        scoreA, scoreB, status: 'finished',
        bestDebaterA: finalBestA ?? null,
        bestDebaterB: finalBestB ?? null,
        judge: judge ?? null,  // 评委姓名
      },
    })

    // 4.2 积分累计逻辑（非手动赛制才会累计积分）
    const format = tournament.format || 'single_elimination'
    if (format !== 'manual') {
      await updateTeamPoints(tournament.id, match, winner, scoreA, scoreB, tournament as any)
    }

    // ── 自动晋级：根据赛事 format 选择不同的晋级策略 ──
    const advanceResult: { advanced: boolean; targetMatchId?: string; error?: string; info?: string; extra?: any } = { advanced: false }

    // 4.4 佩寄制晋级支持
    if (format === 'page_playoff' && winner !== 'draw') {
      const r = await handlePagePlayoffPromotion(tournament.id, match)
      if (r.advanced) {
        advanceResult.advanced = true
        advanceResult.targetMatchId = r.targetMatchId
        advanceResult.info = r.info
      } else if (r.error) {
        advanceResult.error = r.error
      }
    } else {
      // 非佩寄制：沿用原有逻辑
      const isGroupMatch = /^[A-H]组-/.test(match.round)
      const isSwissMatch = /^第\d+轮$/.test(match.round)

      // 通用晋级尝试（支持单败/双败/佩寄制/小组淘汰赛的淘汰赛阶段）
      if (winner !== 'draw' && !isSwissMatch && format !== 'page_playoff') {
        const r = await advanceWinnerToNextRound(tournament.id, {
          id: match.id,
          round: match.round,
          orderNum: match.orderNum,
          winner: resolvedWinner,
          teamA: match.teamA,
          teamB: match.teamB,
        })
        if (r.advanced) {
          advanceResult.advanced = true
          advanceResult.targetMatchId = r.targetMatchId
          advanceResult.info = '已将 "' + r.promotedTeam + '" 晋级到 ' + (r.targetRound || '下一轮')
        } else if (r.error) {
          advanceResult.error = r.error
        }
      }

      // 额外处理：瑞士制整轮重配对
      if (isSwissMatch) {
        const extra = await autoPairNextSwissRound(tournament.id)
        advanceResult.extra = extra
        if (extra.paired > 0) {
          advanceResult.advanced = true
          advanceResult.info = extra.info
        }
      }

      // 额外处理：小组→淘汰赛出线
      if (isGroupMatch) {
        // 每组取前 1 名晋级（可通过 tournament.meta 调整；此处默认为 1）
        const promotePerGroup = (tournament as any)?.promotePerGroup || 1
        const extra = await autoPromoteFromGroupsToKnockout(tournament.id, promotePerGroup)
        advanceResult.extra = extra
        if (extra.promoted && extra.promoted.length > 0) {
          advanceResult.advanced = true
          advanceResult.info = extra.info
        }
      }
    }

    // 通过 Bot 发送比赛结果通知（异步，不阻塞响应）
    notifyMatchResult(prisma, id).catch(err => {
      console.error('[Result] Bot 通知发送失败:', err)
    })

    return {
      code: 0,
      message: 'success',
      data: {
        id: updated.id,
        winner: updated.winner,
        scoreA: updated.scoreA,
        scoreB: updated.scoreB,
        status: updated.status,
        advanced: advanceResult,
        format,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Submit result error:', error)
    throw createError({ statusCode: 500, statusMessage: '50000登记赛果失败' })
  }
})

// =====================================================================
// 积分累计逻辑
// =====================================================================
async function updateTeamPoints(
  tournamentId: string,
  match: any,
  winner: string,
  scoreA: number,
  scoreB: number,
  tournament: any,
) {
  const winPoints = tournament.winPoints ?? tournament.meta?.winPoints ?? 3
  const teamA = match.teamA
  const teamB = match.teamB
  if (!teamA || !teamB) return

  // 更新两队 TournamentTeam 记录
  if (winner === 'draw') {
    await Promise.all([
      prisma.tournamentTeam.updateMany({
        where: { tournamentId, name: teamA },
        data: {
          draws: { increment: 1 },
          points: { increment: 1 },
          scoreFor: { increment: scoreA },
          scoreAgainst: { increment: scoreB },
        },
      }),
      prisma.tournamentTeam.updateMany({
        where: { tournamentId, name: teamB },
        data: {
          draws: { increment: 1 },
          points: { increment: 1 },
          scoreFor: { increment: scoreB },
          scoreAgainst: { increment: scoreA },
        },
      }),
    ])
  } else {
    const winnerTeam = winner === 'A' ? teamA : teamB
    const loserTeam = winner === 'A' ? teamB : teamA
    const winnerScore = winner === 'A' ? scoreA : scoreB
    const loserScore = winner === 'A' ? scoreB : scoreA

    await Promise.all([
      prisma.tournamentTeam.updateMany({
        where: { tournamentId, name: winnerTeam },
        data: {
          wins: { increment: 1 },
          points: { increment: winPoints },
          scoreFor: { increment: winnerScore },
          scoreAgainst: { increment: loserScore },
        },
      }),
      prisma.tournamentTeam.updateMany({
        where: { tournamentId, name: loserTeam },
        data: {
          losses: { increment: 1 },
          scoreFor: { increment: loserScore },
          scoreAgainst: { increment: winnerScore },
        },
      }),
    ])
  }
}

// =====================================================================
// 佩寄制外部晋级逻辑（R1、R2、R3 晋级关系处理
// =====================================================================
async function handlePagePlayoffPromotion(
  tournamentId: string,
  finishedMatch: any,
): Promise<{ advanced: boolean; targetMatchId?: string; info?: string; error?: string }> {
  const { prisma } = await import('../../../lib/prisma')

  const roundLabel = finishedMatch.round
  const isR1 = roundLabel === 'R1' || roundLabel.startsWith('R1')
  const isR2 = roundLabel === 'R2' || roundLabel.startsWith('R2')
  const isR3 = roundLabel === 'R3' || roundLabel.startsWith('R3')

  // 获取当前比赛的胜者
  const winner = finishedMatch.winner

  if (isR1) {
    // R1 胜者 → R2 的 teamA 或 teamB（根据 orderNum 决定）
    const targetSlot = finishedMatch.orderNum === 1 ? 'teamA' : 'teamB'
    const targetMatch = await prisma.match.findFirst({
      where: { tournamentId, round: 'R2' },
    })
    if (!targetMatch) {
      return { advanced: false, error: '未找到 R2 比赛记录' }
    }
    const updateData: any = { version: { increment: 1 } }
    updateData[targetSlot] = winner
    updateData[targetSlot === 'teamA' ? 'promotedFromA' : 'promotedFromB'] = finishedMatch.id
    await prisma.match.update({
      where: { id: targetMatch.id },
      data: updateData,
    })
    const slotLabel = targetSlot === 'teamA' ? 'A' : 'B'
    const infoText = '已将 "' + winner + '" 晋级到 R2 ' + slotLabel + ' 位置'
    return { advanced: true, targetMatchId: targetMatch.id, info: infoText }
  }

  if (isR2) {
    // R2 胜者 → R4 决赛；R2 败者 → R3
    const r2Loser = finishedMatch.winner === finishedMatch.teamA ? finishedMatch.teamB : finishedMatch.teamA

    // R2 胜者晋级到 R4
    const finalMatch = await prisma.match.findFirst({
      where: { tournamentId, round: 'R4（决赛）' },
    })
    let finalMatchId = ''
    if (finalMatch) {
      finalMatchId = finalMatch.id
      const updateData: any = {
        teamA: winner,
        promotedFromA: finishedMatch.id,
        version: { increment: 1 },
      }
      await prisma.match.update({ where: { id: finalMatch.id }, data: updateData })
    }

    // R2 败者 → R3
    const r3Match = await prisma.match.findFirst({
      where: { tournamentId, round: 'R3' },
    })
    if (r3Match) {
      const r3Update: any = {
        teamA: r2Loser,
        promotedFromA: finishedMatch.id,
        version: { increment: 1 },
      }
      await prisma.match.update({ where: { id: r3Match.id }, data: r3Update })
    }

    const infoText = 'R2 胜者 "' + winner + '" 晋级到 R4 决赛，败者 "' + r2Loser + '" 降级到 R3'
    return { advanced: true, targetMatchId: finalMatchId, info: infoText }
  }

  if (isR3) {
    // R3 胜者 → R4 决赛 teamB
    const finalMatch = await prisma.match.findFirst({
      where: { tournamentId, round: 'R4（决赛）' },
    })
    if (!finalMatch) {
      return { advanced: false, error: '未找到 R4 决赛记录' }
    }
    await prisma.match.update({
      where: { id: finalMatch.id },
      data: { teamB: winner, promotedFromB: finishedMatch.id, version: { increment: 1 } },
    })
    const infoR3 = 'R3 胜者 "' + winner + '" 晋级到 R4 决赛'
    return { advanced: true, targetMatchId: finalMatch.id, info: infoR3 }
  }

  return { advanced: false, error: '未知的轮次格式' }
}
