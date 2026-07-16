<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// 使用 tournament 布局，继承三阶段导航卡片
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const tournamentId = computed(() => route.params.id as string)

// ═══════════════════════════════════════════
// 数据状态
// ═══════════════════════════════════════════
const stats = ref<any>(null)
const matches = ref<any[]>([])
const loading = ref(true)
const loadingMatches = ref(true)

// 搜索与筛选状态
const searchQuery = ref('')
const statusFilter = ref('all') // all | finished | ongoing | pending

// ═══════════════════════════════════════════
// 数据加载
// ═══════════════════════════════════════════

// 获取赛果统计数据
async function loadStats() {
  try {
    const res = await fetch(`/api/tournaments/${tournamentId.value}/standings`)
    const data = await res.json()
    if (data.success) {
      stats.value = data.data
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

// 获取比赛场次列表
async function loadMatches() {
  try {
    loadingMatches.value = true
    const res = await fetch(`/api/tournaments/${tournamentId.value}/matches`)
    matches.value = await res.json()
  } catch (error) {
    console.error('加载比赛列表失败:', error)
  } finally {
    loadingMatches.value = false
  }
}

onMounted(() => {
  loading.value = true
  Promise.all([loadStats(), loadMatches()]).finally(() => {
    loading.value = false
  })
})

// ═══════════════════════════════════════════
// 计算属性：筛选后的比赛列表
// ═══════════════════════════════════════════
const filteredMatches = computed(() => {
  let result = matches.value

  // 状态筛选
  if (statusFilter.value !== 'all') {
    result = result.filter(m => m.status === statusFilter.value)
  }

  // 搜索筛选（按队伍名称）
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(m =>
      (m.teamA && m.teamA.toLowerCase().includes(query)) ||
      (m.teamB && m.teamB.toLowerCase().includes(query)) ||
      (m.topic && m.topic.toLowerCase().includes(query))
    )
  }

  return result
})

// 按轮次分组的比赛（用于展示）
const matchesByRound = computed(() => {
  const groups: Record<number, any[]> = {}
  filteredMatches.value.forEach(match => {
    const round = match.round || 1
    if (!groups[round]) {
      groups[round] = []
    }
    groups[round].push(match)
  })

  const sortedKeys = Object.keys(groups).map(Number).sort((a, b) => a - b)
  return sortedKeys.map(key => {
    const roundMatches = groups[key] || []
    return {
      round: key,
      matches: roundMatches.sort((a, b) => Number(a.orderNum || 0) - Number(b.orderNum || 0)),
    }
  })
})

// 状态统计
const statusStats = computed(() => {
  const total = matches.value.length
  const finished = matches.value.filter(m => m.status === 'finished').length
  const ongoing = matches.value.filter(m => m.status === 'ongoing').length
  const pending = matches.value.filter(m => m.status === 'pending').length
  return { total, finished, ongoing, pending }
})

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

// 格式化进度百分比
const formatPercent = (num: number) => `${num}%`

// 获取轮次名称
const getRoundName = (round: number) => {
  const totalRounds = matchesByRound.value.length
  if (round === totalRounds) return '决赛'
  if (round === totalRounds - 1) return '半决赛'
  if (round === totalRounds - 2) return '四分之一决赛'
  if (round === totalRounds - 3) return '八分之一决赛'
  return `第 ${round} 轮`
}

// 判断比赛状态颜色
const getStatusColor = (status: string) => {
  switch (status) {
    case 'finished': return 'bg-[var(--color-success-bg)] text-[var(--color-accent-success)]'
    case 'ongoing': return 'bg-[var(--color-warning-bg)] text-[var(--color-accent-warning)]'
    default: return 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
  }
}

// 判断胜者样式
const getWinnerStyle = (match: any, team: string) => {
  if (match.status !== 'finished') return ''
  const isWinner = (match.winner === 'teamA' && team === match.teamA) ||
                   (match.winner === 'teamB' && team === match.teamB)
  return isWinner ? 'font-bold text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'
}

// 获取比赛状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'finished': return '已结束'
    case 'ongoing': return '进行中'
    default: return '待进行'
  }
}

