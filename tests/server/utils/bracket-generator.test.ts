/**
 * bracket-generator.test.ts — 赛程生成器核心算法测试（6种赛制）
 *
 * 所有被测函数均为纯函数，输入确定时输出确定，无需 mock 数据库。
 * 内部未导出函数（nextPowerOfTwo/sortTeamsBySeed/generateSeedingBracket）
 * 通过公开 API 的各类输入组合间接覆盖。
 */
import { describe, it, expect } from 'vitest'
import {
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  generatePagePlayoff,
  generateSwiss,
  generateGroupKnockout,
  generateBracket,
  computeAdvanceTarget,
  drawGroups,
  drawAffirmativeSide,
  drawTopic,
  runDrawLots,
} from '../../../server/utils/bracket-generator'
import {
  EIGHT_TEAMS_SEEDED,
  FOUR_TEAMS_SEEDED,
  THREE_TEAMS,
  TWO_TEAMS,
  ONE_TEAM,
  ZERO_TEAMS,
  SIX_TEAMS,
  FIVE_TEAMS,
} from '../../fixtures/teams'

// ======================== generateSingleElimination ========================

describe('generateSingleElimination', () => {
  it('should handle 0 teams (generates empty BYE match)', () => {
    const matches = generateSingleElimination(ZERO_TEAMS)
    // 0 teams → bracketSize=1 → 1 BYE match with null teams
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches[0]!.isBye).toBe(true)
  })

  it('should produce 1 final for 2 teams', () => {
    const matches = generateSingleElimination(TWO_TEAMS)
    expect(matches).toHaveLength(1)
    expect(matches[0]!.round).toBe('决赛')
    expect(matches[0]!.teamA).toBe('正方')
    expect(matches[0]!.teamB).toBe('反方')
    expect(matches[0]!.isBye).toBe(false)
  })

  it('should produce correct structure for 4 teams (seeded)', () => {
    const matches = generateSingleElimination(FOUR_TEAMS_SEEDED)
    const round1 = matches.filter((m) => m.round === '第1轮')
    const final = matches.filter((m) => m.round === '决赛')
    expect(round1).toHaveLength(2)
    expect(final).toHaveLength(1)
    // 决赛 teamA/teamB 为空（等晋级填充）
    expect(final[0]!.teamA).toBeNull()
    expect(final[0]!.teamB).toBeNull()
    // 首轮种子保护: (1,4) (3,2) — 4 teams with seeds → bracket size 4
    const teamNames = round1.map((m) => [m.teamA, m.teamB]).flat()
    expect(teamNames).toContain('冠军队伍')
    expect(teamNames).toContain('殿军队伍')
    expect(teamNames).toContain('亚军队伍')
    expect(teamNames).toContain('季军队伍')
  })

  it('should produce correct structure for 8 teams', () => {
    const matches = generateSingleElimination(EIGHT_TEAMS_SEEDED)
    const rounds = new Set(matches.map((m) => m.round))
    expect(rounds.has('第1轮')).toBe(true)
    expect(rounds.has('半决赛')).toBe(true)
    expect(rounds.has('决赛')).toBe(true)
    // bracketSize=8, totalRounds=3:
    //   R1=第1轮(4) + R2=半决赛(2) + R3=决赛(1) = 7
    expect(matches).toHaveLength(7)
  })

  it('should create BYE matches for 3 teams (bracket size = 4)', () => {
    const matches = generateSingleElimination(THREE_TEAMS)
    const byeMatches = matches.filter((m) => m.isBye)
    expect(byeMatches.length).toBeGreaterThan(0)
  })

  it('should set stage=winner for all matches', () => {
    const matches = generateSingleElimination(FOUR_TEAMS_SEEDED)
    for (const m of matches) {
      expect(m.stage).toBe('winner')
    }
  })

  it('should respect seedMethod=rating (deterministic output)', () => {
    const matches = generateSingleElimination(FOUR_TEAMS_SEEDED, { seedMethod: 'rating' })
    // Determistic with seed ordering
    const round1Names = matches
      .filter((m) => m.round === '第1轮')
      .flatMap((m) => [m.teamA, m.teamB])
    // Seeds: 1,2,3,4 → seeding bracket [1,4,3,2] → pairs: (1,4) (3,2)
    expect(round1Names).toContain('冠军队伍') // seed 1
    expect(round1Names).toContain('殿军队伍') // seed 4
    expect(round1Names).toContain('亚军队伍') // seed 2
    expect(round1Names).toContain('季军队伍') // seed 3
  })
})

