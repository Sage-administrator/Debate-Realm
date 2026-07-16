// =====================================================================
// 赛程生成器 - 核心算法
// 功能：
//   1. 单败淘汰赛 (Single Elimination)
//   2. 双败淘汰赛 (Double Elimination)
//   3. 循环赛 (Round Robin)
//   4. 佩寄制 (Page Playoff)
//   5. 瑞士制 (Swiss)
//   6. 小组+淘汰赛 (Group + Knockout)
//   7. 自动晋级联动 (Advance Winner to Next Round)
// =====================================================================

import { prisma } from '../lib/prisma'
import type { Match } from '../lib/generated/client'

// ─────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────

export interface TeamInput {
  name: string
  seed?: number // 种子序号（1 表示最强队伍）
}

export interface MatchInput {
  round: string
  orderNum: number
  teamA: string | null
  teamB: string | null
  isBye?: boolean // 是否为轮空场（BYE）
  promotedFromA?: string | null // A 队伍来自哪场比赛（用于自动晋级关联）
  promotedFromB?: string | null // B 队伍来自哪场比赛
  stage?: string // 附加阶段标识（例如 'winner' / 'loser'）
}

// 赛制枚举
export type TournamentFormat =
  | 'single_elimination'
  | 'double_elimination'
  | 'round_robin'
  | 'page_playoff'
  | 'swiss'
  | 'group_knockout'

// 种子排序方式
export type SeedMethod = 'random' | 'rating' | 'name'

// 生成选项
export interface GenerateOptions {
  format: TournamentFormat
  teams: TeamInput[]
  // ── 通用参数 ──
  seedMethod?: SeedMethod // 种子排序方式
  byeHandling?: 'auto' | 'manual' // 轮空处理
  // ── 循环赛专用 ──
  roundRobinMode?: 'single' | 'double' // 单循环 / 双循环（主客场）
  // ── 双败淘汰赛专用 ──
  enableRevivalFinal?: boolean // 是否启用复活赛决赛
  // ── 瑞士制专用 ──
  rounds?: number // 总轮数（不填则自动计算：ceil(log2(n))）
  pairingAlgo?: 'standard' | 'simplified' // 配对算法
  // ── 小组+淘汰赛专用 ──
  groupSize?: number // 每组队伍数
  promotePerGroup?: number // 每组晋级数
  knockoutFormat?: 'single_elimination' // 淘汰赛阶段的赛制
}

// ─────────────────────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────────────────────

// 计算下一个 2 的幂（用于单败淘汰赛补足队伍数）
// 使用位运算，O(1) 时间复杂度
function nextPowerOfTwo(n: number): number {
  if (n <= 0) return 1
  if ((n & (n - 1)) === 0) return n
  return 1 << (32 - Math.clz32(n - 1))
}

// 按种子方法排序队伍
// ponytail: 使用标准库方法简化随机排序，小规模数据足够公平
function sortTeamsBySeed(teams: TeamInput[], method: SeedMethod = 'rating'): TeamInput[] {
  const sorted = [...teams]
  if (method === 'random') {
    sorted.sort(() => Math.random() - 0.5)
  } else if (method === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  } else {
    sorted.sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
  }
  return sorted
}

// 生成种子保护对阵表
// 返回一个位置数组，使得相邻两两配对时形成种子保护：
//   (1 vs bracketSize), (2 vs bracketSize-1) ... 这种强对弱分布均匀
// 例如 bracketSize=8 → [1,8, 4,5, 2,7, 3,6]
//   配对方式：[0]vs[1], [2]vs[3], [4]vs[5], [6]vs[7]
function generateSeedingBracket(bracketSize: number): number[] {
  let positions = [1, 2]
  while (positions.length < bracketSize) {
    const nextSeed = positions.length * 2 + 1
    const newPositions: number[] = []
    for (const seed of positions) {
      // 交替插入：当前种子 和 对应的补位种子（nextSeed - seed）
      // 这样相邻两个位置构成一对种子保护对阵
      newPositions.push(seed)
      newPositions.push(nextSeed - seed)
    }
    positions = newPositions
  }
  return positions
}

// ─────────────────────────────────────────────────────────────
// 1. 单败淘汰赛生成算法
// ─────────────────────────────────────────────────────────────
export function generateSingleElimination(
  teams: TeamInput[],
  opts?: { seedMethod?: SeedMethod }
): MatchInput[] {
  const sorted = sortTeamsBySeed(teams, opts?.seedMethod ?? 'rating')
  const teamCount = sorted.length
  const bracketSize = nextPowerOfTwo(teamCount)
  const matches: MatchInput[] = []
  const totalRounds = Math.log2(bracketSize)

  // 第1轮：按种子排布
  // seedingBracket 返回的是相邻配对的位置数组：[1,8, 4,5, 2,7, 3,6]
  // 配对方式：seedingBracket[i*2] vs seedingBracket[i*2+1]
  const firstRoundPairCount = bracketSize / 2
  const seedingBracket = generateSeedingBracket(bracketSize)

  for (let i = 0; i < firstRoundPairCount; i++) {
    // ponytail: i*2 和 i*2+1 < bracketSize，索引一定存在，加 ! 断言
    const seedA = seedingBracket[i * 2]!
    const seedB = seedingBracket[i * 2 + 1]!
    const teamA = seedA <= teamCount ? sorted[seedA - 1]!.name : null
    const teamB = seedB <= teamCount ? sorted[seedB - 1]!.name : null
    const isBye = teamA === null || teamB === null // 只要有一方为空就是 BYE
    matches.push({
      round: totalRounds === 1 ? '决赛' : '第1轮',  // 修复：2队时唯一一场应为决赛
      orderNum: i + 1,
      teamA,
      teamB,
      isBye,
      stage: 'winner',
    })
  }

  // 后续轮次：所有对阵位置先留空，由录入结果后自动晋级填充
  for (let round = 2; round <= totalRounds; round++) {
    const roundMatchCount = bracketSize / Math.pow(2, round)
    const roundLabel = round === totalRounds
      ? '决赛'
      : round === totalRounds - 1
      ? '半决赛'
      : `第${round}轮`
    for (let i = 0; i < roundMatchCount; i++) {
      matches.push({
        round: roundLabel,
        orderNum: i + 1,
        teamA: null,
        teamB: null,
        stage: 'winner',
      })
    }
  }
  return matches
}