// ═══════════════════════════════════════════
// CSV 导出功能
// ═══════════════════════════════════════════
function exportStandingsCSV() {
  if (!stats.value?.standings?.length) {
    alert('暂无数据可导出')
    return
  }

  // 构建 CSV 内容
  const headers = ['排名', '队伍', '分组', '场次', '胜', '平', '负', '净胜分', '积分']
  const rows = stats.value.standings.map((team: any, index: number) => [
    index + 1,
    team.name,
    team.groupLabel || '-',
    team.played,
    team.wins,
    team.draws,
    team.losses,
    team.scoreDiff,
    team.points,
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row: any[]) => row.join(','))
  ].join('\n')

  // 添加 BOM 以支持中文
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.href = url
  link.download = `${stats.value.tournament?.name || '赛事'}_积分榜.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div>
    <!-- ═══ 页面标题 ═══ -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-[var(--color-text-primary)]">赛果统计</h1>
        <p class="text-sm text-[var(--color-text-muted)] mt-1">展示赛事的完整统计数据与排名信息</p>
      </div>
      <UButton
        v-if="stats?.standings?.length"
        color="primary"
        variant="outline"
        size="sm"
        @click="exportStandingsCSV"
      >
        <UIcon name="i-lucide-download" class="w-4 h-4 mr-1" />
        导出积分榜
      </UButton>
    </div>

    <!-- ═══ 加载状态 ═══ -->
    <div v-if="loading" class="text-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-[var(--color-text-muted)] mx-auto" />
      <p class="text-sm text-[var(--color-text-muted)] mt-3">加载中...</p>
    </div>

    <!-- ═══ 数据内容 ═══ -->
    <div v-else>
        <!-- ═══ 比赛进度概览 ═══ -->
        <div v-if="stats?.matchStats" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <UCard class="p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">总场次</p>
                <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{{ stats.matchStats.total }}</p>
              </div>
              <div class="w-12 h-12 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                <UIcon name="i-lucide-calendar" class="w-6 h-6 text-[var(--color-text-muted)]" />
              </div>
            </div>
          </UCard>
          <UCard class="p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">已完成</p>
                <p class="text-2xl font-bold text-[var(--color-accent-success)] mt-1">{{ stats.matchStats.finished }}</p>
              </div>
              <div class="w-12 h-12 rounded-xl bg-[var(--color-success-bg)] flex items-center justify-center">
                <UIcon name="i-lucide-check-circle" class="w-6 h-6 text-[var(--color-accent-success)]" />
              </div>
            </div>
          </UCard>
          <UCard class="p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">进行中</p>
                <p class="text-2xl font-bold text-[var(--color-accent-warning)] mt-1">{{ stats.matchStats.ongoing }}</p>
              </div>
              <div class="w-12 h-12 rounded-xl bg-[var(--color-warning-bg)] flex items-center justify-center">
                <UIcon name="i-lucide-clock" class="w-6 h-6 text-[var(--color-accent-warning)]" />
              </div>
            </div>
          </UCard>
          <UCard class="p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">进度</p>
                <p class="text-2xl font-bold text-[var(--color-accent-primary)] mt-1">{{ formatPercent(stats.matchStats.progress) }}</p>
              </div>
              <div class="w-12 h-12 rounded-xl bg-[var(--color-accent-bg)] flex items-center justify-center">
                <UIcon name="i-lucide-trending-up" class="w-6 h-6 text-[var(--color-accent-primary)]" />
              </div>
            </div>
          </UCard>
        </div>

        <!-- ═══ 进度条 ═══ -->
        <UCard class="mb-6" v-if="stats?.matchStats">
          <template #header>
            <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <UIcon name="i-lucide-bar-chart" class="w-4 h-4 text-[var(--color-text-muted)]" />
              赛事进度
            </h2>
          </template>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-[var(--color-text-secondary)]">已完成 {{ stats.matchStats.finished }} / {{ stats.matchStats.total }} 场</span>
              <span class="font-medium text-[var(--color-text-primary)]">{{ formatPercent(stats.matchStats.progress) }}</span>
            </div>
            <div class="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] rounded-full transition-all duration-500"
                :style="{ width: formatPercent(stats.matchStats.progress) }"
              />
            </div>
            <div class="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>待进行 {{ stats.matchStats.pending }} 场</span>
              <span>进行中 {{ stats.matchStats.ongoing }} 场</span>
            </div>
          </div>
        </UCard>

        <!-- ═══ 积分榜 ═══ -->
        <UCard class="mb-6" v-if="stats?.standings?.length">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <UIcon name="i-lucide-trophy" class="w-4 h-4 text-[var(--color-accent-primary)]" />
                积分榜
              </h2>
              <span class="text-xs text-[var(--color-text-muted)]">{{ stats.standings.length }} 支队伍</span>
            </div>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-[var(--color-border)]">
                  <th class="text-left py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">排名</th>
                  <th class="text-left py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">队伍</th>
                  <th class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">分组</th>
                  <th class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">场次</th>
                  <th class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">胜</th>
                  <th class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">平</th>
                  <th class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">负</th>
                  <th class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">净胜分</th>
                  <th class="text-right py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">积分</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(team, index) in stats.standings"
                  :key="team.id"
                  :class="[
                    'border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors',
                    index === 0 ? 'bg-[var(--color-accent-bg)]' : '',
                  ]"
                >
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-2">
                      <span v-if="index === 0" class="text-xl">🥇</span>
                      <span v-else-if="index === 1" class="text-xl">🥈</span>
                      <span v-else-if="index === 2" class="text-xl">🥉</span>
                      <span v-else class="text-sm font-medium text-[var(--color-text-muted)]">{{ index + 1 }}</span>
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="font-medium text-[var(--color-text-primary)]">{{ team.name }}</span>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <span class="text-sm text-[var(--color-text-secondary)]">{{ team.groupLabel || '-' }}</span>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ team.played }}</span>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <span class="text-sm font-medium text-[var(--color-accent-success)]">{{ team.wins }}</span>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <span class="text-sm font-medium text-[var(--color-accent-warning)]">{{ team.draws }}</span>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <span class="text-sm font-medium text-[var(--color-accent-error)]">{{ team.losses }}</span>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <span :class="[
                      'text-sm font-medium',
                      team.scoreDiff >= 0 ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-error)]',
                    ]">{{ team.scoreDiff >= 0 ? '+' : '' }}{{ team.scoreDiff }}</span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <span :class="[
                      'text-lg font-bold',
                      index === 0 ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-primary)]',
                    ]">{{ team.points }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <!-- ═══ 分组积分榜 ═══ -->
        <UCard class="mb-6" v-if="stats?.groupStandings?.length">
          <template #header>
            <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <UIcon name="i-lucide-users" class="w-4 h-4 text-[var(--color-text-muted)]" />
              分组积分榜
            </h2>
          </template>
          <div class="space-y-6">
            <div v-for="group in stats.groupStandings" :key="group.group">
              <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{{ group.group }}</h3>
              <div class="space-y-2">
                <div
                  v-for="(team, index) in group.teams"
                  :key="team.id"
                  class="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)]"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-medium text-[var(--color-text-muted)] w-6">{{ index + 1 }}</span>
                    <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ team.name }}</span>
                  </div>
                  <div class="flex items-center gap-4 text-xs">
                    <span class="text-[var(--color-text-muted)]">{{ team.wins }}胜 {{ team.losses }}负</span>
                    <span class="font-bold text-[var(--color-accent-primary)]">{{ team.points }} 分</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- ═══ 最佳辩手榜 ═══ -->
        <UCard class="mb-6" v-if="stats?.bestDebaters?.length">
          <template #header>
            <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <UIcon name="i-lucide-award" class="w-4 h-4 text-[var(--color-accent-primary)]" />
              最佳辩手榜
            </h2>
          </template>
          <div class="space-y-3">
            <div
              v-for="(debater, index) in stats.bestDebaters"
              :key="debater.name"
              class="flex items-center justify-between p-3 rounded-lg"
              :class="index < 3 ? 'bg-[var(--color-accent-bg)]' : 'bg-[var(--color-bg-secondary)]'"
            >
              <div class="flex items-center gap-3">
                <div :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                  index === 0 ? 'bg-yellow-400 text-white' :
                  index === 1 ? 'bg-gray-300 text-gray-700' :
                  index === 2 ? 'bg-orange-300 text-white' :
                  'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]',
                ]">
                  {{ index + 1 }}
                </div>
                <span class="font-medium text-[var(--color-text-primary)]">{{ debater.name }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-[var(--color-text-muted)]">获得最佳辩手</span>
                <span class="text-lg font-bold text-[var(--color-accent-primary)]">{{ debater.count }}</span>
                <span class="text-sm text-[var(--color-text-muted)]">次</span>
              </div>
            </div>
          </div>
        </UCard>

        <!-- ═══ 评委评分统计 ═══ -->
        <UCard class="mb-6" v-if="stats?.judgeRankings?.length">
          <template #header>
            <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <UIcon name="i-lucide-gavel" class="w-4 h-4 text-[var(--color-text-muted)]" />
              评委评分统计
            </h2>
          </template>
          <div class="space-y-3">
            <div
              v-for="(judge, index) in stats.judgeRankings"
              :key="judge.name"
              class="flex items-center gap-3"
            >
              <span class="text-sm font-medium text-[var(--color-text-muted)] w-6">{{ index + 1 }}</span>
              <div class="flex-1">
                <div class="flex justify-between mb-1">
                  <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ judge.name }}</span>
                  <span class="text-xs text-[var(--color-text-muted)]">{{ judge.count }} 场</span>
                </div>
                <div class="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    class="h-full bg-[var(--color-accent-primary)] rounded-full transition-all duration-300"
                    :style="{ width: formatPercent((judge.count / stats.judgeRankings[0].count) * 100) }"
                  />
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- ═══ 比赛结果列表 ═══ -->
        <UCard class="mb-6" v-if="matches.length">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <UIcon name="i-lucide-swords" class="w-4 h-4 text-[var(--color-text-muted)]" />
                比赛结果
              </h2>
              <span class="text-xs text-[var(--color-text-muted)]">共 {{ filteredMatches.length }} 场</span>
            </div>
          </template>

          <!-- 搜索与筛选工具栏 -->
          <div class="flex flex-col sm:flex-row gap-3 mb-4">
            <div class="relative flex-1">
              <UIcon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索队伍或辩题..."
                class="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] border border-[var(--color-border)] focus:border-[var(--color-accent-primary)] focus:outline-none transition-colors"
              />
            </div>
            <div class="flex gap-2">
              <button
                v-for="status in [
                  { value: 'all', label: '全部', count: statusStats.total },
                  { value: 'finished', label: '已结束', count: statusStats.finished },
                  { value: 'ongoing', label: '进行中', count: statusStats.ongoing },
                  { value: 'pending', label: '待进行', count: statusStats.pending },
                ]"
                :key="status.value"
                :class="[
                  'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  statusFilter === status.value
                    ? 'bg-[var(--color-accent-primary)] text-white'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
                ]"
                @click="statusFilter = status.value"
              >
                {{ status.label }} ({{ status.count }})
              </button>
            </div>
          </div>

          <!-- 按轮次分组展示 -->
          <div v-if="filteredMatches.length" class="space-y-6">
            <div v-for="roundData in matchesByRound" :key="roundData.round">
              <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]">
                  第 {{ roundData.round }} 轮
                </span>
                <span class="text-[var(--color-text-muted)]">{{ getRoundName(roundData.round) }}</span>
                <span class="text-xs text-[var(--color-text-muted)]">({{ roundData.matches.length }} 场)</span>
              </h3>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div
                  v-for="match in roundData.matches"
                  :key="match.id"
                  :class="[
                    'relative p-4 rounded-xl border transition-all duration-200',
                    match.status === 'finished'
                      ? 'border-[var(--color-accent-success)] bg-[var(--color-success-bg)]'
                      : match.status === 'ongoing'
                      ? 'border-[var(--color-accent-warning)] bg-[var(--color-warning-bg)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]',
                  ]"
                >
                  <!-- 状态标签 -->
                  <div class="absolute -top-2 left-4">
                    <span :class="['text-xs px-2 py-0.5 rounded-full', getStatusColor(match.status)]">
                      {{ getStatusText(match.status) }}
                    </span>
                  </div>

                  <div class="mt-3">
                    <!-- 比赛编号 -->
                    <p class="text-xs text-[var(--color-text-muted)] mb-2">场次 {{ match.orderNum }}</p>

                    <!-- 队伍 A -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-circle" class="w-4 h-4 text-[var(--color-accent-primary)]" />
                        <span :class="['text-sm font-medium', getWinnerStyle(match, match.teamA)]">
                          {{ match.teamA || '待定' }}
                        </span>
                      </div>
                      <span v-if="match.scoreA !== null" class="text-lg font-bold text-[var(--color-text-primary)]">
                        {{ match.scoreA }}
                      </span>
                    </div>

                    <!-- VS -->
                    <div class="flex items-center justify-center gap-2 py-1.5">
                      <div class="flex-1 h-px bg-[var(--color-border)]" />
                      <span class="text-xs text-[var(--color-text-muted)]">VS</span>
                      <div class="flex-1 h-px bg-[var(--color-border)]" />
                    </div>

                    <!-- 队伍 B -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-circle" class="w-4 h-4 text-[var(--color-accent-error)]" />
                        <span :class="['text-sm font-medium', getWinnerStyle(match, match.teamB)]">
                          {{ match.teamB || '待定' }}
                        </span>
                      </div>
                      <span v-if="match.scoreB !== null" class="text-lg font-bold text-[var(--color-text-primary)]">
                        {{ match.scoreB }}
                      </span>
                    </div>

                    <!-- 辩题 -->
                    <div v-if="match.topic" class="mt-2 pt-2 border-t border-[var(--color-border)]">
                      <p class="text-xs text-[var(--color-text-muted)] truncate">{{ match.topic }}</p>
                    </div>

                    <!-- 最佳辩手 -->
                    <div v-if="match.bestDebaterA || match.bestDebaterB" class="mt-2 flex flex-wrap gap-1">
                      <span v-if="match.bestDebaterA" class="text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]">
                        最佳辩手(正): {{ match.bestDebaterA }}
                      </span>
                      <span v-if="match.bestDebaterB" class="text-xs px-1.5 py-0.5 rounded bg-[var(--color-error-bg)] text-[var(--color-accent-error)]">
                        最佳辩手(反): {{ match.bestDebaterB }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 筛选结果为空 -->
          <div v-else-if="matches.length" class="text-center py-8">
            <UIcon name="i-lucide-search-x" class="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
            <p class="text-[var(--color-text-muted)]">未找到匹配的比赛</p>
            <p class="text-xs text-[var(--color-text-muted)] mt-1">请尝试其他搜索条件</p>
          </div>
        </UCard>

        <!-- ═══ 完全无数据提示 ═══ -->
        <div v-if="!loading && !stats && !matches.length" class="text-center py-12">
          <UIcon name="i-lucide-chart-bar" class="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4" />
          <p class="text-[var(--color-text-muted)]">暂无赛果统计数据</p>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">完成比赛后将显示统计信息</p>
        </div>
    </div>
  </div>
</template>
