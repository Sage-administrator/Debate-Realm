// ════════════════════════════════════════════════════
// 评分系统核心模块
// 处理评委评分提交、评分查询、排名计算
// ════════════════════════════════════════════════════

import type { PrismaClient } from './generated/client'

// ---------- 评分维度定义 ----------

/** 默认评分维度（满分 100 分制） */
export const DEFAULT_DIMENSIONS = [
  { name: '逻辑论证', maxScore: 30 },
  { name: '语言表达', maxScore: 25 },
  { name: '团队配合', maxScore: 20 },
  { name: '辩驳能力', maxScore: 15 },
  { name: '整体表现', maxScore: 10 },
]

/** 评分维度输入类型 */
export interface ScoreDimension {
  name: string
  score: number
}

/** 评分提交参数 */
export interface SubmitScoreParams {
  matchId: string
  tournamentId: string
  judgeName: string
  dimensions: ScoreDimension[]
  reason?: string
  scoreTeamA: number
  scoreTeamB: number
  winner: 'teamA' | 'teamB' | 'draw'
  bestDebaterA?: string
  bestDebaterB?: string
}

// ---------- 评分提交 ----------

/**
 * 提交评委评分
 * 同一评委对同一比赛只能提交一次
 */
export async function submitScore(
  prisma: PrismaClient,
  params: SubmitScoreParams,
): Promise<{ success: boolean; message: string; scoreId?: string }> {
  // 校验比赛存在
  const match = await prisma.match.findUnique({
    where: { id: params.matchId, deletedAt: null },
    select: { id: true, tournamentId: true, teamA: true, teamB: true, status: true },
  })

  if (!match) {
    return { success: false, message: '比赛不存在或已删除' }
  }

  // 校验赛事归属
  if (match.tournamentId !== params.tournamentId) {
    return { success: false, message: '赛事 ID 不匹配' }
  }

  // 校验比赛状态
  if (match.status === 'completed') {
    return { success: false, message: '该比赛已完成评分，无法重复提交' }
  }

  // 校验评分维度
  if (!params.dimensions || params.dimensions.length === 0) {
    return { success: false, message: '请至少提供一个评分维度' }
  }

  // 校验总分
  const expectedTotal = params.dimensions.reduce((sum, d) => sum + d.score, 0)
  if (expectedTotal !== params.scoreTeamA + params.scoreTeamB) {
    return { success: false, message: `维度总分(${expectedTotal})与队伍总分(${params.scoreTeamA + params.scoreTeamB})不匹配` }
  }

  // 校验胜方
  if (!['teamA', 'teamB', 'draw'].includes(params.winner)) {
    return { success: false, message: 'winner 取值无效，可选：teamA、teamB、draw' }
  }

  try {
    // 创建评分记录
    const score = await prisma.matchScore.create({
      data: {
        matchId: params.matchId,
        tournamentId: params.tournamentId,
        judgeName: params.judgeName,
        dimensions: JSON.stringify(params.dimensions),
        reason: params.reason || null,
        scoreTeamA: params.scoreTeamA,
        scoreTeamB: params.scoreTeamB,
        winner: params.winner,
        bestDebaterA: params.bestDebaterA || null,
        bestDebaterB: params.bestDebaterB || null,
      },
    })

    // 自动更新比赛总分和排名
    await updateMatchScores(prisma, params.matchId)
    await recalculateRankings(prisma, params.tournamentId)

    console.log(`[Scoring] 评委「${params.judgeName}」提交评分，比赛 ${params.matchId}`)
    return { success: true, message: '评分提交成功', scoreId: score.id }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return { success: false, message: '该评委已对此比赛提交过评分' }
    }
    const msg = err instanceof Error ? err.message : '未知错误'
    return { success: false, message: `评分提交失败：${msg}` }
  }
}

/**
 * 更新比赛总分（汇总所有评委评分）
 */