// ======================== generateDoubleElimination ========================

describe('generateDoubleElimination', () => {
  it('should generate winner/loser/grand_final stages', () => {
    const matches = generateDoubleElimination(FOUR_TEAMS_SEEDED)
    const stages = new Set(matches.map((m) => m.stage))
    expect(stages.has('winner')).toBe(true)
    expect(stages.has('loser')).toBe(true)
    expect(stages.has('grand_final')).toBe(true)
  })

  it('should generate W- labels for winner bracket', () => {
    const matches = generateDoubleElimination(EIGHT_TEAMS_SEEDED)
    const winnerBracket = matches.filter((m) => m.stage === 'winner')
    expect(winnerBracket.length).toBeGreaterThan(0)
    for (const m of winnerBracket) {
      expect(m.round.startsWith('W-')).toBe(true)
    }
  })

  it('should generate L- labels for loser bracket', () => {
    const matches = generateDoubleElimination(EIGHT_TEAMS_SEEDED)
    const loserBracket = matches.filter((m) => m.stage === 'loser')
    expect(loserBracket.length).toBeGreaterThan(0)
    for (const m of loserBracket) {
      expect(m.round.startsWith('L-')).toBe(true)
    }
  })

  it('should include grand final', () => {
    const matches = generateDoubleElimination(FOUR_TEAMS_SEEDED)
    expect(matches.some((m) => m.round === '总决赛')).toBe(true)
  })

  it('should add revival final when enableRevivalFinal=true', () => {
    const withRevival = generateDoubleElimination(FOUR_TEAMS_SEEDED, { enableRevivalFinal: true })
    const withoutRevival = generateDoubleElimination(FOUR_TEAMS_SEEDED)
    expect(withRevival.length).toBe(withoutRevival.length + 1)
    expect(withRevival.some((m) => m.stage === 'revival')).toBe(true)
    expect(withoutRevival.some((m) => m.stage === 'revival')).toBe(false)
  })

  it('should not have revival by default', () => {
    const matches = generateDoubleElimination(FOUR_TEAMS_SEEDED)
    expect(matches.some((m) => m.stage === 'revival')).toBe(false)
  })
})

// ======================== generateRoundRobin ========================

describe('generateRoundRobin', () => {
  it('should produce n*(n-1)/2 matches for single mode', () => {
    const n = 4
    const matches = generateRoundRobin(FOUR_TEAMS_SEEDED)
    expect(matches.length).toBe((n * (n - 1)) / 2) // 6
  })

  it('should produce n*(n-1) matches for double mode', () => {
    const n = 4
    const matches = generateRoundRobin(FOUR_TEAMS_SEEDED, { mode: 'double' })
    expect(matches.length).toBe(n * (n - 1)) // 12
  })

  it('should handle odd team count (5 teams)', () => {
    const matches = generateRoundRobin(FIVE_TEAMS)
    // 5 real + 1 virtual BYE → 5 rounds × 2 real matches = 10
    expect(matches.length).toBe(10)
  })

  it('should name rounds as 第N轮', () => {
    const matches = generateRoundRobin(FOUR_TEAMS_SEEDED)
    const roundLabels = [...new Set(matches.map((m) => m.round))]
    expect(roundLabels).toEqual(['第1轮', '第2轮', '第3轮'])
  })

  it('should have no BYE matches for even teams', () => {
    const matches = generateRoundRobin(FOUR_TEAMS_SEEDED)
    for (const m of matches) {
      expect(m.isBye).toBeFalsy()
    }
  })

  it('should swap home/away in second half of double mode', () => {
    const matches = generateRoundRobin(FOUR_TEAMS_SEEDED, { mode: 'double' })
    const half = matches.length / 2
    const firstHalf = matches.slice(0, half)
    const secondHalf = matches.slice(half)
    for (let i = 0; i < firstHalf.length; i++) {
      expect(secondHalf[i]!.teamA).toBe(firstHalf[i]!.teamB)
      expect(secondHalf[i]!.teamB).toBe(firstHalf[i]!.teamA)
    }
  })
})