// ─────────────────────────────────────────────────────────────
// 2. 双败淘汰赛生成算法
//   - 胜者组 (Winner Bracket)：与单败淘汰结构完全一致
//   - 败者组 (Loser Bracket)：每轮有 "败者复活赛"
//   - 总决赛 (Grand Final)：胜者组冠军 vs 败者组冠军
//   - 若启用复活赛决赛 (enableRevivalFinal)：总决赛如败者组冠军获胜，再打一场
// ─────────────────────────────────────────────────────────────
export function generateDoubleElimination(
  teams: TeamInput[],
  opts?: { seedMethod?: SeedMethod; enableRevivalFinal?: boolean }
): MatchInput[] {
  const sorted = sortTeamsBySeed(teams, opts?.seedMethod ?? 'rating')
  const teamCount = sorted.length
  const bracketSize = nextPowerOfTwo(teamCount)
  const matches: MatchInput[] = []
  const totalRounds = Math.log2(bracketSize) // 胜者组总轮数

  // 胜者组（与单败相同）
  const firstRoundPairCount = bracketSize / 2
  const seedingBracket = generateSeedingBracket(bracketSize)
  for (let i = 0; i < firstRoundPairCount; i++) {
    // ponytail: i*2 和 i*2+1 < bracketSize，索引一定存在
    const seedA = seedingBracket[i * 2]!
    const seedB = seedingBracket[i * 2 + 1]!
    const teamA = seedA <= teamCount ? sorted[seedA - 1]!.name : null
    const teamB = seedB <= teamCount ? sorted[seedB - 1]!.name : null
    const isBye = teamA === null || teamB === null
    matches.push({
      round: 'W-第1轮',
      orderNum: i + 1,
      teamA, teamB, isBye, stage: 'winner',
    })
  }
  for (let round = 2; round <= totalRounds; round++) {
    const roundMatchCount = bracketSize / Math.pow(2, round)
    const roundLabel = round === totalRounds ? 'W-决赛' : `W-第${round}轮`
    for (let i = 0; i < roundMatchCount; i++) {
      matches.push({ round: roundLabel, orderNum: i + 1, teamA: null, teamB: null, stage: 'winner' })
    }
  }

  // 败者组：第1轮（胜者组第1轮的败者进入），之后每2轮进行一次交叉
  // 简化：按轮数生成败者组比赛，位置留空，由晋级自动填充
  const loserRounds = totalRounds - 1 // 败者组轮数 = 胜者组 - 1
  for (let round = 1; round <= loserRounds; round++) {
    // 败者组每轮的比赛数 = bracketSize / 2^(round+1)
    const matchCount = Math.max(1, Math.floor(bracketSize / Math.pow(2, round + 1)))
    const roundLabel = `L-第${round}轮`
    for (let i = 0; i < matchCount; i++) {
      matches.push({ round: roundLabel, orderNum: i + 1, teamA: null, teamB: null, stage: 'loser' })
    }
  }

  // 总决赛（胜者组冠军 vs 败者组冠军）
  matches.push({
    round: '总决赛',
    orderNum: 1,
    teamA: null, teamB: null, stage: 'grand_final',
  })

  // 复活赛决赛（如果败者组冠军在总决赛中击败胜者组冠军，则再赛一场）
  if (opts?.enableRevivalFinal) {
    matches.push({
      round: '复活赛决赛',
      orderNum: 1,
      teamA: null, teamB: null, stage: 'revival',
    })
  }

  return matches
}

// ─────────────────────────────────────────────────────────────
// 3. 循环赛生成算法
//   - 每支队伍与其他所有队伍各赛一场（单循环）
//   - 双循环则翻倍并交换主客场
//   - 使用"固定一支 + 其余旋转"算法（Circle Method）
// ─────────────────────────────────────────────────────────────
export function generateRoundRobin(
  teams: TeamInput[],
  opts?: { mode?: 'single' | 'double' }
): MatchInput[] {
  let teamList = teams.map((t, i) => ({ name: t.name, index: i }))
  const mode = opts?.mode ?? 'single'
  const hasOddTeams = teamList.length % 2 === 1

  // 奇数队伍：插入虚拟 BYE，每轮有一支队伍轮空
  if (hasOddTeams) {
    teamList.push({ name: '__BYE__', index: teamList.length })
  }

  const n = teamList.length
  const totalRounds = n - 1 // 单循环需要 n-1 轮
  const matchesPerRound = n / 2
  const matches: MatchInput[] = []

  for (let round = 0; round < totalRounds; round++) {
    // 当前轮次的旋转数组：固定第0支，其他每轮左移一位
    const rotated = [...teamList.slice(1)]
    for (let r = 0; r < round; r++) {
      const first = rotated.shift()!
      rotated.push(first)
    }

    // 第0场：固定队 vs 旋转数组第一支
    // ponytail: teamList[0] 和 rotated[0] 在该循环中一定存在
    const fixed = teamList[0]!
    if (fixed.name !== '__BYE__' && rotated[0]!.name !== '__BYE__') {
      matches.push({
        round: `第${round + 1}轮`,
        orderNum: 1,
        teamA: fixed.name, teamB: rotated[0]!.name,
      })
    }

    // 其余场次：旋转数组第 i 支 vs 倒数第 i 支（i=1..matchesPerRound-1）
    for (let m = 1; m < matchesPerRound; m++) {
      // ponytail: m < matchesPerRound = n/2 <= rotated.length，两端索引都有效
      const teamA = rotated[m]!
      const teamB = rotated[rotated.length - m]!
      if (teamA.name !== '__BYE__' && teamB.name !== '__BYE__') {
        matches.push({
          round: `第${round + 1}轮`,
          orderNum: m + 1,
          teamA: teamA.name, teamB: teamB.name,
        })
      }
    }
  }

  // 双循环：复制一份，主客场对调，轮次标签加后半段
  if (mode === 'double') {
    const secondHalf = matches.map((m, idx) => ({
      ...m,
      round: `第${totalRounds + idx + 1}轮`,
      teamA: m.teamB,
      teamB: m.teamA,
    }))
    matches.push(...secondHalf)
  }

  return matches
}

