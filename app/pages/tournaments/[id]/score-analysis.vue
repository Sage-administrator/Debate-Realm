<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// 使用 tournament 布局，继承三阶段导航卡片
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const tournamentId = computed(() => route.params.id as string)
const authStore = useAuthStore()

// ═══════════════════════════════════════════
// 数据状态
// ═══════════════════════════════════════════
const scoreStats = ref<any>(null)
const rankings = ref<any>(null)
const matchScores = ref<any[]>([])
const loading = ref(true)

// 分页状态（比赛评分详情）
const pageSize = 4
const currentPage = ref(1)

// 数据缓存（避免重复请求）
const cacheKey = computed(() => `score-analysis-${tournamentId.value}`)

// ═══════════════════════════════════════════
// 数据加载
// ═══════════════════════════════════════════
async function loadScoreStats() {
  try {
    loading.value = true

    // 检查本地缓存
    const cached = sessionStorage.getItem(cacheKey.value)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        scoreStats.value = parsed.scoreStats
        rankings.value = parsed.rankings
        matchScores.value = parsed.matchScores
        loading.value = false
        return
      } catch {
        // 缓存解析失败，继续请求
      }
    }

    // 并行请求基础数据
    const [statsRes, rankingsRes] = await Promise.all([
      fetch(`/api/tournaments/${tournamentId.value}/scores?type=stats`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      }),
      fetch(`/api/tournaments/${tournamentId.value}/scores?type=rankings`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      }),
    ])

    const statsData = await statsRes.json()
    const rankingsData = await rankingsRes.json()

    if (statsData.success) {
      scoreStats.value = statsData
    }
    if (rankingsData.success) {
      rankings.value = rankingsData
    }

    // 获取比赛列表
    const matchesRes = await fetch(`/api/tournaments/${tournamentId.value}/matches`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    const matches = await matchesRes.json()

    // 防御：鉴权失败时接口返回错误对象而非数组，直接 filter 会抛 TypeError
    const matchList = Array.isArray(matches) ? matches : []

    // 只获取已完成且可能有评分的比赛（优化：减少请求量）
    const scoredMatches = matchList.filter(
      (m: any) => m.status === 'finished' || m.status === 'completed',
    )

    // 限制初始加载数量，避免过多请求
    const matchesToLoad = scoredMatches.slice(0, 12)

    // 获取每场比赛的评分
    const scoresPromises = matchesToLoad.map((match: any) => {
      return fetch(`/api/tournaments/${tournamentId.value}/scores?matchId=${match.id}`)
        .then((res) => res.json())
        .then((data) => ({ match, scores: data }))
        .catch(() => ({ match, scores: { success: false } }))
    })

    const allScores = await Promise.all(scoresPromises)
    matchScores.value = allScores.filter((s) => s.scores.success && s.scores.scores?.length)

    // 保存到缓存
    sessionStorage.setItem(
      cacheKey.value,
      JSON.stringify({
        scoreStats: scoreStats.value,
        rankings: rankings.value,
        matchScores: matchScores.value,
      }),
    )
  } catch (error) {
    console.error('加载评分分析数据失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadScoreStats()
})

// ═══════════════════════════════════════════
// 计算属性
// ═══════════════════════════════════════════

// 分页后的比赛评分详情
const paginatedMatchScores = computed(() => {
  const start = 0
  const end = currentPage.value * pageSize
  return matchScores.value.slice(start, end)
})

// 是否还有更多数据
const hasMoreScores = computed(() => {
  return paginatedMatchScores.value.length < matchScores.value.length
})

// 加载更多
function loadMoreScores() {
  currentPage.value++
}

// 计算评委评分分布
const judgeScoreDistribution = computed(() => {
  const distribution: Record<string, number[]> = {}
  const scores = matchScores.value || []
  scores.forEach((item: any) => {
    item.scores.scores.forEach((score: any) => {
      const judgeArr = distribution[score.judgeName] || []
      judgeArr.push(score.scoreTeamA + score.scoreTeamB)
      distribution[score.judgeName] = judgeArr
    })
  })

  const result: Record<string, { count: number; avg: number; min: number; max: number }> = {}
  Object.entries(distribution).forEach(([judge, scores]) => {
    const sum = scores.reduce((a, b) => a + b, 0)
    result[judge] = {
      count: scores.length,
      avg: Math.round((sum / scores.length) * 10) / 10,
      min: Math.min(...scores),
      max: Math.max(...scores),
    }
  })
  return result
})

