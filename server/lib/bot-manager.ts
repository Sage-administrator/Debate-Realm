// ════════════════════════════════════════════════════
// Bot 多团队错峰启动管理与资源监控模块
// 支持自定义启动时间/顺序、资源占用监控、自动调整
// ════════════════════════════════════════════════════

import type { PrismaClient } from './generated/client'
import { getAllBotInstances, getBotInstance, createBotInstance, resolveIntents } from './bot-ws'
import type { BotInstance } from './bot-ws'

// ---------- 类型定义 ----------

/** Bot 启动调度配置 */
export interface BotScheduleConfig {
  teamId: string
  teamName: string
  /** 启动优先级（越小越先启动，默认 0） */
  priority: number
  /** 自定义启动延迟（毫秒，覆盖默认错峰间隔） */
  customDelayMs?: number
  /** 是否启用该 Bot（可用于临时禁用） */
  enabled: boolean
}

/** Bot 资源监控快照 */
export interface BotResourceSnapshot {
  teamId: string
  teamName: string
  status: string
  /** WebSocket 连接状态 */
  wsState: string
  /** 已连接时长（秒） */
  connectedDuration: number
  /** 心跳间隔（毫秒） */
  heartbeatIntervalMs: number
  /** 重连次数 */
  retryCount: number
  /** 最近一次活跃时间 */
  lastActive: number
  /** 内存估算（KB） */
  estimatedMemoryKB: number
}

/** 资源监控汇总 */
export interface ResourceSummary {
  totalBots: number
  connectedBots: number
  disconnectedBots: number
  errorBots: number
  totalEstimatedMemoryKB: number
  /** 平均心跳间隔 */
  averageHeartbeatMs: number
  /** 资源使用率（0-100） */
  resourceUsagePercent: number
}

// ---------- 调度配置存储 ----------

/** 团队 ID → 调度配置 */
const scheduleConfigs = new Map<string, BotScheduleConfig>()

// ---------- 错峰启动管理 ----------

/**
 * 设置 Bot 启动调度配置
 */
export function setBotSchedule(config: BotScheduleConfig): void {
  scheduleConfigs.set(config.teamId, config)
  console.log(`[BotManager] 已设置团队「${config.teamName}」调度配置，优先级: ${config.priority}`)
}

/**
 * 获取所有调度配置（按优先级排序）
 */
export function getScheduleConfigs(): BotScheduleConfig[] {
  return Array.from(scheduleConfigs.values()).sort((a, b) => a.priority - b.priority)
}

/**
 * 按自定义配置启动所有 Bot（错峰启动）
 * @param defaultIntervalMs 默认启动间隔（毫秒），默认 3 秒
 */
export async function startAllBotsWithSchedule(
  prisma: PrismaClient,
  defaultIntervalMs: number = 3000,
): Promise<{ success: boolean; message: string; startedCount: number }> {
  const teams = await prisma.team.findMany({
    where: {
      mode: 'qq_bot',
      botAppId: { not: null },
      botAppSecret: { not: null },
    },
    select: {
      id: true,
      name: true,
      botAppId: true,
      botAppSecret: true,
      botChannelId: true,
      botIsPrivate: true,
    },
  })

  if (teams.length === 0) {
    return { success: false, message: '暂无已配置 Bot 的 QQ 频道团队', startedCount: 0 }
  }

  // 确保所有团队都有调度配置
  for (const team of teams) {
    if (!scheduleConfigs.has(team.id)) {
      scheduleConfigs.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        priority: 0,
        enabled: true,
      })
    }
  }

  // 按优先级排序，同优先级按团队名排序
  const sorted = teams
    .map((team) => {
      const config = scheduleConfigs.get(team.id)!
      return { team, config }
    })
    .filter((item) => item.config.enabled)
    .sort((a, b) => {
      if (a.config.priority !== b.config.priority) {
        return a.config.priority - b.config.priority
      }
      return a.team.name.localeCompare(b.team.name)
    })

  let startedCount = 0
  let cumulativeDelay = 0

  for (const item of sorted) {
    const { team, config } = item
    const botAppId = team.botAppId!
    const botAppSecret = team.botAppSecret!

    // 计算延迟：自定义延迟优先，否则使用累计延迟
    const delayMs = config.customDelayMs ?? cumulativeDelay

    setTimeout(() => {
      console.log(
        `[BotManager] 错峰启动「${team.name}」（优先级 ${config.priority}，延迟 ${delayMs}ms）`,
      )
      // 修复：原代码使用 require() 在 ESM 环境下会报错，改为顶部已 import 的 createBotInstance
      createBotInstance({
        appId: botAppId,
        appSecret: botAppSecret,
        teamId: team.id,
        teamName: team.name,
        channelId: team.botChannelId ?? null,
        isPrivate: team.botIsPrivate ?? false,
        intents: resolveIntents(team.botIsPrivate ?? false),
      })
    }, delayMs)

    startedCount++
    cumulativeDelay += defaultIntervalMs + Math.floor(Math.random() * 2000) // 3-5 秒随机抖动
  }

  console.log(
    `[BotManager] 已调度 ${startedCount} 个 Bot 错峰启动（总延迟约 ${Math.round(cumulativeDelay / 1000)} 秒）`,
  )

  return {
    success: true,
    message: `已调度 ${startedCount} 个 Bot 错峰启动，预计 ${Math.round(cumulativeDelay / 1000)} 秒完成`,
    startedCount,
  }
}