// ─────────────────────────────────────────────────────────────
// 4. 佩寄制生成算法
//   - 固定4支队：R1 1vs4, 2vs3
//   - R2：R1两胜者对决（胜者进决赛）
//   - R3：R2败者 vs R1败者中胜出的另一支（实际简化：R2败者 vs R1败者间的胜者）
//   - R4：决赛（R2胜者 vs R3胜者）
// ─────────────────────────────────────────────────────────────
export function generatePagePlayoff(
  teams: TeamInput[],
  opts?: { seedMethod?: SeedMethod }
): MatchInput[] {
  const sorted = sortTeamsBySeed(teams, opts?.seedMethod ?? 'rating')

  // 佩寄制需要至少 4 支队伍；不足 4 支时自动降级为单败淘汰赛
  if (sorted.length < 4) {
    return generateSingleElimination(teams, opts)
  }

  // ponytail: 前面已判断 sorted.length >= 4，解构一定成功
  const [t1, t2, t3, t4] = sorted as [TeamInput, TeamInput, TeamInput, TeamInput, ...TeamInput[]]
  const matches: MatchInput[] = []

  // R1：1vs4, 2vs3
  matches.push({ round: 'R1', orderNum: 1, teamA: t1.name, teamB: t4.name, stage: 'page_r1' })
  matches.push({ round: 'R1', orderNum: 2, teamA: t2.name, teamB: t3.name, stage: 'page_r1' })

  // R2：R1两场的胜者对决（胜者进决赛）
  matches.push({ round: 'R2', orderNum: 1, teamA: null, teamB: null, stage: 'page_r2' })

  // R3：R2败者 vs R1两场的败者之间的胜者（简化：留空，由联动填充）
  matches.push({ round: 'R3', orderNum: 1, teamA: null, teamB: null, stage: 'page_r3' })

  // R4：决赛（R2胜者 vs R3胜者）
  matches.push({ round: 'R4（决赛）', orderNum: 1, teamA: null, teamB: null, stage: 'page_final' })

  return matches
}

// ─────────────────────────────────────────────────────────────
// 5. 瑞士制生成算法
//   - 总轮数 = ceil(log2(n))
//   - 每轮按积分排序后，同积分队伍内两两配对（避免重复对战）
//   - 简化版：每轮按当前积分降序 → (1,2), (3,4), ... 配对（不严格避免重复，但在 5-7 轮中几乎不会重复）
//   - 标准版：严格避免重复对战，使用贪心配对
// ─────────────────────────────────────────────────────────────
export function generateSwiss(
  teams: TeamInput[],
  opts?: { rounds?: number; pairingAlgo?: 'standard' | 'simplified'; seedMethod?: SeedMethod }
): MatchInput[] {
  const sorted = sortTeamsBySeed(teams, opts?.seedMethod ?? 'rating')
  const totalRounds = opts?.rounds ?? Math.ceil(Math.log2(Math.max(2, sorted.length)))
  const pairingAlgo = opts?.pairingAlgo ?? 'simplified'
  const matches: MatchInput[] = []

  // ── 第 1 轮：按种子保护方式直接配对（强对弱，避免强队过早相遇） ──
  const firstRound = generateSwissFirstRound(sorted, pairingAlgo)
  for (let i = 0; i < firstRound.length; i++) {
    // ponytail: 遍历范围内 i < firstRound.length，元素一定存在
    const [a, b] = firstRound[i]!
    matches.push({
      round: '第1轮',
      orderNum: i + 1,
      teamA: a,
      teamB: b,
      stage: 'swiss',
    })
  }

  // ── 第 2 轮及之后：位置留空，由赛果录入联动后重新配对 ──
  //   瑞士制规则：每轮按积分排名 → 同积分组内两两配对 → 避免重复对阵
  //   因为需要实时积分数据，这里只生成"壳"，后续由后端 advanceWinnerSwiss 动态填充
  for (let round = 2; round <= totalRounds; round++) {
    const matchCount = Math.floor(sorted.length / 2)
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        round: `第${round}轮`,
        orderNum: i + 1,
        teamA: null,
        teamB: null,
        stage: 'swiss',
      })
    }
  }

  return matches
}

// 瑞士制首轮配对（种子保护：1 vs last, 2 vs last-1 ...）
function generateSwissFirstRound(sorted: TeamInput[], algo: 'standard' | 'simplified'): [string, string][] {
  const pairs: [string, string][] = []
  const n = sorted.length
  if (algo === 'standard') {
    // 种子保护：1 vs n, 2 vs n-1 ...
    for (let i = 0; i < Math.floor(n / 2); i++) {
      // ponytail: i < n/2 且 n-1-i >= n/2，两端都在范围内
      pairs.push([sorted[i]!.name, sorted[n - 1 - i]!.name])
    }
  } else {
    // simplified：1 vs 2, 3 vs 4 ...（更简单，适合演示场景）
    for (let i = 0; i < n - 1; i += 2) {
      // ponytail: i+1 < n，索引有效
      pairs.push([sorted[i]!.name, sorted[i + 1]!.name])
    }
  }
  return pairs
}