async function updateMatchScores(prisma: PrismaClient, matchId: string): Promise<void> {
  // 修复：通过 join Match 过滤软删除记录，避免对已删除比赛累计评分
  const scores = await prisma.matchScore.findMany({
    where: {
      matchId,
      match: { deletedAt: null },
    },
  })

  if (scores.length === 0) return

  const totalA = scores.reduce((sum, s) => sum + s.scoreTeamA, 0)
  const totalB = scores.reduce((sum, s) => sum + s.scoreTeamB, 0)

  // 统计胜方
  const winnerVotes = { teamA: 0, teamB: 0, draw: 0 }
  for (const s of scores) {
    winnerVotes[s.winner as keyof typeof winnerVotes]++
  }

  let winner: string | null = null
  if (winnerVotes.teamA > winnerVotes.teamB) {
    winner = 'teamA'
  } else if (winnerVotes.teamB > winnerVotes.teamA) {
    winner = 'teamB'
  }
  // 票数相等则为平局，winner 为 null

  await prisma.match.update({
    where: { id: matchId },
    data: {
      scoreA: totalA,
      scoreB: totalB,
      winner,
      status: 'completed',
    },
  })
}

// ---------- 排名计算 ----------

/**
 * 重新计算赛事排名
 * 根据各队已完成的比赛计算：积分、胜场、平场、负场、净胜分
 */
export async function recalculateRankings(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<void> {
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
  })

  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: 'finished', // 修复：与 result.post.ts 保持一致，使用 'finished' 而非 'completed'
      deletedAt: null,
    },
    select: {
      teamA: true,
      teamB: true,
      winner: true,
      scoreA: true,
      scoreB: true,
    },
  })

  // 计算每队数据
  const stats: Record<string, { points: number; wins: number; draws: number; losses: number; scoreFor: number; scoreAgainst: number }> = {}

  for (const team of teams) {
    stats[team.name] = { points: 0, wins: 0, draws: 0, losses: 0, scoreFor: 0, scoreAgainst: 0 }
  }

  for (const match of matches) {
    if (!match.teamA || !match.teamB) continue

    const a = stats[match.teamA]
    const b = stats[match.teamB]
    if (!a || !b) continue

    a.scoreFor += match.scoreA
    a.scoreAgainst += match.scoreB
    b.scoreFor += match.scoreB
    b.scoreAgainst += match.scoreA

    if (match.winner === 'teamA') {
      a.wins++
      a.points += 3 // 胜 3 分
      b.losses++
      b.points += 0 // 负 0 分
    } else if (match.winner === 'teamB') {
      b.wins++
      b.points += 3
      a.losses++
      a.points += 0
    } else {
      // 平局
      a.draws++
      b.draws++
      a.points += 1
      b.points += 1
    }
  }

  // 修复：原代码在 for 循环内逐条 await update，N 支队伍就 N 次串行 DB 写入，
  // 且非事务原子操作。改为使用 $transaction + Promise.all 并发批量更新，
  // 既提升性能（一次往返），又保证原子性（全成功或全失败）。
  const updates = teams
    .map((team) => {
      const s = stats[team.name]
      if (!s) return null
      return prisma.tournamentTeam.update({
        where: { id: team.id },
        data: {
          points: s.points,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          scoreFor: s.scoreFor,
          scoreAgainst: s.scoreAgainst,
        },
      })
    })
    .filter((u): u is NonNullable<typeof u> => u !== null)

  await prisma.$transaction(updates)

  console.log(`[Ranking] 赛事 ${tournamentId} 排名已更新，共 ${teams.length} 支队伍`)
}

/**
 * 获取赛事排名列表
 * 排序规则：积分 > 净胜分 > 得分 > 队名
 */
export async function getRankings(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<{
  tournamentName: string
  rankings: Array<{
    rank: number
    name: string
    points: number
    wins: number
    draws: number
    losses: number
    scoreFor: number
    scoreAgainst: number
    scoreDiff: number
    matches: number
  }>
}> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true },
  })

  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    orderBy: [
      { points: 'desc' },
      { scoreFor: 'desc' },
    ],
  })

  // 排序：积分 > 净胜分 > 得分
  const sorted = teams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const diffA = a.scoreFor - a.scoreAgainst
    const diffB = b.scoreFor - b.scoreAgainst
    if (diffB !== diffA) return diffB - diffA
    return b.scoreFor - a.scoreFor
  })

  const rankings = sorted.map((team, index) => ({
    rank: index + 1,
    name: team.name,
    points: team.points,
    wins: team.wins,
    draws: team.draws,
    losses: team.losses,
    scoreFor: team.scoreFor,
    scoreAgainst: team.scoreAgainst,
    scoreDiff: team.scoreFor - team.scoreAgainst,
    matches: team.wins + team.draws + team.losses,
  }))

  return {
    tournamentName: tournament?.name || '未知赛事',
    rankings,
  }
}