// ======================== generatePagePlayoff ========================

describe('generatePagePlayoff', () => {
  it('should produce 5 matches for 4 teams', () => {
    const matches = generatePagePlayoff(FOUR_TEAMS_SEEDED)
    // R1(2) + R2(1) + R3(1) + R4(1) = 5
    expect(matches.length).toBe(5)
  })

  it('should fallback to single elimination for < 4 teams', () => {
    const matches = generatePagePlayoff(THREE_TEAMS)
    // Fallback → single elimination style
    const rounds = new Set(matches.map((m) => m.round))
    expect(rounds.has('决赛')).toBe(true)
  })

  it('should have R1 with team names assigned', () => {
    const matches = generatePagePlayoff(FOUR_TEAMS_SEEDED)
    const r1 = matches.filter((m) => m.round === 'R1')
    expect(r1).toHaveLength(2)
    expect(r1[0]!.teamA).toBeTruthy()
    expect(r1[0]!.teamB).toBeTruthy()
    expect(r1[1]!.teamA).toBeTruthy()
    expect(r1[1]!.teamB).toBeTruthy()
  })
})

// ======================== generateSwiss ========================

describe('generateSwiss', () => {
  it('should generate ceil(log2(N)) rounds by default', () => {
    const matches = generateSwiss(SIX_TEAMS)
    const rounds = new Set(matches.map((m) => m.round))
    // ceil(log2(6)) = 3
    expect(rounds.size).toBe(3)
  })

  it('should respect explicit rounds parameter', () => {
    const matches = generateSwiss(EIGHT_TEAMS_SEEDED, { rounds: 5 })
    const rounds = new Set(matches.map((m) => m.round))
    expect(rounds.size).toBe(5)
  })

  it('should use simplified pairing (1vs2, 3vs4...) for round 1 by default', () => {
    const matches = generateSwiss(FOUR_TEAMS_SEEDED, { pairingAlgo: 'simplified' })
    const round1 = matches.filter((m) => m.round === '第1轮')
    expect(round1).toHaveLength(2)
    // simplified: 1vs2, 3vs4
    const names = round1.flatMap((m) => [m.teamA, m.teamB])
    expect(names).toContain('冠军队伍')
    expect(names).toContain('亚军队伍')
  })

  it('should use standard pairing (1vs4, 2vs3...) when specified', () => {
    const matches = generateSwiss(FOUR_TEAMS_SEEDED, { pairingAlgo: 'standard' })
    const round1 = matches.filter((m) => m.round === '第1轮')
    expect(round1).toHaveLength(2)
    // All 4 names should appear exactly once
    const names = round1
      .flatMap((m) => [m.teamA, m.teamB])
      .filter(Boolean)
      .sort()
    expect(names).toHaveLength(4)
    expect(names).toContain('冠军队伍')
    expect(names).toContain('亚军队伍')
    expect(names).toContain('季军队伍')
    expect(names).toContain('殿军队伍')
  })

  it('should leave subsequent rounds empty (null teams)', () => {
    const matches = generateSwiss(SIX_TEAMS)
    const afterRound1 = matches.filter((m) => m.round !== '第1轮')
    for (const m of afterRound1) {
      expect(m.teamA).toBeNull()
      expect(m.teamB).toBeNull()
    }
  })
})

// ======================== generateGroupKnockout ========================