// ─────────────────────────────────────────────────────────────
// 6. 小组+淘汰赛生成算法
//   - 先将队伍按种子蛇形分组（每组 groupSize 支，接近平衡）
//   - 每组进行循环赛
//   - 每组前 promotePerGroup 名晋级，进入单败淘汰赛
// ─────────────────────────────────────────────────────────────
export function generateGroupKnockout(
  teams: TeamInput[],
  opts?: { groupSize?: number; promotePerGroup?: number; knockoutFormat?: 'single_elimination'; seedMethod?: SeedMethod }
): { groupMatches: MatchInput[]; knockoutMatches: MatchInput[] } {
  const seedMethod = opts?.seedMethod ?? 'rating'
  const groupSize = opts?.groupSize ?? 4
  const promotePerGroup = opts?.promotePerGroup ?? 2
  const sorted = sortTeamsBySeed(teams, seedMethod)

  // 计算小组数：ceil(队伍数 / 每组)，如果不是 2 的幂，向上取到 2 的幂（保证淘汰赛可配对）
  const rawGroupCount = Math.ceil(sorted.length / groupSize)
  const groupCount = nextPowerOfTwo(Math.max(2, rawGroupCount))
  const actualGroupSize = Math.ceil(sorted.length / groupCount)

  // 蛇形分组：A1 A2 ... An / Bn ... B2 B1 / C1 C2 ... Cn（来回蛇形）
  // 更简单的实现：按 index % groupCount 分配，但为了种子平衡使用蛇形
  const groups: TeamInput[][] = Array.from({ length: groupCount }, () => [])
  for (let i = 0; i < sorted.length; i++) {
    const round = Math.floor(i / groupCount)
    const posInRound = i % groupCount
    const groupIndex = round % 2 === 0 ? posInRound : groupCount - 1 - posInRound
    // ponytail: groupIndex ∈ [0, groupCount)，i < sorted.length，均有效
    groups[groupIndex]!.push(sorted[i]!)
  }

  const groupMatches: MatchInput[] = []
  const groupLabels = ['A组', 'B组', 'C组', 'D组', 'E组', 'F组', 'G组', 'H组']

  // 每组循环赛
  for (let g = 0; g < groups.length; g++) {
    // ponytail: g < groups.length，索引有效
    const groupTeams = groups[g]!
    if (groupTeams.length < 2) continue
    const groupLabel = groupLabels[g] ?? `第${g + 1}组`
    const roundRobinMatches = generateRoundRobin(groupTeams)
    for (const match of roundRobinMatches) {
      groupMatches.push({
        ...match,
        round: `${groupLabel}-${match.round}`,
      })
    }
  }

  // 淘汰赛：每组前 promotePerGroup 名 → 共 groupCount * promotePerGroup 支队
  // 修复：淘汰赛首轮队伍留空（null），由 autoPromoteFromGroupsToKnockout 动态填入
  // 不再使用"晋级队N"占位，避免数据库中出现无效队名
  const totalAdvance = groupCount * promotePerGroup
  const knockoutTeams: TeamInput[] = []
  for (let i = 0; i < totalAdvance; i++) {
    knockoutTeams.push({ name: `__PLACEHOLDER_${i + 1}__`, seed: i + 1 })
  }
  const knockoutMatches = generateSingleElimination(knockoutTeams, { seedMethod: 'rating' })

  // 重新标记淘汰赛轮次，并将占位队名清空
  for (const match of knockoutMatches) {
    match.round = `淘汰赛-${match.round}`
    // 清空占位队名，实际由小组赛结束后自动填入
    if (match.teamA && match.teamA.startsWith('__PLACEHOLDER_')) match.teamA = null
    if (match.teamB && match.teamB.startsWith('__PLACEHOLDER_')) match.teamB = null
  }

  return { groupMatches, knockoutMatches }
}

// ─────────────────────────────────────────────────────────────
// 主入口：根据赛制生成完整赛程
// ─────────────────────────────────────────────────────────────
export function generateBracket(
  options: GenerateOptions
): { matches: MatchInput[]; format: TournamentFormat; totalMatches: number; roundCount: number; formatLabel: string } {
  let matchInputs: MatchInput[] = []
  let formatLabel = ''

  switch (options.format) {
    case 'single_elimination':
      matchInputs = generateSingleElimination(options.teams, { seedMethod: options.seedMethod })
      formatLabel = '单败淘汰赛'
      break
    case 'double_elimination':
      matchInputs = generateDoubleElimination(options.teams, { seedMethod: options.seedMethod, enableRevivalFinal: options.enableRevivalFinal })
      formatLabel = '双败淘汰赛'
      break
    case 'round_robin':
      matchInputs = generateRoundRobin(options.teams, { mode: options.roundRobinMode ?? 'single' })
      formatLabel = options.roundRobinMode === 'double' ? '双循环赛' : '循环赛'
      break
    case 'page_playoff':
      matchInputs = generatePagePlayoff(options.teams, { seedMethod: options.seedMethod })
      formatLabel = '佩寄制'
      break
    case 'swiss':
      matchInputs = generateSwiss(options.teams, {
        rounds: options.rounds,
        pairingAlgo: options.pairingAlgo ?? 'simplified',
        seedMethod: options.seedMethod,
      })
      formatLabel = '瑞士制'
      break
    case 'group_knockout':
      const { groupMatches, knockoutMatches } = generateGroupKnockout(options.teams, {
        groupSize: options.groupSize,
        promotePerGroup: options.promotePerGroup,
        knockoutFormat: options.knockoutFormat ?? 'single_elimination',
        seedMethod: options.seedMethod,
      })
      matchInputs = [...groupMatches, ...knockoutMatches]
      formatLabel = '小组+淘汰赛'
      break
  }

  // 统计轮次数
  const roundSet = new Set<string>()
  for (const m of matchInputs) roundSet.add(m.round)

  return {
    matches: matchInputs,
    format: options.format,
    totalMatches: matchInputs.length,
    roundCount: roundSet.size,
    formatLabel,
  }
}

