import type { JWTPayload } from './auth'
import type { TopicVote, TopicVoteRecord } from '../lib/generated/client'

// ═════════════════════════════════════════════════════════
// 辩题投票系统 — 工具函数
// 投票者类型：debater（辩手）/ judge（评委）/ admin（管理员）/ public（公开）
// ═════════════════════════════════════════════════════════

/** 全部投票者类型列表 */
export const ALL_VOTER_TYPES = ['debater', 'judge', 'admin', 'public'] as const

/**
 * 解析 allowedVoters JSON 字符串为类型数组。
 * null / 空 / 解析失败 → 视为全部类型允许
 */
export function parseAllowedVoters(allowedVoters: string | null): string[] {
  if (!allowedVoters) return [...ALL_VOTER_TYPES]
  try {
    const parsed = JSON.parse(allowedVoters)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((t) => ALL_VOTER_TYPES.includes(t))
    }
  } catch {
    // JSON 解析失败，降级为全部允许
  }
  return [...ALL_VOTER_TYPES]
}

/**
 * 判定登录用户的投票者类型。
 * - system_admin / admin / subaccount（teamId 匹配）→ 'admin'
 * - debater（teamId 匹配）→ 'debater'
 * - 未登录 / 其他 → null
 */
export function determineLoginVoterType(
  user: JWTPayload | null,
  tournamentTeamId: string,
): 'admin' | 'debater' | null {
  if (!user) return null
  if (user.role === 'system_admin') return 'admin'
  if (user.role === 'admin' || user.role === 'subaccount') {
    return !!user.teamId && user.teamId === tournamentTeamId ? 'admin' : null
  }
  if (user.role === 'debater') {
    return !!user.teamId && user.teamId === tournamentTeamId ? 'debater' : null
  }
  return null
}

/**
 * 根据投票记录计算每个候选辩题的得票统计。
 * @param topics 候选辩题数组
 * @param records 投票记录列表
 * @returns { topic, count, percent, voterBreakdown }
 */
export function computeVoteStats(
  topics: string[],
  records: TopicVoteRecord[],
): {
  total: number
  results: {
    index: number
    topic: string
    count: number
    percent: number
    byType: Record<string, number>
  }[]
} {
  const total = records.length
  // 初始化每个辩题的统计
  const results = topics.map((topic, index) => ({
    index,
    topic,
    count: 0,
    percent: 0,
    byType: {} as Record<string, number>,
  }))

  // 遍历投票记录，解析 topicIndices 并累加
  for (const record of records) {
    let indices: number[] = []
    try {
      indices = JSON.parse(record.topicIndices)
      if (!Array.isArray(indices)) indices = []
    } catch {
      indices = []
    }
    for (const idx of indices) {
      if (idx >= 0 && idx < results.length) {
        results[idx].count++
        const t = record.voterType
        results[idx].byType[t] = (results[idx].byType[t] || 0) + 1
      }
    }
  }

  // 计算百分比
  for (const r of results) {
    r.percent = total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0
  }

  return { total, results }
}

/**
 * 从请求事件生成公开投票防刷指纹（IP + User-Agent 简易哈希）。
 * 不可靠的指纹仅用于基础防刷，不保证唯一性。
 */
export function buildVoterFingerprint(ip: string | null, userAgent: string | undefined): string {
  const raw = `${ip || 'unknown'}|${userAgent || 'unknown'}`
  // 简易哈希：base64 编码，避免引入 crypto 依赖
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }
  return `fp_${Math.abs(hash).toString(36)}`
}

/**
 * 解析候选辩题 JSON 字符串为数组
 */
export function parseTopics(topicsJson: string): string[] {
  try {
    const arr = JSON.parse(topicsJson)
    if (Array.isArray(arr)) return arr.map((t) => String(t))
  } catch {
    // 解析失败返回空
  }
  return []
}
