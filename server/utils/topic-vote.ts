import type { JWTPayload } from './auth'
import type { TopicVote, TopicVoteRecord } from '../lib/generated/client'
import { safeJsonParse } from './common'

/** 结构化候选辩题（topics 数组的元素形状） */
export interface TopicItem {
  text: string
  affirmative?: string | null
  negative?: string | null
  sourceTopicId?: string | null
  category?: string | null
}

/**
 * 将任意输入归一化为结构化 TopicItem。
 * - 字符串 → { text }
 * - 对象 → 取 text / affirmative / negative / sourceTopicId / category
 * - 有效条件：有 text，或同时具备 affirmative 与 negative
 * 非法/空项返回 null（由调用方过滤）
 */
export function normalizeTopicItem(t: any): TopicItem | null {
  if (typeof t === 'string') {
    const text = t.trim()
    return text ? { text } : null
  }
  if (t && typeof t === 'object') {
    const text = (t.text ?? '').toString().trim()
    const affirmative = (t.affirmative ?? '').toString().trim()
    const negative = (t.negative ?? '').toString().trim()
    const sourceTopicId = t.sourceTopicId ?? null
    const category = t.category ?? null
    if (text || (affirmative && negative)) {
      return {
        text,
        affirmative: affirmative || null,
        negative: negative || null,
        sourceTopicId: sourceTopicId || null,
        category: category || null,
      }
    }
  }
  return null
}

/**
 * 计算辩题的"展示文本"。
 * 优先用 正方/反方 组合（分正方双方），否则回退到 text。
 */
export function topicDisplayText(item: TopicItem | string | null | undefined): string {
  const t = typeof item === 'string' ? { text: item } : (item ?? null)
  if (!t) return ''
  const aff = (t.affirmative ?? '').toString().trim()
  const neg = (t.negative ?? '').toString().trim()
  if (aff && neg) return `正方：${aff} ｜ 反方：${neg}`
  if (aff) return `正方：${aff}`
  if (neg) return `反方：${neg}`
  return (t.text ?? '').toString().trim()
}

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
  if (!allowedVoters) return [...ALL_VOTER_TYPES] as string[]
  const parsed = safeJsonParse<string[] | null>(allowedVoters, null)
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed.filter((t) => (ALL_VOTER_TYPES as readonly string[]).includes(t))
  }
  return [...ALL_VOTER_TYPES] as string[]
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
  topics: TopicItem[],
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
    topic: topicDisplayText(topic),
    count: 0,
    percent: 0,
    byType: {} as Record<string, number>,
  }))

  // 遍历投票记录，解析 topicIndices 并累加
  for (const record of records) {
    const indices = safeJsonParse<number[]>(record.topicIndices, [])
    for (const idx of indices) {
      if (idx >= 0 && idx < results.length) {
        results[idx]!.count++
        const t = record.voterType
        results[idx]!.byType[t] = (results[idx]!.byType[t] || 0) + 1
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
 * ponytail: 使用 reduce 简化哈希计算，逻辑等价
 * 不可靠的指纹仅用于基础防刷，不保证唯一性。
 */
export function buildVoterFingerprint(ip: string | null, userAgent: string | undefined): string {
  const raw = `${ip || 'unknown'}|${userAgent || 'unknown'}`
  // ponytail: 用 reduce 替代 for 循环，简洁
  const hash = raw.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
  return `fp_${Math.abs(hash).toString(36)}`
}

/**
 * 解析候选辩题 JSON 字符串为结构化数组。
 * 兼容历史纯字符串数组，自动归一化为 TopicItem[]。
 */
export function parseTopics(topicsJson: string): TopicItem[] {
  const arr = safeJsonParse<any[] | null>(topicsJson, null)
  if (!Array.isArray(arr)) return []
  return arr
    .map(normalizeTopicItem)
    .filter((t): t is TopicItem => t !== null)
}