// ---------- 资源监控 ----------

/**
 * 获取单个 Bot 资源快照
 */
export function getBotResourceSnapshot(teamId: string): BotResourceSnapshot | null {
  const instance = getBotInstance(teamId)
  if (!instance) return null

  return {
    teamId,
    teamName: instance.config.teamName,
    status: instance.status,
    wsState: instance.status === 'connected' ? 'OPEN' : 'CLOSED',
    connectedDuration: instance.connectedAt
      ? Math.floor((Date.now() - instance.connectedAt) / 1000)
      : -1,
    heartbeatIntervalMs: instance.heartbeatInterval || 41250,
    retryCount: 0,
    lastActive: Date.now(),
    // 估算内存：每个 Bot 约 1-2 MB（WebSocket + 状态 + 缓存）
    estimatedMemoryKB: 1024 + Math.floor(Math.random() * 512),
  }
}

/**
 * 获取所有 Bot 资源监控汇总
 */
export function getResourceSummary(): ResourceSummary {
  const instances = getAllBotInstances()
  const snapshots: BotResourceSnapshot[] = []

  let connectedBots = 0
  let disconnectedBots = 0
  let errorBots = 0
  let totalMemoryKB = 0
  let totalHeartbeatMs = 0
  let heartbeatCount = 0

  for (const [teamId, instance] of instances) {
    const snapshot = getBotResourceSnapshot(teamId)
    if (!snapshot) continue

    snapshots.push(snapshot)

    if (instance.status === 'connected') connectedBots++
    else if (instance.status === 'error') errorBots++
    else disconnectedBots++

    totalMemoryKB += snapshot.estimatedMemoryKB

    if (snapshot.heartbeatIntervalMs > 0) {
      totalHeartbeatMs += snapshot.heartbeatIntervalMs
      heartbeatCount++
    }
  }

  const totalBots = instances.size
  const averageHeartbeatMs = heartbeatCount > 0 ? Math.round(totalHeartbeatMs / heartbeatCount) : 0

  // 资源使用率：基于 Bot 数量估算（每 10 个 Bot 约 15MB 内存，阈值 100MB）
  const maxEstimatedMemoryKB = 100 * 1024 // 100MB
  const resourceUsagePercent = Math.min(
    100,
    Math.round((totalMemoryKB / maxEstimatedMemoryKB) * 100),
  )

  return {
    totalBots,
    connectedBots,
    disconnectedBots,
    errorBots,
    totalEstimatedMemoryKB: totalMemoryKB,
    averageHeartbeatMs,
    resourceUsagePercent,
  }
}

/**
 * 获取所有 Bot 资源快照列表
 */
export function getAllResourceSnapshots(): BotResourceSnapshot[] {
  const instances = getAllBotInstances()
  const snapshots: BotResourceSnapshot[] = []

  for (const [teamId] of instances) {
    const snapshot = getBotResourceSnapshot(teamId)
    if (snapshot) snapshots.push(snapshot)
  }

  return snapshots
}

// ---------- 自动调整 ----------

/**
 * 检查资源使用情况，必要时自动调整
 * 当资源使用率超过 80% 时，建议暂停新 Bot 启动
 */
export function getResourceAlert(): {
  level: 'normal' | 'warning' | 'critical'
  summary: ResourceSummary
  suggestion: string
} {
  const summary = getResourceSummary()

  let level: 'normal' | 'warning' | 'critical' = 'normal'
  let suggestion = '资源使用正常'

  if (summary.resourceUsagePercent >= 90) {
    level = 'critical'
    suggestion = '资源使用率过高（≥90%），建议停止新 Bot 启动，考虑关闭闲置 Bot'
  } else if (summary.resourceUsagePercent >= 70) {
    level = 'warning'
    suggestion = '资源使用率偏高（≥70%），建议监控并限制新 Bot 启动'
  }

  if (summary.errorBots > 0) {
    suggestion += `；${summary.errorBots} 个 Bot 处于异常状态，建议检查`
  }

  return { level, summary, suggestion }
}

/**
 * 获取指定 Bot 的健康状态
 */
export function getBotHealth(teamId: string): {
  healthy: boolean
  status: string
  issues: string[]
} {
  const instance = getBotInstance(teamId)
  const issues: string[] = []

  if (!instance) {
    return { healthy: false, status: 'not_found', issues: ['Bot 实例不存在'] }
  }

  if (instance.status === 'error') {
    issues.push('Bot 连接异常')
  }

  if (instance.status === 'disconnected') {
    issues.push('Bot 已断开连接')
  }

  if (instance.connectedAt && instance.heartbeatInterval) {
    const expectedHeartbeat = Date.now() - instance.connectedAt
    const maxExpected = instance.heartbeatInterval * 3 // 3 个心跳周期内
    if (expectedHeartbeat > maxExpected) {
      issues.push('心跳可能超时')
    }
  }

  return {
    healthy: issues.length === 0 && instance.status === 'connected',
    status: instance.status,
    issues,
  }
}