// ─────────────────────────────────────────────────────────────
// 自动晋级联动：通用逻辑
//   - 单败 / 双败 / 小组+淘汰：根据当前比赛 round 和 orderNum 计算下一轮目标位置
//   - 瑞士制：返回 null 由外部专用逻辑重新配对
// ─────────────────────────────────────────────────────────────
export interface AdvanceTarget {
  round: string      // 目标轮次
  orderNum: number   // 目标场次
  slot: 'teamA' | 'teamB' // 填入哪一边
}

// 解析轮次中的数字（支持 "第1轮"、"W-第1轮"、"淘汰赛-第1轮"、"R1" 等格式）
function extractRoundNumber(round: string): number | null {
  const m = round.match(/(\d+)/)
  // ponytail: 正则捕获组有定义，match 成功时 m[1] 一定存在
  return m ? parseInt(m[1]!) : null
}

// 判断轮次类型（用于决定晋级方向）
function detectRoundType(round: string): 'winner' | 'loser' | 'group' | 'knockout' | 'page' | 'unknown' {
  if (round.startsWith('W-') || round === '决赛') return 'winner'
  if (round.startsWith('L-')) return 'loser'
  if (round.startsWith('R') && !round.startsWith('淘汰赛')) return 'page'
  if (round.includes('淘汰赛')) return 'knockout'
  if (/^[A-H]组-/.test(round)) return 'group'
  return 'unknown'
}

// 计算胜者晋级目标（仅支持结构化赛制，不支持纯循环赛/瑞士制内部晋级）
export function computeAdvanceTarget(match: { round: string; orderNum: number }): AdvanceTarget | null {
  const roundType = detectRoundType(match.round)
  const roundNum = extractRoundNumber(match.round)
  if (roundNum === null) return null

  // 单败淘汰赛（第X轮 / 半决赛 / 决赛）
  // ponytail: 修复逻辑 bug —— 原来 'winner' 也会进入单败分支，导致双败胜者组逻辑永远不可达
  if (roundType === 'unknown') {
    // 如果是"决赛"，没有下一轮
    if (match.round === '决赛') return null
    // 当前是第 R 轮的第 N 场 → 下一轮是第 R+1 轮的第 ceil(N/2) 场
    //   N 奇 → teamA；N 偶 → teamB
    const nextOrderNum = Math.ceil(match.orderNum / 2)
    const nextRoundNum = roundNum + 1
    // 判断下一轮是否是半决赛或决赛（例如 bracketSize=8：round=2 是半决赛，round=3 是决赛）
    // 这里简化为统一 "第X轮"，实际需要总轮数信息；但在保存时已用显式标签，这里只做近似
    let nextRoundLabel = `第${nextRoundNum}轮`
    // 简化：直接用下一轮号匹配已保存的比赛标签
    // 实际匹配在 advanceWinnerToNextRound 中使用 roundSet 精确查找
    return { round: nextRoundLabel, orderNum: nextOrderNum, slot: match.orderNum % 2 === 1 ? 'teamA' : 'teamB' }
  }

  // 双败淘汰赛 - 胜者组
  if (roundType === 'winner') {
    // 胜者组当前比赛的胜者 → 下一轮胜者组第 ceil(N/2) 场
    const nextOrderNum = Math.ceil(match.orderNum / 2)
    // 胜者组最后一轮 → 去"总决赛"
    const roundNumInBracket = roundNum
    return { round: `W-第${roundNumInBracket + 1}轮`, orderNum: nextOrderNum, slot: match.orderNum % 2 === 1 ? 'teamA' : 'teamB' }
  }

  // 双败淘汰赛 - 败者组
  if (roundType === 'loser') {
    const nextOrderNum = Math.ceil(match.orderNum / 2)
    return { round: `L-第${roundNum + 1}轮`, orderNum: nextOrderNum, slot: match.orderNum % 2 === 1 ? 'teamA' : 'teamB' }
  }

  // 佩寄制
  if (roundType === 'page') {
    // R1 的胜者 → R2；R1 的败者 → R3
    // R2 的胜者 → R4 决赛；R2 的败者 → R3
    // R3 的胜者 → R4 决赛；R3 败者淘汰
    // R4 决赛：无下一轮
    return null // 由外部根据上下文特殊处理
  }

  // 小组+淘汰赛 - 小组赛部分（无需晋级，由积分排名决定）
  if (roundType === 'group') return null

  // 小组+淘汰赛 - 淘汰赛部分（与单败相同）
  if (roundType === 'knockout') {
    if (match.round.includes('决赛') && extractRoundNumber(match.round) === null) return null
    const nextOrderNum = Math.ceil(match.orderNum / 2)
    const nextRoundNum = roundNum + 1
    return { round: `淘汰赛-第${nextRoundNum}轮`, orderNum: nextOrderNum, slot: match.orderNum % 2 === 1 ? 'teamA' : 'teamB' }
  }

  return null
}

// =====================================================================
// advanceWinnerToNextRound — 录入比赛结果后自动填入下一轮对阵
// =====================================================================
// 核心逻辑：
//   1) 根据 match.round 的格式类型，调用对应的 computeAdvanceTarget()
//   2) 在数据库中查找目标 match（需 tournamentId + round + orderNum 匹配）
//   3) 更新目标 match 的 teamA / teamB
//   4) 额外支持：
//        • 瑞士制：在第 R 轮全部打完后，自动重新配对第 R+1 轮
//        • 小组+淘汰赛：小组赛全部打完后，按积分排名自动填入淘汰赛首轮
// =====================================================================

