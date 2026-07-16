// =====================================================================
// 自动赛程生成 API
// POST /api/tournaments/{id}/matches/generate
// 功能：
//   - 根据赛制自动生成比赛对阵表（支持 6 种赛制）
//   - 支持 seed（种子序号）用于平衡分组
//   - 生成前可选择是否清空已有赛程（默认清空）
// =====================================================================

import { readBody } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'
import { generateBracket, type TournamentFormat, type GenerateOptions, type MatchInput } from '../../../../utils/bracket-generator'

export default defineEventHandler(async (event) => {
  try {
    // ── 1. 鉴权：登录 + 是赛事管理员 / 团队 owner ──
    const tournamentId = getRouterParam(event, 'id')!
    const { tournament } = await requireWriteTournament(event, prisma, tournamentId)

    // ── 2. 解析请求体 ──
    const body = await readBody<{
      format: TournamentFormat
      teams: Array<{ name: string; seed?: number }>
      // 通用参数
      seedMethod?: 'random' | 'rating' | 'name'
      byeHandling?: 'auto' | 'manual'
      // 循环赛
      roundRobinMode?: 'single' | 'double'
      // 双败淘汰
      enableRevivalFinal?: boolean
      // 瑞士制
      rounds?: number
      pairingAlgo?: 'standard' | 'simplified'
      // 小组+淘汰赛
      groupSize?: number
      promotePerGroup?: number
      knockoutFormat?: 'single_elimination'
      // 操作参数
      clearExisting?: boolean
    }>(event)

    const {
      format,
      teams,
      seedMethod = 'rating',
      roundRobinMode = 'single',
      enableRevivalFinal = false,
      rounds,
      pairingAlgo = 'simplified',
      groupSize = 4,
      promotePerGroup = 2,
      clearExisting = true,
    } = body

    // ── 3. 基础参数校验 ──
    const validFormats: TournamentFormat[] = [
      'single_elimination',
      'double_elimination',
      'round_robin',
      'page_playoff',
      'swiss',
      'group_knockout',
    ]
    if (!validFormats.includes(format)) {
      throw createError({ statusCode: 400, message: `不支持的赛制：${format}` })
    }

    if (!teams || teams.length < 2) {
      throw createError({ statusCode: 400, message: '至少需要 2 支队伍' })
    }

    // 队伍名去重校验
    const seenNames = new Set<string>()
    for (const team of teams) {
      if (!team.name || !team.name.trim()) {
        throw createError({ statusCode: 400, message: '队伍名不能为空' })
      }
      const trimmed = team.name.trim()
      if (seenNames.has(trimmed)) {
        throw createError({ statusCode: 400, message: `队伍名 "${trimmed}" 重复` })
      }
      seenNames.add(trimmed)
    }

    // 赛制特定校验
    if (format === 'page_playoff' && teams.length < 4) {
      throw createError({ statusCode: 400, message: '佩寄制至少需要 4 支队伍' })
    }
    if (format === 'group_knockout') {
      const minNeed = Math.max(groupSize * 2, 4)
      if (teams.length < minNeed) {
        throw createError({ statusCode: 400, message: `小组+淘汰赛至少需要 ${minNeed} 支队伍（每组 ${groupSize} 支，至少 2 组）` })
      }
    }
    if (format === 'swiss' && rounds && (rounds < 1 || rounds > 20)) {
      throw createError({ statusCode: 400, message: '瑞士制轮数必须在 1-20 之间' })
    }

    // ── 4. 使用 bracket-generator 生成赛程 ──
    const normalizedTeams = teams.map((t, i) => ({
      name: t.name.trim(),
      seed: t.seed ?? i + 1,
    }))

    const generateOpts: GenerateOptions = {
      format,
      teams: normalizedTeams,
      seedMethod,
      roundRobinMode,
      enableRevivalFinal,
      rounds,
      pairingAlgo,
      groupSize,
      promotePerGroup,
    }

    const result = generateBracket(generateOpts)

    // ── 5. 写入数据库（事务保证原子性 + createMany 批量插入） ──
    const matchData = result.matches.map((match: MatchInput) => ({
      tournamentId,
      round: match.round,
      orderNum: match.orderNum,
      teamA: match.teamA,
      teamB: match.teamB,
      status: 'pending',
      promotedFromA: match.promotedFromA,
      promotedFromB: match.promotedFromB,
      isBye: match.isBye,
    }))

    const savedMatches = await prisma.$transaction(async (tx) => {
      if (clearExisting) {
        await tx.match.deleteMany({ where: { tournamentId } })
      }
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { format },
      })
      // SQLite 不支持 createManyAndReturn，使用 createMany + findMany
      await tx.match.createMany({ data: matchData })
      return await tx.match.findMany({
        where: { tournamentId },
        select: { id: true },
        orderBy: [{ round: 'asc' }, { orderNum: 'asc' }],
      })
    })

    // ── 7. 返回结果 ──
    return {
      code: 0,
      message: `赛程生成成功：${result.formatLabel}，共 ${result.totalMatches} 场比赛`,
      data: {
        format: result.format,
        formatLabel: result.formatLabel,
        totalMatches: result.totalMatches,
        roundCount: result.roundCount,
        matchIds: savedMatches.map((m: any) => m.id),
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Generate bracket error:', error)
    throw createError({ statusCode: 500, message: '赛程生成失败' })
  }
})