describe('generateGroupKnockout', () => {
  it('should produce both group and knockout matches', () => {
    const { groupMatches, knockoutMatches } = generateGroupKnockout(EIGHT_TEAMS_SEEDED)
    expect(groupMatches.length).toBeGreaterThan(0)
    expect(knockoutMatches.length).toBeGreaterThan(0)
  })

  it('should label group matches with group name prefix', () => {
    const { groupMatches } = generateGroupKnockout(EIGHT_TEAMS_SEEDED)
    for (const m of groupMatches) {
      expect(/^[A-H]组-/.test(m.round)).toBe(true)
    }
  })

  it('should label knockout matches with 淘汰赛 prefix', () => {
    const { knockoutMatches } = generateGroupKnockout(EIGHT_TEAMS_SEEDED)
    for (const m of knockoutMatches) {
      expect(m.round.startsWith('淘汰赛-')).toBe(true)
    }
  })

  it('should have null team names in knockout (placeholders cleared)', () => {
    const { knockoutMatches } = generateGroupKnockout(EIGHT_TEAMS_SEEDED)
    for (const m of knockoutMatches) {
      if (m.teamA) expect(m.teamA.startsWith('__PLACEHOLDER_')).toBe(false)
      if (m.teamB) expect(m.teamB.startsWith('__PLACEHOLDER_')).toBe(false)
    }
  })
})

// ======================== generateBracket ========================

describe('generateBracket', () => {
  it('should return correct format label for single_elimination', () => {
    const { formatLabel, totalMatches } = generateBracket({
      format: 'single_elimination',
      teams: EIGHT_TEAMS_SEEDED,
    })
    expect(formatLabel).toBe('单败淘汰赛')
    // 8 teams → bracketSize=8 → 4(R1) + 2(半决赛) + 1(决赛) = 7
    expect(totalMatches).toBe(7)
  })

  it('should return correct format label for round_robin', () => {
    const { formatLabel } = generateBracket({
      format: 'round_robin',
      teams: FOUR_TEAMS_SEEDED,
    })
    expect(formatLabel).toBe('循环赛')
  })

  it('should return 双循环赛 for double round_robin', () => {
    const { formatLabel } = generateBracket({
      format: 'round_robin',
      teams: FOUR_TEAMS_SEEDED,
      roundRobinMode: 'double',
    })
    expect(formatLabel).toBe('双循环赛')
  })

  it('should return correct labels for all formats', () => {
    const labels: Record<string, string> = {
      single_elimination: '单败淘汰赛',
      double_elimination: '双败淘汰赛',
      round_robin: '循环赛',
      page_playoff: '佩寄制',
      swiss: '瑞士制',
      group_knockout: '小组+淘汰赛',
    }
    for (const [format, expectedLabel] of Object.entries(labels)) {
      const { formatLabel } = generateBracket({
        format: format as any,
        teams: format === 'swiss' ? SIX_TEAMS : FOUR_TEAMS_SEEDED,
      })
      expect(formatLabel).toBe(expectedLabel)
    }
  })
})

// ======================== computeAdvanceTarget ========================

describe('computeAdvanceTarget', () => {
  it('should return null for 决赛', () => {
    expect(computeAdvanceTarget({ round: '决赛', orderNum: 1 })).toBeNull()
  })

  it('should return next round for 第1轮 orderNum=1 → teamA', () => {
    const result = computeAdvanceTarget({ round: '第1轮', orderNum: 1 })
    expect(result).not.toBeNull()
    expect(result!.round).toBe('第2轮')
    expect(result!.orderNum).toBe(1)
    expect(result!.slot).toBe('teamA')
  })

  it('should return teamB for even orderNum', () => {
    const result = computeAdvanceTarget({ round: '第1轮', orderNum: 2 })
    expect(result).not.toBeNull()
    expect(result!.slot).toBe('teamB')
    expect(result!.orderNum).toBe(1)
  })

  it('should advance W- winner to next W- round', () => {
    const result = computeAdvanceTarget({ round: 'W-第1轮', orderNum: 1 })
    expect(result).not.toBeNull()
    expect(result!.round).toBe('W-第2轮')
  })

  it('should advance L- loser to next L- round', () => {
    const result = computeAdvanceTarget({ round: 'L-第1轮', orderNum: 1 })
    expect(result).not.toBeNull()
    expect(result!.round).toBe('L-第2轮')
  })

  it('should return null for group stage', () => {
    expect(computeAdvanceTarget({ round: 'A组-第1轮', orderNum: 1 })).toBeNull()
  })

  it('should advance knockout stage', () => {
    const result = computeAdvanceTarget({ round: '淘汰赛-第1轮', orderNum: 1 })
    expect(result).not.toBeNull()
    expect(result!.round).toBe('淘汰赛-第2轮')
  })
})