// ---------- 评分查询 ----------

/**
 * 获取比赛的评分详情
 */
export async function getMatchScores(
  prisma: PrismaClient,
  matchId: string,
): Promise<{
  match: { teamA: string | null; teamB: string | null; winner: string | null }
  scores: Array<{
    judgeName: string
    dimensions: ScoreDimension[]
    reason: string | null
    scoreTeamA: number
    scoreTeamB: number
    winner: string
    bestDebaterA: string | null
    bestDebaterB: string | null
    createdAt: Date
  }>
}> {
  // 修复：使用 findFirst + deletedAt: null 过滤软删除比赛
  const match = await prisma.match.findFirst({
    where: { id: matchId, deletedAt: null },
    select: { teamA: true, teamB: true, winner: true },
  })

  const scores = await prisma.matchScore.findMany({
    where: { matchId, match: { deletedAt: null } },
    orderBy: { createdAt: 'desc' },
  })

  return {
    match: match || { teamA: null, teamB: null, winner: null },
    scores: scores.map(s => ({
      judgeName: s.judgeName,
      dimensions: JSON.parse(s.dimensions) as ScoreDimension[],
      reason: s.reason,
      scoreTeamA: s.scoreTeamA,
      scoreTeamB: s.scoreTeamB,
      winner: s.winner,
      bestDebaterA: s.bestDebaterA,
      bestDebaterB: s.bestDebaterB,
      createdAt: s.createdAt,
    })),
  }
}

/**
 * 获取赛事的评分统计
 */
export async function getTournamentScoreStats(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<{
  totalMatches: number
  scoredMatches: number
  unscoredMatches: number
  totalJudges: number
  averageScoreTeamA: number
  averageScoreTeamB: number
}> {
  const [totalMatches, scoredMatches, scores] = await Promise.all([
    prisma.match.count({ where: { tournamentId, deletedAt: null } }),
    prisma.match.count({ where: { tournamentId, status: 'completed', deletedAt: null } }),
    prisma.matchScore.findMany({ where: { tournamentId } }),
  ])

  const totalA = scores.reduce((sum, s) => sum + s.scoreTeamA, 0)
  const totalB = scores.reduce((sum, s) => sum + s.scoreTeamB, 0)
  const uniqueJudges = new Set(scores.map(s => s.judgeName)).size

  return {
    totalMatches,
    scoredMatches,
    unscoredMatches: totalMatches - scoredMatches,
    totalJudges: uniqueJudges,
    averageScoreTeamA: scores.length > 0 ? Math.round((totalA / scores.length) * 10) / 10 : 0,
    averageScoreTeamB: scores.length > 0 ? Math.round((totalB / scores.length) * 10) / 10 : 0,
  }
}

// ---------- 格式化输出 ----------

/**
 * 格式化排名为文本
 */
export function formatRankingsText(
  rankings: Array<{
    rank: number
    name: string
    points: number
    wins: number
    draws: number
    losses: number
    scoreDiff: number
  }>,
  tournamentName: string,
): string {
  const lines: string[] = [
    `排名：${tournamentName}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '排名  队伍        积分  胜  平  负  净胜',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
  ]

  for (const r of rankings) {
    const rankIcon = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : ` ${r.rank} `
    lines.push(`${rankIcon}  ${r.name.padEnd(10)} ${String(r.points).padStart(3)}  ${String(r.wins).padStart(2)}  ${String(r.draws).padStart(2)}  ${String(r.losses).padStart(2)}  ${String(r.scoreDiff >= 0 ? '+' + r.scoreDiff : r.scoreDiff).padStart(4)}`)
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━')
  return lines.join('\n')
}