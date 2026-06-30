// ════════════════════════════════════════════════════
// Bot 消息处理器 — 处理用户命令
// ════════════════════════════════════════════════════

import type { PrismaClient } from './generated/client'
import type { BotConfig } from './bot-ws'
import { createArena, closeArena, claimRole, unclaimRole, getArenaStatus, getSupportedFormats, getNextArenaLetter } from './bot-roles'
import { getTopicPool, getSchedule, getNextMatch, formatTopicsText, formatScheduleText } from './bot-data-sync'
import { getRankings, formatRankingsText } from './bot-scoring'

export interface MessageContext {
  channelId: string
  userId: string
  content: string
  /** 可选：QQ 用户名 */
  username?: string
  /** 可选：Prisma 客户端（异步命令需要） */
  prisma?: PrismaClient
  /** 可选：Bot 配置（异步命令需要） */
  botConfig?: BotConfig
  /** 可选：QQ 频道 ID（异步命令需要） */
  guildId?: string
  /** 可选：团队 ID（异步命令需要） */
  teamId?: string
}

export interface HandleResult {
  handled: boolean
  reply?: string
}

/**
 * 处理消息命令（同步 + 异步混合）
 * 同步命令（ping help 状态）直接返回
 * 异步命令（设置赛场 结束比赛 认领 取消认领 赛场状态）需要 prisma 等参数
 */
export async function handleMessage(ctx: MessageContext): Promise<HandleResult> {
  const { content } = ctx

  // 忽略空消息
  if (!content || !content.trim()) {
    return { handled: false }
  }

  const trimmed = content.trim()

  // ping — 测试连接
  if (trimmed === 'ping') {
    return { handled: true, reply: 'pong! 辩论计时器 Bot 运行正常' }
  }

  // help — 帮助信息
  if (trimmed === '帮助' || trimmed === 'help') {
    return {
      handled: true,
      reply: `**辩论计时器 Bot 命令列表**

` +
        '`ping` - 测试 Bot 是否在线\n' +
        '`help` - 显示此帮助信息\n' +
        '`状态` - 查看当前状态\n' +
        '`赛场状态` - 查看当前赛场身份分配\n' +
        '`设置赛场 [赛场名] [4v4|3v3|2v2]` - 创建辩论赛场（管理员）\n' +
        '`结束比赛` - 关闭当前赛场（管理员）\n' +
        '`认领 [身份]` - 认领身份，如 `认领 正方一辩`\n' +
        '`取消认领` - 取消当前身份认领\n' +
        '`辩题` - 查看辩题库\n' +
        '`赛程` - 查看赛程安排\n' +
        '`下一场` - 查看下一场待比赛信息\n' +
        '`排名` - 查看赛事排名',
    }
  }

  // status — 状态
  if (trimmed === '状态') {
    return { handled: true, reply: 'Bot 运行中 | 辩论计时器 V3\n当前暂无进行中的赛事' }
  }

  // ── 以下为异步命令，需要 prisma 和 botConfig ──

  // 设置赛场 [赛场名] [4v4|3v3|2v2] — 创建赛场（管理员）
  // 写法一：设置赛场 4v4 — 省略名字 → 自动命名为赛场A/B/C...
  // 写法二：设置赛场 自定义名 4v4 — 指定名字
  const arenaMatchFull = trimmed.match(/^设置赛场\s+(.+?)\s+(4v4|3v3|2v2)$/)
  const arenaMatchShort = trimmed.match(/^设置赛场\s+(4v4|3v3|2v2)$/)

  if (arenaMatchFull) {
    return handleSetArena(ctx, arenaMatchFull[1]!, arenaMatchFull[2]!)
  }
  if (arenaMatchShort) {
    // 没指定名字，用字母序号自动命名：赛场A/B/C...
    return handleSetArena(ctx, '', arenaMatchShort[1]!)
  }

  // 结束比赛 — 关闭赛场（管理员）
  if (trimmed === '结束比赛') {
    return handleEndArena(ctx)
  }

  // 认领 [身份名称] — 认领身份
  const claimMatch = trimmed.match(/^认领\s+(.+)$/)
  if (claimMatch) {
    return handleClaimRole(ctx, claimMatch[1]!)
  }

  // 取消认领 — 取消身份认领
  if (trimmed === '取消认领') {
    return handleUnclaimRole(ctx)
  }

  // 赛场状态 — 查看当前赛场状态
  if (trimmed === '赛场状态') {
    return handleArenaStatus(ctx)
  }

  // 辩题 — 查看辩题库
  if (trimmed === '辩题') {
    return handleTopics(ctx)
  }

  // 赛程 — 查看赛程安排
  if (trimmed === '赛程') {
    return handleSchedule(ctx)
  }

  // 下一场 — 查看下一场待比赛信息
  if (trimmed === '下一场') {
    return handleNextMatch(ctx)
  }

  // 排名 — 查看赛事排名
  if (trimmed === '排名') {
    return handleRankings(ctx)
  }

  return { handled: false }
}

// ---------- 异步命令处理函数 ----------

/** 设置赛场 */
async function handleSetArena(ctx: MessageContext, arenaName: string, format: string): Promise<HandleResult> {
  if (!ctx.prisma || !ctx.botConfig || !ctx.teamId || !ctx.guildId) {
    return { handled: true, reply: '命令执行失败：缺少必要参数，请确认 Bot 已正确配置' }
  }

  // 如果没有指定名字（空字符串），自动按字母序号命名：赛场A、赛场B、赛场C...
  let finalName = arenaName
  if (!finalName || !finalName.trim()) {
    const letter = await getNextArenaLetter(ctx.prisma, ctx.teamId)
    finalName = `赛场${letter}`
  }

  const result = await createArena(ctx.prisma, ctx.botConfig, ctx.teamId, format, ctx.guildId, finalName, ctx.channelId)
  return { handled: true, reply: result.message }
}

