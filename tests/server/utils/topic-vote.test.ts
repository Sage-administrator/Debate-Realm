import { describe, it, expect } from 'vitest'
import {
  normalizeTopicItem,
  topicDisplayText,
  parseAllowedVoters,
  determineLoginVoterType,
  computeVoteStats,
  buildVoterFingerprint,
  parseTopics,
  ALL_VOTER_TYPES,
} from '../../../server/utils/topic-vote'
import type { JWTPayload } from '../../../server/utils/auth'
import type { TopicVoteRecord } from '../../../server/lib/generated/client'

// Helper: create minimal JWTPayload for tests
function makeUser(overrides: Partial<JWTPayload> = {}): JWTPayload {
  return {
    userId: 'u1',
    username: 'test',
    role: 'debater',
    mode: 'qq_bot',
    teamId: 'team1',
    tokenVersion: 1,
    ...overrides,
  }
}

// Helper: create minimal TopicVoteRecord-like objects
function makeRecord(opts: { topicIndices: number[]; voterType: string }): TopicVoteRecord {
  return {
    topicIndices: JSON.stringify(opts.topicIndices),
    voterType: opts.voterType,
  } as TopicVoteRecord
}

// ===================== normalizeTopicItem =====================

describe('normalizeTopicItem', () => {
  it('should normalize a plain string', () => {
    const result = normalizeTopicItem(' 气候变化 ')
    expect(result).toEqual({ text: '气候变化' })
  })

  it('should return null for empty string', () => {
    expect(normalizeTopicItem('')).toBeNull()
    expect(normalizeTopicItem('   ')).toBeNull()
  })

  it('should normalize a structured object', () => {
    const result = normalizeTopicItem({
      text: 'AI伦理',
      affirmative: '支持AI发展',
      negative: '限制AI发展',
      sourceTopicId: 't12',
      category: '科技',
    })
    expect(result).toEqual({
      text: 'AI伦理',
      affirmative: '支持AI发展',
      negative: '限制AI发展',
      sourceTopicId: 't12',
      category: '科技',
    })
  })

  it('should return null when both text and affirmative/negative are empty', () => {
    const result = normalizeTopicItem({ text: '', affirmative: '', negative: '' })
    expect(result).toBeNull()
  })

  it('should return valid when has affirmative+negative but no text', () => {
    const result = normalizeTopicItem({ affirmative: '正方', negative: '反方' })
    expect(result).toEqual({
      text: '',
      affirmative: '正方',
      negative: '反方',
      sourceTopicId: null,
      category: null,
    })
  })

  it('should return null for non-string non-object', () => {
    expect(normalizeTopicItem(123)).toBeNull()
    expect(normalizeTopicItem(null)).toBeNull()
    expect(normalizeTopicItem(undefined)).toBeNull()
  })
})

// ===================== topicDisplayText =====================

describe('topicDisplayText', () => {
  it('should show both sides when both exist', () => {
    expect(topicDisplayText({ text: '', affirmative: '正方观点', negative: '反方观点' })).toBe(
      '正方：正方观点 ｜ 反方：反方观点',
    )
  })

  it('should show only affirmative when negative missing', () => {
    expect(topicDisplayText({ text: '', affirmative: '正方观点' })).toBe('正方：正方观点')
  })

  it('should show only negative when affirmative missing', () => {
    expect(topicDisplayText({ text: '', negative: '反方观点' })).toBe('反方：反方观点')
  })

  it('should fallback to text when no sides', () => {
    expect(topicDisplayText({ text: '纯文本辩题' })).toBe('纯文本辩题')
  })

  it('should handle plain string input', () => {
    expect(topicDisplayText('直接字符串')).toBe('直接字符串')
  })

  it('should return empty for null/undefined', () => {
    expect(topicDisplayText(null)).toBe('')
    expect(topicDisplayText(undefined)).toBe('')
  })

  it('should trim whitespace', () => {
    expect(topicDisplayText({ text: '', affirmative: '  正方  ', negative: '  反方  ' })).toBe(
      '正方：正方 ｜ 反方：反方',
    )
  })
})