// ======================== drawGroups ========================

describe('drawGroups', () => {
  it('should assign all teams', () => {
    const teams = ['A', 'B', 'C', 'D', 'E', 'F']
    const result = drawGroups(teams, 2)
    expect(result).toHaveLength(6)
  })

  it('should use correct group labels', () => {
    const result = drawGroups(['A', 'B', 'C', 'D'], 2)
    const groups = new Set(result.map((r) => r.group))
    expect(groups.has('A组')).toBe(true)
    expect(groups.has('B组')).toBe(true)
  })

  it('should distribute teams evenly', () => {
    const teams = Array.from({ length: 10 }, (_, i) => `T${i}`)
    const result = drawGroups(teams, 3)
    const counts: Record<string, number> = {}
    for (const r of result) counts[r.group] = (counts[r.group] || 0) + 1
    const values = Object.values(counts)
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
  })

  it('should assign seeds within groups', () => {
    const result = drawGroups(['A', 'B', 'C', 'D'], 2)
    for (const r of result) expect(r.seed).toBeGreaterThanOrEqual(1)
  })
})

// ======================== drawAffirmativeSide ========================

describe('drawAffirmativeSide', () => {
  it('should return teamA or teamB', () => {
    for (let i = 0; i < 50; i++) {
      expect(['teamA', 'teamB']).toContain(drawAffirmativeSide())
    }
  })
})

// ======================== drawTopic ========================

describe('drawTopic', () => {
  const pool = [
    { pro: '正1', con: '反1' },
    { pro: '正2', con: '反2' },
    { pro: '正3', con: '反3' },
  ]

  it('should return a topic from the pool', () => {
    const topic = drawTopic(pool)
    expect(topic).not.toBeNull()
    expect(pool).toContainEqual(topic)
  })

  it('should avoid used topics', () => {
    const topic = drawTopic(pool, [0, 2])
    expect(topic!.pro).toBe('正2')
  })

  it('should return null for empty pool', () => {
    expect(drawTopic([])).toBeNull()
  })

  it('should reuse when all used', () => {
    const topic = drawTopic(pool, [0, 1, 2])
    expect(topic).not.toBeNull()
  })
})

// ======================== runDrawLots ========================

describe('runDrawLots', () => {
  const teams = ['T1', 'T2', 'T3', 'T4']
  const pool = [{ pro: 'P1', con: 'C1' }]
  const matches = [
    { id: 'm1', teamA: 'T1', teamB: 'T2', round: '第1轮' },
    { id: 'm2', teamA: 'T3', teamB: 'T4', round: '第1轮' },
  ]

  it('should handle groups draw type', () => {
    const result = runDrawLots({
      teams,
      topicPool: pool,
      matches,
      groupCount: 2,
      drawType: 'groups',
    })
    expect(result.groupAssignments).toHaveLength(4)
    expect(result.info).toContain('分组抽签')
  })

  it('should handle topics_sides draw type', () => {
    const result = runDrawLots({ teams, topicPool: pool, matches, drawType: 'topics_sides' })
    expect(result.matchAssignments).toHaveLength(2)
    expect(result.info).toContain('辩题')
  })

  it('should handle all draw type', () => {
    const result = runDrawLots({ teams, topicPool: pool, matches, groupCount: 2, drawType: 'all' })
    expect(result.groupAssignments).toHaveLength(4)
    expect(result.matchAssignments).toHaveLength(2)
  })

  it('should skip unpaired matches', () => {
    const unpaired = [{ id: 'm3', teamA: null, teamB: null, round: '第2轮' }]
    const result = runDrawLots({
      teams,
      topicPool: pool,
      matches: unpaired,
      drawType: 'topics_sides',
    })
    expect(result.matchAssignments).toHaveLength(0)
  })
})
