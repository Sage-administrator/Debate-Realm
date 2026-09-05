// ════════════════════════════════════════════════════
// Bot 自动通知模块
// 在关键事件发生时，自动通过 Bot 发送频道消息通知
// ════════════════════════════════════════════════════

import type { PrismaClient } from './generated/client'
import { getBotInstance } from './bot-ws'

/**
 * 通知类型
 */
export type NotificationType =
  | 'match_start' // 比赛开始
  | 'match_result' // 比赛结果公布
  | 'tournament_create' // 赛事创建
  | 'round_change' // 环节切换
  | 'score_submitted' // 评委提交评分

/**
 * 尝试向团队的 Bot 频道发送通知
 * 如果 Bot 未连接或未配置频道，静默失败
 */
async function trySendNotification(
  teamId: string,
  channelId: string,
  content: string,
): Promise<boolean> {
  try {
    const instance = getBotInstance(teamId)
    if (!instance || instance.status !== 'connected') {
      return false
    }
    const targetChannel = channelId || instance.config.channelId
    if (!targetChannel) {
      return false
    }
    await instance.sendMessage(targetChannel, content)
    return true
  } catch (err) {
    console.error('[BotNotification] 发送通知失败:', err)
    return false
  }
}

/**
 * 比赛开始通知
 */
export async function notifyMatchStart(prisma: PrismaClient, matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: {
        select: { id: true, name: true, teamId: true },
      },
    },
  })

  if (!match?.tournament) return

  const team = await prisma.team.findUnique({
    where: { id: match.tournament.teamId },
    select: { botChannelId: true },
  })

  const teamA = match.teamA || '待定'
  const teamB = match.teamB || '待定'
  const topic = match.topic ? `\n辩题：${match.topic}` : ''

  const content = [
    `比赛开始！`,
    '━━━━━━━━━━━━━━━━',
    `赛事：${match.tournament.name}`,
    `${match.round}-${match.orderNum}: ${teamA} vs ${teamB}${topic}`,
    `正方：${match.affirmativeSide === 'teamA' ? teamA : match.affirmativeSide === 'teamB' ? teamB : '待定'}`,
    '━━━━━━━━━━━━━━━━',
    '请辩手就位，评委准备评分！',
  ].join('\n')

  await trySendNotification(match.tournament.teamId, team?.botChannelId || '', content)
}

/**
 * 比赛结果通知
 */
export async function notifyMatchResult(prisma: PrismaClient, matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: {
        select: { id: true, name: true, teamId: true },
      },
    },
  })

  if (!match?.tournament || (match.status !== 'completed' && match.status !== 'finished')) return

  const team = await prisma.team.findUnique({
    where: { id: match.tournament.teamId },
    select: { botChannelId: true },
  })

  const teamA = match.teamA || '未知'
  const teamB = match.teamB || '未知'
  const winner = match.winner === 'teamA' ? teamA : match.winner === 'teamB' ? teamB : '平局'

  const content = [
    `比赛结果公布！`,
    '━━━━━━━━━━━━━━━━',
    `赛事：${match.tournament.name}`,
    `${match.round}-${match.orderNum}: ${teamA} vs ${teamB}`,
    '',
    `比分：${match.scoreA} : ${match.scoreB}`,
    `胜方：${winner}`,
    match.bestDebaterA ? `\nA队最佳辩手：${match.bestDebaterA}` : '',
    match.bestDebaterB ? `B队最佳辩手：${match.bestDebaterB}` : '',
    '━━━━━━━━━━━━━━━━',
  ]
    .filter(Boolean)
    .join('\n')

  await trySendNotification(match.tournament.teamId, team?.botChannelId || '', content)
}

/**
 * 赛事创建通知
 */
export async function notifyTournamentCreate(
  prisma: PrismaClient,
  tournamentId: string,
): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      team: {
        select: { botChannelId: true },
      },
    },
  })

  if (!tournament) return

  const content = [
    `新赛事已创建！`,
    '━━━━━━━━━━━━━━━━',
    `赛事名称：${tournament.name}`,
    `比赛形式：${tournament.format}`,
    tournament.description ? `描述：${tournament.description}` : '',
    '━━━━━━━━━━━━━━━━',
    '请各参赛队伍做好准备！',
  ]
    .filter(Boolean)
    .join('\n')

  await trySendNotification(tournament.teamId, tournament.team?.botChannelId || '', content)
}

/**
 * 评分提交通知
 */
export async function notifyScoreSubmitted(
  prisma: PrismaClient,
  matchId: string,
  judgeName: string,
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: {
        select: { name: true, teamId: true },
      },
    },
  })

  if (!match?.tournament) return

  const team = await prisma.team.findUnique({
    where: { id: match.tournament.teamId },
    select: { botChannelId: true },
  })

  const content = [
    `评委评分已提交`,
    '━━━━━━━━━━━━━━━━',
    `赛事：${match.tournament.name}`,
    `${match.round}-${match.orderNum}`,
    `评委：${judgeName}`,
    '━━━━━━━━━━━━━━━━',
  ].join('\n')

  await trySendNotification(match.tournament.teamId, team?.botChannelId || '', content)
}

/**
 * 环节切换通知（可选，默认禁用避免刷屏）
 */
export async function notifyRoundChange(
  prisma: PrismaClient,
  teamId: string,
  targetSide: string,
  tournamentName: string,
): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { botChannelId: true },
  })

  const sideLabels: Record<string, string> = {
    affirmative: '正方发言环节',
    negative: '反方发言环节',
    judge: '评委点评环节',
    audience: '观众提问环节',
  }

  const label = sideLabels[targetSide] || targetSide

  const content = [`环节切换`, `赛事：${tournamentName}`, `当前环节：${label}`].join('\n')

  await trySendNotification(teamId, team?.botChannelId || '', content)
}