// ===================== parseAllowedVoters =====================

describe('parseAllowedVoters', () => {
  it('should return all types for null', () => {
    expect(parseAllowedVoters(null)).toEqual([...ALL_VOTER_TYPES])
  })

  it('should parse valid JSON array', () => {
    const result = parseAllowedVoters('["debater","judge"]')
    expect(result).toEqual(['debater', 'judge'])
  })

  it('should filter out invalid types', () => {
    const result = parseAllowedVoters('["debater","invalid_type"]')
    expect(result).toEqual(['debater'])
  })

  it('should return all for empty array', () => {
    const result = parseAllowedVoters('[]')
    expect(result).toEqual([...ALL_VOTER_TYPES])
  })

  it('should return all for invalid JSON', () => {
    const result = parseAllowedVoters('not json')
    expect(result).toEqual([...ALL_VOTER_TYPES])
  })
})

// ===================== determineLoginVoterType =====================

describe('determineLoginVoterType', () => {
  const tourneyTeamId = 'teamA'

  it('should return admin for system_admin', () => {
    const user = makeUser({ role: 'system_admin' })
    expect(determineLoginVoterType(user, tourneyTeamId)).toBe('admin')
  })

  it('should return admin for admin with matching teamId', () => {
    const user = makeUser({ role: 'admin', teamId: 'teamA' })
    expect(determineLoginVoterType(user, tourneyTeamId)).toBe('admin')
  })

  it('should return admin for subaccount with matching teamId', () => {
    const user = makeUser({ role: 'subaccount', teamId: 'teamA' })
    expect(determineLoginVoterType(user, tourneyTeamId)).toBe('admin')
  })

  it('should return null for admin with non-matching teamId', () => {
    const user = makeUser({ role: 'admin', teamId: 'teamB' })
    expect(determineLoginVoterType(user, tourneyTeamId)).toBeNull()
  })

  it('should return debater for debater with matching teamId', () => {
    const user = makeUser({ role: 'debater', teamId: 'teamA' })
    expect(determineLoginVoterType(user, tourneyTeamId)).toBe('debater')
  })

  it('should return null for debater with non-matching teamId', () => {
    const user = makeUser({ role: 'debater', teamId: 'teamB' })
    expect(determineLoginVoterType(user, tourneyTeamId)).toBeNull()
  })

  it('should return null for individual', () => {
    const user = makeUser({ role: 'individual' })
    expect(determineLoginVoterType(user, tourneyTeamId)).toBeNull()
  })

  it('should return null for unauthenticated user', () => {
    expect(determineLoginVoterType(null, tourneyTeamId)).toBeNull()
  })
})

// ===================== computeVoteStats =====================

