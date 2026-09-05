// =====================================================================
// 抽签 API —— 分组抽签 + 辩题抽签 + 正反方抽签
// POST /api/tournaments/{id}/draw-lots
//
// 请求体：
//   {
//     drawType: 'groups' | 'topics_sides' | 'all',  // 要执行哪种抽签
//     groupCount?: number,                          // 分组数量（用于 groups / all）
//     topicPool?: string[],                         // 辩题库（覆盖数据库中已有值）
//     bestDebaterMode?: 'both' | 'winner_only'      // 最佳辩手模式
//   }
//
// 功能：
//   1. 更新 Tournament 的配置（topicPool / groupCount / bestDebaterMode）
//   2. 若 drawType 包含 'groups'：
//        - 洗牌所有 TournamentTeam，均匀分配到各组
//        - 更新每条 TournamentTeam.groupLabel
//        - 若已生成小组赛比赛：根据分组更新 round 前缀（A组-第1轮 ...）
//   3. 若 drawType 包含 'topics_sides'：
//        - 遍历该赛事所有 Match
//        - 为每个 Match 随机选择一个辩题（从 topicPool，尽量不重复）
//        - 为每个 Match 随机决定哪一方是正方（affirmativeSide）
//        - 更新 Match.topic 和 Match.affirmativeSide
// =====================================================================

import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { canWriteTournament } from '../../../utils/tournament-auth'
import { runDrawLots } from '../../../utils/bracket-generator'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion，
    // 否则被踢下线的旧 token 在 7 天过期前仍可执行抽签操作
    const user = await getUserFromEventWithSession(event, prisma)
    const id = getRouterParam(event, 'id')!

    const body = await readBody<{
      drawType: 'groups' | 'topics_sides' | 'all'
      groupCount?: number
      topicPool?: { pro: string; con: string }[]
      bestDebaterMode?: 'both' | 'winner_only'
    }>(event)

    const drawType = body.drawType || 'all'

    // 1) 单次查询：加载赛事和所有关联数据，同时用于权限检查
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: true, matches: true, team: true },
    })
    if (!tournament) {
      throw createError({ statusCode: 404, message: '赛事不存在' })
    }

    // 权限校验：使用统一的权限判定函数
    if (!canWriteTournament(user, tournament, tournament.team)) {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    // 2) 更新赛事配置（topicPool/groupCount/bestDebaterMode）
    const updateData: any = {}
    if (body.topicPool !== undefined) {
      updateData.topicPool = JSON.stringify(body.topicPool)
    }
    if (body.groupCount !== undefined) {
      updateData.groupCount = body.groupCount
    }
    if (body.bestDebaterMode) {
      updateData.bestDebaterMode = body.bestDebaterMode
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.tournament.update({ where: { id }, data: updateData })
    }

    // 3) 准备抽签数据
    const teams = tournament.teams.map((t) => t.name)
    const topicPool: { pro: string; con: string }[] = body.topicPool
      ? body.topicPool
      : (() => {
          try {
            if (!tournament.topicPool) return []
            const parsed = JSON.parse(tournament.topicPool)
            // 兼容旧格式：字符串数组
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
              return parsed.map((s: string) => ({ pro: s, con: s }))
            }
            return parsed
          } catch {
            return []
          }
        })()
    const groupCount = body.groupCount ?? tournament.groupCount ?? 0
    const matches = tournament.matches.map((m) => ({
      id: m.id,
      teamA: m.teamA,
      teamB: m.teamB,
      round: m.round,
    }))

    // 4) 运行抽签核心逻辑
    const drawResult = runDrawLots({
      teams,
      topicPool,
      matches,
      groupCount,
      drawType,
    })

    // 5) 将抽签结果写入数据库
    // 修复：原代码在循环内逐条 await update，且未使用事务，
    // 任一步骤失败将导致抽签数据部分写入不一致。
    // 改为使用 prisma.$transaction 批量执行，保证原子性 + 性能提升。
    await prisma.$transaction(async (tx) => {
      // 5a) 分组：更新 TournamentTeam.groupLabel 和 seed
      if (drawResult.groupAssignments.length > 0) {
        // 并发批量更新所有队伍的分组
        await Promise.all(
          drawResult.groupAssignments.map((ga) =>
            tx.tournamentTeam.updateMany({
              where: { tournamentId: id, name: ga.team },
              data: { groupLabel: ga.group, seed: ga.seed },
            }),
          ),
        )

        // 额外处理：如果是小组+淘汰赛 / 小组循环赛，
        // 已有的比赛 round 标签可能需要更新为 "A组-第1轮" 格式
        // 这里的做法是：读取 match 的 teamA/teamB → 找到它们所在组 → 重命名 round
        // 仅在比赛尚无明确分组标签（如仅"第1轮"）时触发
        const plainMatches = tournament.matches.filter(
          (m) => !/^[A-H]组-/.test(m.round) && m.teamA && m.teamB,
        )
        if (plainMatches.length > 0) {
          // 构造 team → group 的映射
          const teamToGroup: Record<string, string> = {}
          for (const ga of drawResult.groupAssignments) teamToGroup[ga.team] = ga.group

          // 并发批量更新比赛 round 标签
          const matchUpdates = plainMatches
            .map((m) => {
              const groupA = m.teamA ? teamToGroup[m.teamA] : null
              const groupB = m.teamB ? teamToGroup[m.teamB] : null
              // 只有同组时才重命名
              if (groupA && groupB && groupA === groupB) {
                return tx.match.update({
                  where: { id: m.id },
                  data: { round: `${groupA}-${m.round}` },
                })
              }
              return null
            })
            .filter((u): u is NonNullable<typeof u> => u !== null)

          await Promise.all(matchUpdates)
        }
      }

      // 5b) 辩题 & 正反方：更新 Match.topic / Match.affirmativeSide
      if (drawResult.matchAssignments.length > 0) {
        await Promise.all(
          drawResult.matchAssignments.map((ma) =>
            tx.match.update({
              where: { id: ma.matchId },
              data: {
                topic: ma.topic || null,
                affirmativeSide: ma.affirmativeSide,
              },
            }),
          ),
        )
      }

      // 6) 缓存抽签结果到 tournament.assignments（便于前端查看历史）
      const snapshot = {
        drawnAt: new Date().toISOString(),
        drawType,
        ...drawResult,
      }
      await tx.tournament.update({
        where: { id },
        data: { assignments: JSON.stringify(snapshot) },
      })
    })

    return {
      success: true,
      info: drawResult.info,
      groupCount: drawResult.groupAssignments.length > 0 ? groupCount : tournament.groupCount,
      topicCount: topicPool.length,
      result: drawResult,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('draw-lots error:', error)
    throw createError({ statusCode: 500, message: error.message || '抽签失败' })
  }
})