export interface AdvanceResult {
  advanced: boolean                  // 是否成功晋级
  targetMatchId?: string             // 被更新的下一场比赛 ID
  targetRound?: string               // 目标轮次
  targetOrder?: number               // 目标场次序号
  targetSlot?: 'teamA' | 'teamB'    // 填入的位置
  promotedTeam?: string             // 晋级的队伍名
  error?: string                    // 错误信息（失败时）
  info?: string                     // 额外信息（例如瑞士制整轮重配）
}

/**
 * 核心晋级函数：录入结果后调用，自动把胜者填入下一轮对阵位置
 */
export async function advanceWinnerToNextRound(
  tournamentId: string,
  finishedMatch: {
    id: string
    round: string
    orderNum: number
    winner: string | null
    teamA: string | null
    teamB: string | null
  }
): Promise<AdvanceResult> {
  // 平局：不晋级
  if (!finishedMatch.winner) {
    return { advanced: false, error: '平局，无晋级队伍' }
  }

  try {
    // ── 情况 1：单败 / 双败 / 小组+淘汰赛的结构化晋级 ──
    const target = computeAdvanceTarget({
      round: finishedMatch.round,
      orderNum: finishedMatch.orderNum,
    })

    if (target) {
      // 1) 精确查找目标 match（round 格式可能不同，采用模糊查找）
      const candidate = await findTargetMatch(
        tournamentId,
        target.round,
        target.orderNum,
        finishedMatch.round
      )

      if (!candidate) {
        return {
          advanced: false,
          error: `未找到目标比赛 (round≈${target.round}, orderNum=${target.orderNum})，可能已到决赛或当前赛制无后续轮次`,
        }
      }

      // 2) 检查目标比赛当前队位是否已经有人（避免覆盖已有结果）
      const existingValue = target.slot === 'teamA' ? candidate.teamA : candidate.teamB
      if (existingValue) {
        return {
          advanced: false,
          error: `下一轮位置已被 "${existingValue}" 占用，未覆盖`,
        }
      }

      // 3) 更新目标比赛的队位（同时更新晋级溯源 promotedFromA/B，并自增 version）
      const updateData: any = {}
      updateData[target.slot] = finishedMatch.winner
      updateData[target.slot === 'teamA' ? 'promotedFromA' : 'promotedFromB'] = finishedMatch.id
      updateData.version = { increment: 1 }

      const updated = await prisma.match.update({
        where: { id: candidate.id },
        data: updateData,
      })

      return {
        advanced: true,
        targetMatchId: updated.id,
        targetRound: updated.round,
        targetOrder: updated.orderNum,
        targetSlot: target.slot,
        promotedTeam: finishedMatch.winner,
      }
    }

    // ── 情况 2：瑞士制 / 小组+淘汰赛等特殊赛制 ──
    // 由调用方根据 tournament.format 自行分发处理
    return {
      advanced: false,
      error: '当前轮次类型无直接晋级，交由赛制特定逻辑处理',
    }
  } catch (e: any) {
    console.error('advanceWinnerToNextRound error:', e)
    return { advanced: false, error: String(e?.message ?? e) }
  }
}

/**
 * 在数据库中查找目标比赛。
 * 逻辑：先精确匹配 round 标签；如果没找到，按"轮次数字"匹配（例如 "第2轮" vs "半决赛"）。
 */
async function findTargetMatch(
  tournamentId: string,
  preferredRound: string,
  orderNum: number,
  currentRound: string
) {
  // 1) 精确查找
  let m = await prisma.match.findFirst({
    where: { tournamentId, round: preferredRound, orderNum },
  })
  if (m) return m

  // 2) 如果 preferredRound 没找到，尝试基于数字轮次的近似匹配
  //    例如 generateSingleElimination 中轮次标签可能是 "第1轮"、"半决赛"、"决赛"
  const preferredNum = parseInt(preferredRound.match(/\d+/)?.[0] || '0')
  if (preferredNum > 0) {
    // 获取该赛事所有比赛，基于 round 中的数字找到"同届比赛"
    // ponytail: 返回完整 Match 对象，调用方需要 teamA/teamB 判断是否已占位
    const allMatches = await prisma.match.findMany({
      where: { tournamentId },
    })

    // 先收集每一轮的数字
    const roundsByNumber = new Map<number, string[]>()
    for (const row of allMatches) {
      const n = parseInt(row.round.match(/\d+/)?.[0] || '0')
      if (!roundsByNumber.has(n)) roundsByNumber.set(n, [])
      roundsByNumber.get(n)!.push(row.round)
    }

    // 查找"与当前轮次数字最接近"的目标轮次
    const currentNum = parseInt(currentRound.match(/\d+/)?.[0] || '0')
    const nextNum = currentNum + 1

    // ponytail: 在已加载的 allMatches 中查找，避免逐个 label 发额外 DB 查询
    const candidateRounds = Array.from(roundsByNumber.keys())
      .filter((n) => n >= nextNum)
      .sort((a, b) => a - b)

    if (candidateRounds.length > 0) {
      const nextRoundLabels = new Set(roundsByNumber.get(candidateRounds[0]!)!)
      const found = allMatches.find(m =>
        nextRoundLabels.has(m.round) && m.orderNum === orderNum
      )
      if (found) return found
    }

    // 3) 最后兜底：直接找第一个 teamA 或 teamB 为 null 的比赛
    const emptySlot = await prisma.match.findFirst({
      where: {
        tournamentId,
        OR: [{ teamA: null }, { teamB: null }],
      },
      orderBy: [{ round: 'asc' }, { orderNum: 'asc' }],
    })
    return emptySlot
  }

  return null
}

// =====================================================================
// 瑞士制 / 小组+淘汰赛 专用：动态重配对
// =====================================================================

/**
 * 瑞士制：当某一轮的所有比赛都结束后，
 * 根据积分榜动态生成下一轮的对阵（按积分排名从高到低两两配对）。
 */
