// ════════════════════════════════════════════════════
// Bot 数据同步模块
// 提供辩题、赛程数据的查询接口，供 Bot 消息处理器调用
// ════════════════════════════════════════════════════

import type { PrismaClient } from './generated/client'

// ---------- 辩题数据 ----------

/**
 * 获取团队的辩题库（从活跃赛事中获取）
 * @param teamId 团队 ID
 * @returns 辩题列表
 */
export async function getTopicPool(prisma: PrismaClient, teamId: string) {
  // 查找团队最新的活跃赛事
  const tournament = await prisma.tournament.findFirst({
    where: {
      teamId,
      status: { in: ['pending', 'active', 'in_progress'] },
      topicPool: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!tournament || !tournament.topicPool) {
    return { topics: [], message: '当前没有可用的辩题库' }
  }

  try {
    const topics: string[] = JSON.parse(tournament.topicPool)
    return {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      topics,
      message: `辩题库「${tournament.name}」共 ${topics.length} 个辩题`,
    }
  } catch {
    return { topics: [], message: '辩题库解析失败' }
  }
}

/**
 * 获取指定比赛的辩题
 * @param matchId 比赛 ID
 * @returns 辩题信息
 */
export async function getMatchTopic(prisma: PrismaClient, matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      topic: true,
      teamA: true,
      teamB: true,
      affirmativeSide: true,
      tournament: { select: { name: true } },
    },
  })

  if (!match) {
    return { success: false, message: '比赛不存在' }
  }

  if (!match.topic) {
    return { success: false, message: '该比赛尚未分配辩题' }
  }

  return {
    success: true,
    matchId: match.id,
    tournamentName: match.tournament?.name || '未知赛事',
    topic: match.topic,
    teamA: match.teamA,
    teamB: match.teamB,
    affirmativeSide: match.affirmativeSide,
  }
}

// ---------- 赛程数据 ----------

/**
 * 获取团队的赛程列表
 * @param teamId 团队 ID
 * @param status 筛选状态：pending / in_progress / completed / all
 * @param limit 返回数量限制
 */
export async function getSchedule(
  prisma: PrismaClient,
  teamId: string,
  status: string = 'all',
  limit: number = 20,
) {
  // 查找团队活跃赛事
  const tournament = await prisma.tournament.findFirst({
    where: {
      teamId,
      status: { in: ['pending', 'active', 'in_progress'] },
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!tournament) {
    return { matches: [], message: '当前没有进行中的赛事' }
  }

  // 构建查询条件
  const where: any = {
    tournamentId: tournament.id,
    deletedAt: null,
  }
  if (status !== 'all') {
    where.status = status
  }

  const matches = await prisma.match.findMany({
    where,
    orderBy: [{ round: 'asc' }, { orderNum: 'asc' }],
    take: limit,
    select: {
      id: true,
      round: true,
      orderNum: true,
      teamA: true,
      teamB: true,
      winner: true,
      scoreA: true,
      scoreB: true,
      status: true,
      scheduledAt: true,
      topic: true,
      affirmativeSide: true,
      judge: true,
    },
  })

  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    totalMatches: matches.length,
    matches,
    message: `赛事「${tournament.name}」当前 ${matches.length} 场比赛`,
  }
}

/**
 * 获取指定比赛的详细信息
 */
export async function getMatchDetail(prisma: PrismaClient, matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId, deletedAt: null },
    select: {
      id: true,
      round: true,
      orderNum: true,
      teamA: true,
      teamB: true,
      winner: true,
      scoreA: true,
      scoreB: true,
      status: true,
      scheduledAt: true,
      topic: true,
      affirmativeSide: true,
      bestDebaterA: true,
      bestDebaterB: true,
      judge: true,
      tournament: {
        select: { id: true, name: true, format: true },
      },
    },
  })

  if (!match) {
    return { success: false, message: '比赛不存在' }
  }

  return { success: true, match }
}

/**
 * 获取下一场待进行的比赛
 */
export async function getNextMatch(prisma: PrismaClient, teamId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: {
      teamId,
      status: { in: ['pending', 'active', 'in_progress'] },
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!tournament) {
    return { success: false, message: '当前没有进行中的赛事' }
  }

  const match = await prisma.match.findFirst({
    where: {
      tournamentId: tournament.id,
      status: 'pending',
      deletedAt: null,
    },
    orderBy: [{ round: 'asc' }, { orderNum: 'asc' }],
    select: {
      id: true,
      round: true,
      orderNum: true,
      teamA: true,
      teamB: true,
      topic: true,
      affirmativeSide: true,
      judge: true,
      scheduledAt: true,
    },
  })

  if (!match) {
    return { success: false, message: '所有比赛已安排完毕' }
  }

  return {
    success: true,
    tournamentName: tournament.name,
    match,
  }
}

// ---------- 数据格式化 ----------

/**
 * 将赛程列表格式化为 Bot 可发送的文本消息
 */
export function formatScheduleText(
  matches: Array<{
    round: string
    orderNum: number
    teamA: string | null
    teamB: string | null
    status: string
    topic?: string | null
    judge?: string | null
  }>,
  tournamentName: string,
): string {
  const statusLabels: Record<string, string> = {
    pending: '待开始',
    in_progress: '进行中',
    completed: '已结束',
  }

  const lines: string[] = [
    `赛程：${tournamentName}`,
    '━━━━━━━━━━━━━━━━',
  ]

  for (const match of matches) {
    const statusLabel = statusLabels[match.status] || match.status
    const teamA = match.teamA || '待定'
    const teamB = match.teamB || '待定'
    const topic = match.topic ? ` [${match.topic}]` : ''
    lines.push(`${match.round}-${match.orderNum}: ${teamA} vs ${teamB}${topic} | ${statusLabel}`)
  }

  lines.push('━━━━━━━━━━━━━━━━')
  return lines.join('\n')
}

/**
 * 将辩题列表格式化为 Bot 可发送的文本消息
 */
export function formatTopicsText(topics: string[], tournamentName: string): string {
  if (topics.length === 0) {
    return '当前没有可用的辩题'
  }

  const lines: string[] = [
    `辩题库：${tournamentName}`,
    '━━━━━━━━━━━━━━━━',
  ]

  topics.forEach((topic, index) => {
    lines.push(`${index + 1}. ${topic}`)
  })

  lines.push('━━━━━━━━━━━━━━━━')
  return lines.join('\n')
}