/** 结束比赛 */
async function handleEndArena(ctx: MessageContext): Promise<HandleResult> {
  if (!ctx.prisma || !ctx.botConfig || !ctx.channelId) {
    return { handled: true, reply: '命令执行失败：缺少必要参数（channelId），请确认 Bot 已正确配置' }
  }

  const result = await closeArena(ctx.prisma, ctx.botConfig, ctx.channelId, ctx.guildId, ctx.teamId)
  return { handled: true, reply: result.message }
}

/** 认领 */
async function handleClaimRole(ctx: MessageContext, roleLabel: string): Promise<HandleResult> {
  if (!ctx.prisma || !ctx.botConfig || !ctx.teamId || !ctx.channelId || !ctx.guildId) {
    return { handled: true, reply: '命令执行失败：缺少必要参数，请确认 Bot 已正确配置' }
  }

  const result = await claimRole(
    ctx.prisma,
    ctx.botConfig,
    ctx.teamId,
    ctx.channelId,
    ctx.guildId,
    ctx.userId,
    ctx.username || '未知用户',
    roleLabel.trim(),
  )
  return { handled: true, reply: result.message }
}

/** 取消认领 */
async function handleUnclaimRole(ctx: MessageContext): Promise<HandleResult> {
  if (!ctx.prisma || !ctx.botConfig || !ctx.channelId || !ctx.guildId) {
    return { handled: true, reply: '命令执行失败：缺少必要参数，请确认 Bot 已正确配置' }
  }

  const result = await unclaimRole(ctx.prisma, ctx.botConfig, ctx.channelId, ctx.guildId, ctx.userId)
  return { handled: true, reply: result.message }
}

/** 赛场状态 */
async function handleArenaStatus(ctx: MessageContext): Promise<HandleResult> {
  if (!ctx.prisma || !ctx.channelId) {
    return { handled: true, reply: '命令执行失败：缺少必要参数（channelId），请确认 Bot 已正确配置' }
  }

  const status = await getArenaStatus(ctx.prisma, ctx.channelId)
  return { handled: true, reply: status }
}

/** 辩题 */
async function handleTopics(ctx: MessageContext): Promise<HandleResult> {
  if (!ctx.prisma || !ctx.teamId) {
    return { handled: true, reply: '命令执行失败：缺少必要参数，请确认 Bot 已正确配置' }
  }

  const result = await getTopicPool(ctx.prisma, ctx.teamId)
  if (result.topics.length === 0) {
    return { handled: true, reply: result.message }
  }

  const text = formatTopicsText(result.topics, result.tournamentName || '未知赛事')
  return { handled: true, reply: text }
}

/** 赛程 */
async function handleSchedule(ctx: MessageContext): Promise<HandleResult> {
  if (!ctx.prisma || !ctx.teamId) {
    return { handled: true, reply: '命令执行失败：缺少必要参数，请确认 Bot 已正确配置' }
  }

  const result = await getSchedule(ctx.prisma, ctx.teamId)
  if (result.matches.length === 0) {
    return { handled: true, reply: result.message }
  }

  const text = formatScheduleText(result.matches, result.tournamentName || '未知赛事')
  return { handled: true, reply: text }
}

/** 下一场 */
async function handleNextMatch(ctx: MessageContext): Promise<HandleResult> {
  if (!ctx.prisma || !ctx.teamId) {
    return { handled: true, reply: '命令执行失败：缺少必要参数，请确认 Bot 已正确配置' }
  }

  const result = await getNextMatch(ctx.prisma, ctx.teamId)
  if (!result.success) {
    return { handled: true, reply: result.message }
  }

  const m = result.match!
  const teamA = m.teamA || '待定'
  const teamB = m.teamB || '待定'
  const topic = m.topic ? `\n辩题：${m.topic}` : ''
  const judge = m.judge ? `\n评委：${m.judge}` : ''

  const reply = [
    `下一场比赛：${result.tournamentName}`,
    '━━━━━━━━━━━━━━━━',
    `${m.round}-${m.orderNum}: ${teamA} vs ${teamB}${topic}${judge}`,
    `正方：${m.affirmativeSide === 'teamA' ? teamA : m.affirmativeSide === 'teamB' ? teamB : '待定'}`,
    '━━━━━━━━━━━━━━━━',
  ].join('\n')

  return { handled: true, reply }
}

/** 排名 */
async function handleRankings(ctx: MessageContext): Promise<HandleResult> {
  if (!ctx.prisma || !ctx.teamId) {
    return { handled: true, reply: '命令执行失败：缺少必要参数，请确认 Bot 已正确配置' }
  }

  // 查找团队活跃赛事
  const tournament = await ctx.prisma.tournament.findFirst({
    where: {
      teamId: ctx.teamId,
      status: { in: ['pending', 'active', 'in_progress'] },
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!tournament) {
    return { handled: true, reply: '当前没有进行中的赛事' }
  }

  const result = await getRankings(ctx.prisma, tournament.id)
  if (result.rankings.length === 0) {
    return { handled: true, reply: '暂无排名数据' }
  }

  const text = formatRankingsText(result.rankings, result.tournamentName)
  return { handled: true, reply: text }
}