<script setup lang="ts">
// 循环赛积分榜组件
// 根据赛果自动计算各队排名、胜负、得分等

// 组件入参定义（旧版，下方 withDefaults 处才是实际生效的 props 定义）
interface Props {
  matches: MatchItem[]
}

// 单场比赛项的数据结构
interface MatchItem {
  id: string // 对阵唯一标识
  round: number // 所属轮次
  teamA?: string | null // A 方队伍标识
  teamB?: string | null // B 方队伍标识
  scoreA?: number | null // A 方得分
  scoreB?: number | null // B 方得分
  winner?: string | null // 胜出队伍标识（平局为 null）
  status: string // 对阵状态：finished/running/pending
}

// props 定义：matches + 可选晋级提示 + 组标签
const props = withDefaults(
  defineProps<{
    matches: MatchItem[]
    promoteLimit?: number // 前 N 名晋级（例如 2 → 前 2 名高亮）
    groupLabel?: string // 可选：当前小组标签（例如 "A组"）
  }>(),
  {
    promoteLimit: 0,
    groupLabel: '',
  },
)

// 计算各队的排名数据
// 队伍积分数据结构
interface TeamStanding {
  team: string // 队伍标识
  played: number // 已赛场次
  wins: number // 胜场数
  draws: number // 平局数
  losses: number // 负场数
  scored: number // 总得分
  conceded: number // 总失分
  diff: number // 净胜分（得分 - 失分）
  points: number // 积分（胜3平1负0）
}

const standings = computed<TeamStanding[]>(() => {
  const finishedMatches = props.matches.filter((m) => m.status === 'finished')
  const teamMap = new Map<string, TeamStanding>()

  // 初始化所有队伍的记录
  for (const m of props.matches) {
    if (m.teamA && !teamMap.has(m.teamA)) {
      teamMap.set(m.teamA, {
        team: m.teamA,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scored: 0,
        conceded: 0,
        diff: 0,
        points: 0,
      })
    }
    if (m.teamB && !teamMap.has(m.teamB)) {
      teamMap.set(m.teamB, {
        team: m.teamB,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scored: 0,
        conceded: 0,
        diff: 0,
        points: 0,
      })
    }
  }

  // 统计已完成比赛的得分
  for (const m of finishedMatches) {
    if (!m.teamA || !m.teamB) continue
    const a = teamMap.get(m.teamA)!
    const b = teamMap.get(m.teamB)!

    a.played++
    b.played++
    a.scored += m.scoreA ?? 0
    a.conceded += m.scoreB ?? 0
    b.scored += m.scoreB ?? 0
    b.conceded += m.scoreA ?? 0

    if (m.winner === m.teamA) {
      a.wins++
      a.points += 3
      b.losses++
    } else if (m.winner === m.teamB) {
      b.wins++
      b.points += 3
      a.losses++
    } else {
      // 平局
      a.draws++
      b.draws++
      a.points += 1
      b.points += 1
    }
  }

  // 计算净胜分并排序
  const result = Array.from(teamMap.values())
  result.forEach((t) => {
    t.diff = t.scored - t.conceded
  })
  result.sort((a, b) => b.points - a.points || b.diff - a.diff || b.scored - a.scored)

  return result
})

// 获取两队之间的比赛结果（按 key 索引）
const matchResults = computed(() => {
  const map = new Map<
    string,
    { teamA: string; teamB: string; scoreA: number; scoreB: number; winner: string | null }
  >()
  for (const m of props.matches) {
    if (m.status === 'finished' && m.teamA && m.teamB) {
      map.set(`${m.teamA}_${m.teamB}`, {
        teamA: m.teamA,
        teamB: m.teamB,
        scoreA: m.scoreA!,
        scoreB: m.scoreB!,
        winner: m.winner ?? null,
      })
      map.set(`${m.teamB}_${m.teamA}`, {
        teamA: m.teamB,
        teamB: m.teamA,
        scoreA: m.scoreB!,
        scoreB: m.scoreA!,
        winner: m.winner ?? null,
      })
    }
  }
  return map
})

// 获取两队之间的比赛结果：team1 视为主队、team2 视为客队
function getResult(team1: string, team2: string) {
  return matchResults.value.get(`${team1}_${team2}`) || null
}

// 排名颜色：第 1 金、第 2 银、第 3 铜
function rankColor(rank: number): string {
  if (rank === 1) return 'text-yellow-500'
  if (rank === 2) return 'text-gray-400'
  if (rank === 3) return 'text-amber-600'
  return ''
}

// 队伍名简写：超过 4 字则截断并加省略号
function shortName(name: string) {
  return name.length > 4 ? name.slice(0, 4) + '.' : name
}

// 积分规则说明
const scoringRules = '胜 3 分，平 1 分，负 0 分'