// 计算各维度平均得分
const dimensionStats = computed(() => {
  const dimensions: Record<string, number[]> = {}
  const scores = matchScores.value || []
  scores.forEach((item: any) => {
    item.scores.scores.forEach((score: any) => {
      score.dimensions.forEach((dim: any) => {
        const dimArr = dimensions[dim.name] || []
        dimArr.push(dim.score)
        dimensions[dim.name] = dimArr
      })
    })
  })

  const result: Array<{ name: string; avg: number; count: number }> = []
  Object.entries(dimensions).forEach(([name, scores]) => {
    const sum = scores.reduce((a, b) => a + b, 0)
    result.push({
      name,
      avg: Math.round((sum / scores.length) * 10) / 10,
      count: scores.length,
    })
  })
  return result.sort((a, b) => b.avg - a.avg)
})

// 计算胜负比例
const winRatio = computed(() => {
  if (!scoreStats.value?.totalMatches) return null
  const completed = scoreStats.value.scoredMatches || 0
  const total = scoreStats.value.totalMatches || 0
  return Math.round((completed / total) * 100)
})

// ── 队伍排名榜（已请求 rankings 数据但此前未展示） ──
const rankingsList = computed<Array<any>>(() => {
  return (rankings.value as any)?.rankings ?? []
})

// 排名奖牌颜色（与 standings 页保持一致）
function rankMedalColor(rank: number) {
  if (rank === 1) return 'text-amber-600 dark:text-amber-400'
  if (rank === 2) return 'text-gray-300'
  if (rank === 3) return 'text-amber-700'
  return 'text-[var(--color-text-muted)]'
}

// 排名行背景（与 standings 页保持一致）
function rankBgColor(rank: number) {
  if (rank === 1) return 'bg-amber-500/20 border-amber-500/30'
  if (rank === 2) return 'bg-gray-400/10 border-gray-400/30'
  if (rank === 3) return 'bg-amber-700/20 border-amber-700/30'
  return 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
}