describe('computeVoteStats', () => {
  const topics = [{ text: '辩题A' }, { text: '辩题B' }, { text: '辩题C' }]

  it('should return zero counts for empty records', () => {
    const result = computeVoteStats(topics, [])
    expect(result.total).toBe(0)
    expect(result.results).toHaveLength(3)
    for (const r of result.results) {
      expect(r.count).toBe(0)
      expect(r.percent).toBe(0)
    }
  })

  it('should count single vote correctly', () => {
    const records = [makeRecord({ topicIndices: [0], voterType: 'debater' })]
    const result = computeVoteStats(topics, records)
    expect(result.total).toBe(1)
    expect(result.results[0]!.count).toBe(1)
    expect(result.results[0]!.percent).toBe(100)
    expect(result.results[1]!.count).toBe(0)
  })

  it('should aggregate multiple votes', () => {
    const records = [
      makeRecord({ topicIndices: [0], voterType: 'debater' }),
      makeRecord({ topicIndices: [0, 1], voterType: 'judge' }),
      makeRecord({ topicIndices: [1], voterType: 'admin' }),
      makeRecord({ topicIndices: [2], voterType: 'public' }),
    ]
    const result = computeVoteStats(topics, records)
    expect(result.total).toBe(4)
    expect(result.results[0]!.count).toBe(2) // voted by debater+judge
    expect(result.results[1]!.count).toBe(2) // voted by judge+admin
    expect(result.results[2]!.count).toBe(1) // voted by public
    expect(result.results[0]!.percent).toBe(50) // 2/4 * 100 = 50.0
  })

  it('should track byType breakdown', () => {
    const records = [
      makeRecord({ topicIndices: [0], voterType: 'debater' }),
      makeRecord({ topicIndices: [0], voterType: 'judge' }),
    ]
    const result = computeVoteStats(topics, records)
    expect(result.results[0]!.byType).toEqual({ debater: 1, judge: 1 })
  })

  it('should handle out-of-range indices gracefully', () => {
    const records = [makeRecord({ topicIndices: [99], voterType: 'debater' })]
    const result = computeVoteStats(topics, records)
    expect(result.total).toBe(1)
    // All 3 topics should have count 0 (index 99 is out of range)
    for (const r of result.results) {
      expect(r.count).toBe(0)
    }
  })

  it('should handle negative indices', () => {
    const records = [makeRecord({ topicIndices: [-1], voterType: 'debater' })]
    const result = computeVoteStats(topics, records)
    expect(result.total).toBe(1)
    for (const r of result.results) {
      expect(r.count).toBe(0)
    }
  })

  it('should calculate percentages with one decimal', () => {
    // 3 votes total, 1 vote for topic 0 → 33.3%
    const records = [
      makeRecord({ topicIndices: [0], voterType: 'debater' }),
      makeRecord({ topicIndices: [1], voterType: 'judge' }),
      makeRecord({ topicIndices: [2], voterType: 'admin' }),
    ]
    const result = computeVoteStats(topics, records)
    expect(result.results[0]!.percent).toBe(33.3)
  })
})

// ===================== buildVoterFingerprint =====================

describe('buildVoterFingerprint', () => {
  it('should return a string starting with fp_', () => {
    const fp = buildVoterFingerprint('192.168.1.1', 'Chrome/120')
    expect(fp).toMatch(/^fp_[a-z0-9]+$/)
  })

  it('should handle null ip', () => {
    const fp = buildVoterFingerprint(null, 'Mozilla')
    expect(fp).toMatch(/^fp_[a-z0-9]+$/)
  })

  it('should handle undefined userAgent', () => {
    const fp = buildVoterFingerprint('10.0.0.1', undefined)
    expect(fp).toMatch(/^fp_[a-z0-9]+$/)
  })

  it('should produce consistent fingerprints for identical input', () => {
    const a = buildVoterFingerprint('1.1.1.1', 'A')
    const b = buildVoterFingerprint('1.1.1.1', 'A')
    expect(a).toBe(b)
  })

  it('should produce different fingerprints for different input', () => {
    const a = buildVoterFingerprint('1.1.1.1', 'A')
    const b = buildVoterFingerprint('2.2.2.2', 'A')
    expect(a).not.toBe(b)
  })
})

// ===================== parseTopics =====================

describe('parseTopics', () => {
  it('should parse JSON array of strings', () => {
    const result = parseTopics('["气候变化","AI伦理"]')
    expect(result).toHaveLength(2)
    expect(result[0]!.text).toBe('气候变化')
    expect(result[1]!.text).toBe('AI伦理')
  })

  it('should parse JSON array of objects', () => {
    const result = parseTopics('[{"text":"AI","affirmative":"支持"}]')
    expect(result).toHaveLength(1)
    expect(result[0]!.text).toBe('AI')
    expect(result[0]!.affirmative).toBe('支持')
  })

  it('should return empty array for non-array JSON', () => {
    expect(parseTopics('{"key":"val"}')).toEqual([])
  })

  it('should return empty array for invalid JSON', () => {
    expect(parseTopics('not json')).toEqual([])
  })

  it('should filter out null items', () => {
    const result = parseTopics('["valid",""," "]')
    expect(result).toHaveLength(1)
    expect(result[0]!.text).toBe('valid')
  })
})