// ponytail: 对阵矩阵缓存变量，避免模板中 getResult 重复调用
let r:
  | { teamA: string; teamB: string; scoreA: number; scoreB: number; winner: string | null }
  | null
  | undefined
</script>

<template>
  <div class="standings-view">
    <!-- 积分榜 -->
    <div v-if="standings.length === 0" class="text-center py-8 text-gray-400">暂无完赛数据</div>

    <div v-else class="space-y-6">
      <!-- 组标签 + 晋级提示 -->
      <div
        v-if="groupLabel || promoteLimit > 0"
        class="flex items-center justify-between text-xs text-gray-500"
      >
        <span v-if="groupLabel" class="font-semibold text-gray-700 dark:text-gray-200">{{
          groupLabel
        }}</span>
        <span v-if="promoteLimit > 0" class="text-green-600 font-medium"
          >前 {{ promoteLimit }} 名晋级</span
        >
      </div>

      <!-- 排名表格 -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="py-2 px-3 text-left w-12">#</th>
              <th class="py-2 px-3 text-left">队伍</th>
              <th class="py-2 px-3 text-center w-12">赛</th>
              <th class="py-2 px-3 text-center w-12">胜</th>
              <th class="py-2 px-3 text-center w-12">平</th>
              <th class="py-2 px-3 text-center w-12">负</th>
              <th class="py-2 px-3 text-center w-16">得分</th>
              <th class="py-2 px-3 text-center w-16">失分</th>
              <th class="py-2 px-3 text-center w-16">净胜</th>
              <th class="py-2 px-3 text-center w-14">积分</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(team, idx) in standings"
              :key="team.team"
              class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              :class="[
                { 'font-bold': idx < 3 },
                promoteLimit > 0 && idx < promoteLimit ? 'bg-green-50/40 dark:bg-green-900/20' : '',
              ]"
            >
              <td class="py-2.5 px-3">
                <span :class="rankColor(idx + 1)">{{ idx + 1 }}</span>
              </td>
              <td class="py-2.5 px-3 font-medium">{{ team.team }}</td>
              <td class="py-2.5 px-3 text-center text-gray-500">{{ team.played }}</td>
              <td class="py-2.5 px-3 text-center text-green-600">{{ team.wins }}</td>
              <td class="py-2.5 px-3 text-center text-yellow-600">{{ team.draws }}</td>
              <td class="py-2.5 px-3 text-center text-red-500">{{ team.losses }}</td>
              <td class="py-2.5 px-3 text-center">{{ team.scored }}</td>
              <td class="py-2.5 px-3 text-center">{{ team.conceded }}</td>
              <td class="py-2.5 px-3 text-center">
                <span
                  :class="
                    team.diff > 0
                      ? 'text-green-600'
                      : team.diff < 0
                        ? 'text-red-500'
                        : 'text-gray-400'
                  "
                >
                  {{ team.diff > 0 ? '+' : '' }}{{ team.diff }}
                </span>
              </td>
              <td class="py-2.5 px-3 text-center font-bold text-primary">{{ team.points }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 积分规则 -->
      <div class="text-xs text-gray-400 text-right">{{ scoringRules }}</div>

      <!-- 对阵结果矩阵 -->
      <div v-if="standings.length > 1">
        <h3 class="text-sm font-bold mb-3 text-gray-600 dark:text-gray-300">对阵结果</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th
                  class="py-1.5 px-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-left min-w-[60px]"
                >
                  主╲客
                </th>
                <th
                  v-for="team in standings"
                  :key="team.team"
                  class="py-1.5 px-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center min-w-[60px]"
                >
                  {{ shortName(team.team) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rowTeam in standings" :key="rowTeam.team">
                <td
                  class="py-1.5 px-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-medium"
                >
                  {{ shortName(rowTeam.team) }}
                </td>
                <td
                  v-for="colTeam in standings"
                  :key="colTeam.team"
                  class="py-1.5 px-2 border border-gray-200 dark:border-gray-700 text-center"
                  :class="{ 'bg-gray-100 dark:bg-gray-800': rowTeam.team === colTeam.team }"
                >
                  <!-- ponytail: 用单个变量 r 缓存 getResult，避免同格内重复 6 次 Map 查找 -->
                  <template v-if="rowTeam.team === colTeam.team">
                    <span class="text-gray-300">—</span>
                  </template>
                  <template v-else-if="r = getResult(rowTeam.team, colTeam.team)">
                    <span
                      class="cursor-help"
                      :title="`${r.teamA} ${r.scoreA} : ${r.scoreB} ${r.teamB}`"
                    >
                      <span
                        :class="
                          r.winner === rowTeam.team
                            ? 'text-green-600 font-bold'
                            : r.winner === null
                              ? 'text-yellow-500'
                              : 'text-red-500'
                        "
                      >
                        {{ r.scoreA }}:{{ r.scoreB }}
                      </span>
                    </span>
                  </template>
                  <template v-else>
                    <span class="text-gray-300">-</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