// ═══════════════════════════════════════════
// CSV 导出功能
// ═══════════════════════════════════════════
function exportJudgeDistributionCSV() {
  const distribution = judgeScoreDistribution.value
  const judges = Object.entries(distribution)

  if (!judges.length) {
    alert('暂无数据可导出')
    return
  }

  const headers = ['评委', '评分场次', '平均分', '最低分', '最高分', '波动范围']
  const rows = judges.map(([name, stats]) => [
    name,
    stats.count,
    stats.avg,
    stats.min,
    stats.max,
    stats.max - stats.min,
  ])

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.href = url
  link.download = `评分分析_评委分布.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 导出维度分析 CSV
function exportDimensionCSV() {
  if (!dimensionStats.value.length) {
    alert('暂无数据可导出')
    return
  }

  const headers = ['维度', '平均分', '评分次数']
  const rows = dimensionStats.value.map((dim) => [dim.name, dim.avg, dim.count])

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.href = url
  link.download = `评分分析_维度统计.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 导出排名榜 CSV
function exportRankingsCSV() {
  const list = rankingsList.value
  if (!list.length) {
    alert('暂无数据可导出')
    return
  }

  const headers = ['排名', '队伍', '场次', '胜', '平', '负', '得分', '失分', '净胜分', '积分']
  const rows = list.map((t: any, i: number) => [
    i + 1,
    t.name,
    t.matches,
    t.wins,
    t.draws,
    t.losses,
    t.scoreFor,
    t.scoreAgainst,
    t.scoreDiff,
    t.points,
  ])

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.href = url
  link.download = `评分分析_队伍排名榜.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div>
    <!-- ═══ 加载状态 ═══ -->
    <div v-if="loading" class="text-center py-12">
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-[var(--color-text-muted)] mx-auto"
      />
      <p class="text-sm text-[var(--color-text-muted)] mt-3">加载中...</p>
    </div>

    <!-- ═══ 数据内容 ═══ -->
    <div v-else>
      <!-- ═══ 评分概览卡片 ═══ -->
      <div v-if="scoreStats" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <UCard class="p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">总比赛数</p>
              <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
                {{ scoreStats.totalMatches }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center"
            >
              <UIcon name="i-lucide-calendar" class="w-6 h-6 text-[var(--color-text-muted)]" />
            </div>
          </div>
        </UCard>
        <UCard class="p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">已评分</p>
              <p class="text-2xl font-bold text-[var(--color-accent-success)] mt-1">
                {{ scoreStats.scoredMatches }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-xl bg-[var(--color-success-bg)] flex items-center justify-center"
            >
              <UIcon
                name="i-lucide-check-circle"
                class="w-6 h-6 text-[var(--color-accent-success)]"
              />
            </div>
          </div>
        </UCard>
        <UCard class="p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">未评分</p>
              <p class="text-2xl font-bold text-[var(--color-accent-warning)] mt-1">
                {{ scoreStats.unscoredMatches }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-xl bg-[var(--color-warning-bg)] flex items-center justify-center"
            >
              <UIcon name="i-lucide-clock" class="w-6 h-6 text-[var(--color-accent-warning)]" />
            </div>
          </div>
        </UCard>
        <UCard class="p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">评委人数</p>
              <p class="text-2xl font-bold text-[var(--color-accent-primary)] mt-1">
                {{ scoreStats.totalJudges }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-xl bg-[var(--color-accent-bg)] flex items-center justify-center"
            >
              <UIcon name="i-lucide-users" class="w-6 h-6 text-[var(--color-accent-primary)]" />
            </div>
          </div>
        </UCard>
      </div>

      <!-- ═══ 评分进度条 ═══ -->
      <UCard v-if="scoreStats" class="mb-6">
        <template #header>
          <h2
            class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <UIcon name="i-lucide-bar-chart" class="w-4 h-4 text-[var(--color-text-muted)]" />
            评分进度
          </h2>
        </template>
        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-[var(--color-text-secondary)]"
              >已完成 {{ scoreStats.scoredMatches }} / {{ scoreStats.totalMatches }} 场评分</span
            >
            <span class="font-medium text-[var(--color-text-primary)]">{{ winRatio || 0 }}%</span>
          </div>
          <div class="h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] rounded-full transition-all duration-500"
              :style="{ width: `${winRatio || 0}%` }"
            />
          </div>
        </div>
      </UCard>

      <!-- ═══ 队伍排名榜 ═══ -->
      <UCard v-if="rankingsList.length" class="mb-6">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <h2
                class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
              >
                <UIcon name="i-lucide-trophy" class="w-4 h-4 text-[var(--color-text-muted)]" />
                队伍排名榜
              </h2>
              <span
                v-if="rankings?.tournamentName"
                class="text-xs text-[var(--color-text-muted)] truncate"
              >
                {{ rankings.tournamentName }}
              </span>
            </div>
            <UButton color="primary" variant="outline" size="xs" @click="exportRankingsCSV">
              <UIcon name="i-lucide-download" class="w-3 h-3 mr-1" />
              导出
            </UButton>
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr
                class="border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-sm"
              >
                <th class="px-4 py-3 text-left w-14">排名</th>
                <th class="px-4 py-3 text-left">队伍</th>
                <th class="px-4 py-3 text-center">场次</th>
                <th class="px-4 py-3 text-center">胜</th>
                <th class="px-4 py-3 text-center">平</th>
                <th class="px-4 py-3 text-center">负</th>
                <th class="px-4 py-3 text-center">得分</th>
                <th class="px-4 py-3 text-center">失分</th>
                <th class="px-4 py-3 text-center">净胜分</th>
                <th class="px-4 py-3 text-center font-bold">积分</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(team, idx) in rankingsList"
                :key="team.name"
                :class="[
                  'border-b border-[var(--color-border-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors',
                  rankBgColor(idx + 1),
                ]"
              >
                <td class="px-4 py-3">
                  <span :class="['font-bold text-lg', rankMedalColor(idx + 1)]">
                    {{ idx + 1 }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shrink-0"
                    >
                      {{ team.name.charAt(0) }}
                    </div>
                    <span class="font-medium text-[var(--color-text-primary)]">{{
                      team.name
                    }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                  {{ team.matches }}
                </td>
                <td class="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400">
                  {{ team.wins }}
                </td>
                <td class="px-4 py-3 text-center text-[var(--color-text-muted)]">
                  {{ team.draws }}
                </td>
                <td class="px-4 py-3 text-center text-red-500 dark:text-red-400">
                  {{ team.losses }}
                </td>
                <td class="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                  {{ team.scoreFor }}
                </td>
                <td class="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                  {{ team.scoreAgainst }}
                </td>
                <td
                  class="px-4 py-3 text-center"
                  :class="
                    team.scoreDiff > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : team.scoreDiff < 0
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-[var(--color-text-muted)]'
                  "
                >
                  {{ team.scoreDiff > 0 ? '+' : '' }}{{ team.scoreDiff }}
                </td>
                <td
                  class="px-4 py-3 text-center text-blue-600 dark:text-blue-400 font-bold text-lg"
                >
                  {{ team.points }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- ═══ 平均分对比 ═══ -->
      <UCard v-if="scoreStats" class="mb-6">
        <template #header>
          <h2
            class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <UIcon name="i-lucide-trending-up" class="w-4 h-4 text-[var(--color-text-muted)]" />
            平均分对比
          </h2>
        </template>
        <div class="grid grid-cols-2 gap-6">
          <div class="text-center p-4 rounded-xl bg-[var(--color-bg-secondary)]">
            <div class="flex items-center justify-center gap-2 mb-2">
              <UIcon name="i-lucide-circle" class="w-4 h-4 text-[var(--color-accent-primary)]" />
              <span class="text-sm text-[var(--color-text-secondary)]">正方平均分</span>
            </div>
            <p class="text-3xl font-bold text-[var(--color-accent-primary)]">
              {{ scoreStats.averageScoreTeamA }}
            </p>
          </div>
          <div class="text-center p-4 rounded-xl bg-[var(--color-bg-secondary)]">
            <div class="flex items-center justify-center gap-2 mb-2">
              <UIcon name="i-lucide-circle" class="w-4 h-4 text-[var(--color-accent-error)]" />
              <span class="text-sm text-[var(--color-text-secondary)]">反方平均分</span>
            </div>
            <p class="text-3xl font-bold text-[var(--color-accent-error)]">
              {{ scoreStats.averageScoreTeamB }}
            </p>
          </div>
        </div>
      </UCard>

      <!-- ═══ 维度评分分析 ═══ -->
      <UCard v-if="dimensionStats.length" class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h2
              class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-award" class="w-4 h-4 text-[var(--color-text-muted)]" />
              维度评分分析
            </h2>
            <UButton color="primary" variant="outline" size="xs" @click="exportDimensionCSV">
              <UIcon name="i-lucide-download" class="w-3 h-3 mr-1" />
              导出
            </UButton>
          </div>
        </template>
        <div class="space-y-4">
          <div v-for="dim in dimensionStats" :key="dim.name" class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="font-medium text-[var(--color-text-primary)]">{{ dim.name }}</span>
              <span class="text-[var(--color-text-muted)]"
                >{{ dim.avg }} 分（{{ dim.count }} 次评分）</span
              >
            </div>
            <div class="h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] rounded-full transition-all duration-500"
                :style="{ width: `${Math.min(dim.avg * 2, 100)}%` }"
              />
            </div>
          </div>
        </div>
      </UCard>

      <!-- ═══ 评委评分分布 ═══ -->
      <UCard v-if="Object.keys(judgeScoreDistribution).length" class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h2
              class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-gavel" class="w-4 h-4 text-[var(--color-text-muted)]" />
              评委评分分布
            </h2>
            <UButton
              color="primary"
              variant="outline"
              size="xs"
              @click="exportJudgeDistributionCSV"
            >
              <UIcon name="i-lucide-download" class="w-3 h-3 mr-1" />
              导出
            </UButton>
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-[var(--color-border)]">
                <th
                  class="text-left py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  评委
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  评分场次
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  平均分
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  最低分
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  最高分
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  波动范围
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(stats, judge) in judgeScoreDistribution"
                :key="judge"
                class="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <td class="py-3 px-4">
                  <span class="font-medium text-[var(--color-text-primary)]">{{ judge }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-sm font-medium text-[var(--color-text-primary)]">{{
                    stats.count
                  }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-sm font-bold text-[var(--color-accent-primary)]">{{
                    stats.avg
                  }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-sm font-medium text-[var(--color-accent-success)]">{{
                    stats.min
                  }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-sm font-medium text-[var(--color-accent-error)]">{{
                    stats.max
                  }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-sm text-[var(--color-text-muted)]">{{
                    stats.max - stats.min
                  }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- ═══ 比赛评分详情（分页） ═══ -->
      <UCard v-if="matchScores.length">
        <template #header>
          <div class="flex items-center justify-between">
            <h2
              class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-file-text" class="w-4 h-4 text-[var(--color-text-muted)]" />
              比赛评分详情
            </h2>
            <span class="text-xs text-[var(--color-text-muted)]">
              显示 {{ paginatedMatchScores.length }} / {{ matchScores.length }} 场
            </span>
          </div>
        </template>
        <div class="space-y-6">
          <div
            v-for="item in paginatedMatchScores"
            :key="item.match.id"
            class="p-4 rounded-xl bg-[var(--color-bg-secondary)]"
          >
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <span
                  class="text-xs px-2 py-1 rounded-full bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)] font-medium"
                >
                  第 {{ item.match.round }} 轮
                </span>
                <span class="font-semibold text-[var(--color-text-primary)]">
                  {{ item.match.teamA }} vs {{ item.match.teamB }}
                </span>
              </div>
              <span
                :class="[
                  'text-sm font-medium',
                  item.match.winner === 'teamA'
                    ? 'text-[var(--color-accent-primary)]'
                    : item.match.winner === 'teamB'
                      ? 'text-[var(--color-accent-error)]'
                      : 'text-[var(--color-accent-warning)]',
                ]"
              >
                {{
                  item.match.winner === 'teamA'
                    ? item.match.teamA
                    : item.match.winner === 'teamB'
                      ? item.match.teamB
                      : '平局'
                }}
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="score in item.scores.scores"
                :key="score.judgeName"
                class="p-3 rounded-lg bg-[var(--color-bg-tertiary)]"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-[var(--color-text-primary)]">{{
                    score.judgeName
                  }}</span>
                  <span class="text-sm text-[var(--color-text-muted)]">
                    {{ score.scoreTeamA }} - {{ score.scoreTeamB }}
                  </span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="dim in score.dimensions"
                    :key="dim.name"
                    class="text-xs px-2 py-0.5 rounded bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]"
                  >
                    {{ dim.name }}: {{ dim.score }}
                  </span>
                </div>
                <div
                  v-if="score.bestDebaterA || score.bestDebaterB"
                  class="mt-2 flex flex-wrap gap-2"
                >
                  <span
                    v-if="score.bestDebaterA"
                    class="text-xs px-2 py-0.5 rounded bg-[var(--color-success-bg)] text-[var(--color-accent-success)]"
                  >
                    最佳辩手(正): {{ score.bestDebaterA }}
                  </span>
                  <span
                    v-if="score.bestDebaterB"
                    class="text-xs px-2 py-0.5 rounded bg-[var(--color-error-bg)] text-[var(--color-accent-error)]"
                  >
                    最佳辩手(反): {{ score.bestDebaterB }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 加载更多按钮 -->
        <div v-if="hasMoreScores" class="mt-6 text-center">
          <UButton color="neutral" variant="outline" size="sm" @click="loadMoreScores">
            <UIcon name="i-lucide-chevron-down" class="w-4 h-4 mr-1" />
            加载更多 (还剩 {{ matchScores.length - paginatedMatchScores.length }} 场)
          </UButton>
        </div>
      </UCard>

      <!-- ═══ 无数据提示 ═══ -->
      <div
        v-if="!loading && (!scoreStats || scoreStats.totalMatches === 0)"
        class="text-center py-12"
      >
        <UIcon
          name="i-lucide-chart-bar"
          class="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4"
        />
        <p class="text-[var(--color-text-muted)]">暂无评分数据</p>
        <p class="text-sm text-[var(--color-text-muted)] mt-1">完成比赛评分后将显示分析结果</p>
        <div class="mt-4 flex justify-center gap-4 text-xs text-[var(--color-text-muted)]">
          <div class="flex items-center gap-1">
            <UIcon name="i-lucide-info" class="w-3 h-3" />
            <span>评分数据来源于评委提交的评分表</span>
          </div>
        </div>
      </div>

      <!-- 有数据但无评分详情 -->
      <div
        v-else-if="!loading && scoreStats?.totalMatches > 0 && !matchScores.length"
        class="text-center py-12"
      >
        <UIcon
          name="i-lucide-clipboard-list"
          class="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4"
        />
        <p class="text-[var(--color-text-muted)]">比赛已完成但暂无评分记录</p>
        <p class="text-sm text-[var(--color-text-muted)] mt-1">请提醒评委提交评分</p>
      </div>
    </div>
  </div>
</template>