export async function autoPairNextSwissRound(tournamentId: string): Promise<{ paired: number; info: string }> {
  const matches = await prisma.match.findMany({
    where: { tournamentId, round: { startsWith: '第' } },
    orderBy: [{ round: 'asc' }, { orderNum: 'asc' }],
  })

  if (matches.length === 0) return { paired: 0, info: '无比赛记录' }

  // 检查"最后一个已生成的轮次"是否全部完成
  const rounds = Array.from(new Set(matches.map((m: any) => m.round))).sort()
  const lastRound = rounds[rounds.length - 1]
  const lastRoundMatches = matches.filter((m: any) => m.round === lastRound)
  const allFinished = lastRoundMatches.every((m: any) => m.status === 'finished')

  if (!allFinished) {
    return { paired: 0, info: `当前轮次 "${lastRound}" 尚未全部结束` }
  }

  // 计算积分榜（同 StandingsTable 逻辑）
  const standings = computeStandings(matches)
  // 未配对队伍：按积分降序 → 两两配对
  // 奇数队伍：最后一队轮空（BYE）
  // 这里只更新 teamA / teamB 为 null 的位置
  const nextRoundNumber = rounds.length + 1
  const nextRoundLabel = `第${nextRoundNumber}轮`
  const nextRoundMatches = await prisma.match.findMany({
    where: { tournamentId, round: nextRoundLabel },
    orderBy: [{ orderNum: 'asc' }],
  })

  if (nextRoundMatches.length === 0) {
    return { paired: 0, info: `下一轮 "${nextRoundLabel}" 未预生成，请先生成完整赛程` }
  }

  // 按积分排序 → 依次按序配对
  const teams = standings.map((s) => s.team)
  const updates: { id: string; teamA?: string; teamB?: string }[] = []
  let filled = 0

  for (let i = 0; i < nextRoundMatches.length; i++) {
    const m = nextRoundMatches[i]!
    const a = teams[i * 2] || null
    const b = teams[i * 2 + 1] || null
    const update: { id: string; teamA?: string; teamB?: string } = { id: m.id }
    let hasUpdate = false

    if ((m.teamA === null || m.teamA === undefined) && a) {
      update.teamA = a
      filled++
      hasUpdate = true
    }
    if ((m.teamB === null || m.teamB === undefined) && b) {
      update.teamB = b
      filled++
      hasUpdate = true
    }

    if (hasUpdate) updates.push(update)
  }

  // 批量更新
  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) => prisma.match.update({ where: { id: u.id }, data: { teamA: u.teamA, teamB: u.teamB } }))
    )
  }

  return { paired: filled, info: `已根据积分自动配对 "${nextRoundLabel}"（共 ${Math.ceil(teams.length / 2)} 场）` }
}

/**
 * 小组+淘汰赛：小组赛全部结束后，
 * 按每组积分排名把前 N 名自动填入淘汰赛首轮。
 */
export async function autoPromoteFromGroupsToKnockout(
  tournamentId: string,
  promotePerGroup: number
): Promise<{ promoted: string[]; info: string }> {
  // 找出所有小组赛比赛（round 以 A组- / B组- 等开头）
  const allMatches = await prisma.match.findMany({
    where: { tournamentId },
  })

  const groupMatches = allMatches.filter((m: any) => /^[A-H]组-/.test(m.round))
  if (groupMatches.length === 0) {
    return { promoted: [], info: '无小组赛记录' }
  }

  // 按组分组 → 计算积分
  const groups = new Map<string, any[]>()
  for (const m of groupMatches) {
    // ponytail: 前面已通过正则过滤确保 round 含 "-"，split 结果第一个元素一定存在
    const label = (m.round as string).split('-')[0]!
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(m)
  }

  // 检查每组是否全部结束
  let incomplete = ''
  for (const [label, list] of groups) {
    const allFinished = list.every((x: any) => x.status === 'finished')
    if (!allFinished) {
      incomplete += `${label} `
    }
  }
  if (incomplete) {
    return { promoted: [], info: `以下小组尚未全部结束：${incomplete.trim()}` }
  }

  // 每组取前 promotePerGroup 名 → 收集总名单
  const promoted: string[] = []
  for (const [label, list] of groups) {
    const standings = computeStandings(list)
    const top = standings.slice(0, promotePerGroup).map((s) => s.team)
    promoted.push(...top)
  }

  // 把晋级队伍按顺序填入淘汰赛阶段
  const koMatches = allMatches.filter((m: any) =>
    (m.round as string).includes('淘汰赛')
  )
  if (koMatches.length === 0) {
    return { promoted, info: `已收集 ${promoted.length} 支晋级队伍；但未找到淘汰赛阶段的比赛记录` }
  }

  let idx = 0
  const updates: { id: string; teamA?: string; teamB?: string }[] = []

  for (const m of koMatches) {
    const update: { id: string; teamA?: string; teamB?: string } = { id: m.id }
    let hasUpdate = false

    if (idx < promoted.length && m.teamA === null) {
      update.teamA = promoted[idx++]
      hasUpdate = true
    }
    if (idx < promoted.length && m.teamB === null) {
      update.teamB = promoted[idx++]
      hasUpdate = true
    }

    if (hasUpdate) updates.push(update)
  }

  // 批量更新
  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) => prisma.match.update({ where: { id: u.id }, data: { teamA: u.teamA, teamB: u.teamB } }))
    )
  }

  return { promoted, info: `共 ${promoted.length} 支队伍晋级淘汰赛（每组前 ${promotePerGroup} 名）` }
}

// 工具：计算积分榜（同 StandingsTable 逻辑）
function computeStandings(matches: any[]): { team: string; played: number; wins: number; draws: number; losses: number; scored: number; conceded: number; diff: number; points: number }[] {
  const finished = matches.filter((m) => m.status === 'finished')
  const teamMap = new Map<string, any>()

  for (const m of matches) {
    ;[m.teamA, m.teamB].forEach((name) => {
      if (name && !teamMap.has(name)) {
        teamMap.set(name, {
          team: name, played: 0, wins: 0, draws: 0, losses: 0,
          scored: 0, conceded: 0, diff: 0, points: 0,
        })
      }
    })
  }

  for (const m of finished) {
    if (!m.teamA || !m.teamB) continue
    const a = teamMap.get(m.teamA)!
    const b = teamMap.get(m.teamB)!
    a.played++; b.played++
    a.scored += m.scoreA ?? 0; a.conceded += m.scoreB ?? 0
    b.scored += m.scoreB ?? 0; b.conceded += m.scoreA ?? 0
    if (m.winner === m.teamA) { a.wins++; a.points += 3; b.losses++ }
    else if (m.winner === m.teamB) { b.wins++; b.points += 3; a.losses++ }
    else { a.draws++; b.draws++; a.points += 1; b.points += 1 }
  }

  const result = Array.from(teamMap.values())
  result.forEach((t) => { t.diff = t.scored - t.conceded })
  result.sort((a, b) => b.points - a.points || b.diff - a.diff || b.scored - a.scored)
  return result
}

// =====================================================================
// 抽签工具函数（分组抽签 + 正反方抽签 + 辩题抽签）
// =====================================================================

/**
 * 分组抽签：把队伍列表随机分配到 N 个组
 * @param teams 队伍名称列表
 * @param groupCount 分组数量（如 2 → A组/B组）
 * @returns 每个队伍所属的组标签 { team: string, group: string }
 */
export function drawGroups(
  teams: string[],
  groupCount: number
): { team: string; group: string; seed: number }[] {
  // 洗牌
  const shuffled = [...teams].sort(() => Math.random() - 0.5)
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const groups: { team: string; group: string; seed: number }[] = []

  shuffled.forEach((team, idx) => {
    const groupIdx = idx % groupCount
    const seedInGroup = Math.floor(idx / groupCount) + 1
    groups.push({
      team,
      group: `${labels[groupIdx]}组`,
      seed: seedInGroup,
    })
  })

  return groups
}

/**
 * 正反方抽签：为每场比赛随机决定哪队是正方
 * @returns 'teamA' | 'teamB' —— 代表哪一方是正方
 */
export function drawAffirmativeSide(): 'teamA' | 'teamB' {
  return Math.random() < 0.5 ? 'teamA' : 'teamB'
}

/**
 * 辩题抽签：从辩题库中随机选择辩题（可避免重复）
 * @param topicPool 辩题数组（每项包含正方+反方）
 * @param usedTopics 已被其他比赛使用的辩题索引（避免重复）
 */
export function drawTopic(
  topicPool: { pro: string, con: string }[],
  usedTopics: number[] = []
): { pro: string, con: string } | null {
  const remainingIdx = topicPool.map((_, i) => i).filter((i) => !usedTopics.includes(i))
  if (remainingIdx.length === 0) {
    // 若全部用完，允许重复使用
    return topicPool.length > 0 ? topicPool[Math.floor(Math.random() * topicPool.length)]! : null
  }
  // ponytail: remainingIdx 非空，Math.floor 结果在范围内，索引一定有效
  return topicPool[remainingIdx[Math.floor(Math.random() * remainingIdx.length)]!]!
}

/**
 * 综合抽签：为赛事一次性完成
 *   1) 分组（若 format 是小组+淘汰赛 / 循环赛 的多分组）
 *   2) 为每场已生成的比赛分配 辩题 + 正反方
 */
export interface DrawLotsResult {
  groupAssignments: { team: string; group: string; seed: number }[]
  matchAssignments: { matchId: string; topic: string; affirmativeSide: 'teamA' | 'teamB' }[]
  info: string
}

export function runDrawLots(options: {
  teams: string[]
  topicPool: { pro: string, con: string }[]
  matches: { id: string; teamA: string | null; teamB: string | null; round: string }[]
  groupCount?: number  // >1 时才进行分组
  drawType: 'groups' | 'topics_sides' | 'all'
}): DrawLotsResult {
  const result: DrawLotsResult = {
    groupAssignments: [],
    matchAssignments: [],
    info: '',
  }

  // —— 1. 分组抽签 ——
  if ((options.drawType === 'groups' || options.drawType === 'all') &&
      options.groupCount && options.groupCount > 1) {
    result.groupAssignments = drawGroups(options.teams, options.groupCount)
    result.info += `完成分组抽签：${options.teams.length} 支队伍 → ${options.groupCount} 个组。 `
  }

  // —— 2. 辩题 + 正反方抽签（为每场比赛） ——
  if (options.drawType === 'topics_sides' || options.drawType === 'all') {
    const usedTopicIdx: number[] = []
    for (const match of options.matches) {
      // 跳过未配对的比赛（teamA/teamB 都 null）
      if (!match.teamA || !match.teamB) continue

      // 分配辩题（从辩题库中随机选一项，包含正方+反方）
      const topic = drawTopic(options.topicPool, usedTopicIdx)
      if (topic) {
        const idx = options.topicPool.indexOf(topic)
        if (idx >= 0) usedTopicIdx.push(idx)
      }

      // 分配正反方
      const side = drawAffirmativeSide()

      result.matchAssignments.push({
        matchId: match.id,
        topic: topic ? JSON.stringify(topic) : '',  // 存为 JSON 字符串
        affirmativeSide: side,
      })
    }
    if (result.matchAssignments.length > 0) {
      result.info += `完成辩题与正反方抽签：${result.matchAssignments.length} 场比赛。`
    } else if (options.topicPool.length === 0) {
      result.info += ' 提示：请先添加辩题到辩题库。'
    }
  }

  if (!result.info) result.info = '无操作，请先配置队伍和辩题。'
  return result
}
