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
const matches = ref<any[]>([])
const loading = ref(true)

// 获取比赛数据
async function loadMatches() {
  try {
    loading.value = true
    const res = await fetch(`/api/tournaments/${tournamentId.value}/matches`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    const data = await res.json()
    // 防御：鉴权失败时接口返回错误对象而非数组，直接赋值会让 matchesByRound 等
    // 计算属性在 matches.value.forEach(...) 时抛 TypeError，导致整页渲染崩溃（空白）
    matches.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('加载比赛数据失败:', error)
    matches.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadMatches()
})

// ═══════════════════════════════════════════
// 计算属性
// ═══════════════════════════════════════════

// 按轮次分组比赛
const matchesByRound = computed(() => {
  const groups: Record<number, any[]> = {}
  matches.value.forEach((match) => {
    const round = match.round || 1
    if (!groups[round]) {
      groups[round] = []
    }
    groups[round].push(match)
  })

  const sortedKeys = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
  return sortedKeys.map((key) => {
    const roundMatches = groups[key] || []
    return {
      round: key,
      matches: roundMatches.sort((a, b) => Number(a.orderNum || 0) - Number(b.orderNum || 0)),
    }
  })
})

// 转换为 BracketView 所需的数据格式
const bracketMatches = computed(() => {
  return matches.value.map((m) => ({
    id: m.id,
    round: m.round || 1,
    teamA: m.teamA,
    teamB: m.teamB,
    teamAName: m.teamA,
    teamBName: m.teamB,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winner: m.winner,
    status: m.status === 'ongoing' ? 'running' : m.status,
  }))
})

// 状态统计
const statusStats = computed(() => {
  const total = matches.value.length
  const finished = matches.value.filter((m) => m.status === 'finished').length
  const ongoing = matches.value.filter((m) => m.status === 'ongoing').length
  const pending = matches.value.filter((m) => m.status === 'pending').length
  return { total, finished, ongoing, pending }
})

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

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
    case 'finished':
      return 'bg-[var(--color-success-bg)] text-[var(--color-accent-success)]'
    case 'ongoing':
      return 'bg-[var(--color-warning-bg)] text-[var(--color-accent-warning)]'
    default:
      return 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
  }
}

// 判断胜者样式
const getWinnerStyle = (match: any, team: string) => {
  if (match.status !== 'finished') return ''
  const isWinner =
    (match.winner === 'teamA' && team === match.teamA) ||
    (match.winner === 'teamB' && team === match.teamB)
  return isWinner
    ? 'font-bold text-[var(--color-accent-primary)]'
    : 'text-[var(--color-text-muted)]'
}

// 获取比赛状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'finished':
      return '已结束'
    case 'ongoing':
      return '进行中'
    default:
      return '待进行'
  }
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
      <!-- ═══ 轮次统计 ═══ -->
      <UCard class="mb-6" v-if="matchesByRound.length">
        <template #header>
          <h2
            class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <UIcon name="i-lucide-info" class="w-4 h-4 text-[var(--color-text-muted)]" />
            赛事概览
          </h2>
        </template>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="text-center p-4 rounded-xl bg-[var(--color-bg-secondary)]">
            <p class="text-xs text-[var(--color-text-muted)] mb-1">总轮次</p>
            <p class="text-2xl font-bold text-[var(--color-text-primary)]">
              {{ matchesByRound.length }}
            </p>
          </div>
          <div class="text-center p-4 rounded-xl bg-[var(--color-bg-secondary)]">
            <p class="text-xs text-[var(--color-text-muted)] mb-1">总场次</p>
            <p class="text-2xl font-bold text-[var(--color-text-primary)]">
              {{ statusStats.total }}
            </p>
          </div>
          <div class="text-center p-4 rounded-xl bg-[var(--color-bg-secondary)]">
            <p class="text-xs text-[var(--color-text-muted)] mb-1">已完成</p>
            <p class="text-2xl font-bold text-[var(--color-accent-success)]">
              {{ statusStats.finished }}
            </p>
          </div>
          <div class="text-center p-4 rounded-xl bg-[var(--color-bg-secondary)]">
            <p class="text-xs text-[var(--color-text-muted)] mb-1">进行中</p>
            <p class="text-2xl font-bold text-[var(--color-accent-warning)]">
              {{ statusStats.ongoing }}
            </p>
          </div>
        </div>
      </UCard>

      <!-- ═══ 淘汰赛树状图（BracketView） ═══ -->
      <UCard class="mb-6" v-if="matches.length">
        <template #header>
          <h2
            class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <UIcon name="i-lucide-git-branch" class="w-4 h-4 text-[var(--color-text-muted)]" />
            淘汰赛对阵树
          </h2>
        </template>
        <div class="overflow-x-auto">
          <BracketView :matches="bracketMatches" :show-scores="true" />
        </div>
      </UCard>

      <!-- ═══ 比赛详情卡片（按轮次分组） ═══ -->
      <div v-if="matchesByRound.length" class="space-y-8">
        <div v-for="(roundData, roundIndex) in matchesByRound" :key="roundData.round">
          <!-- 轮次标题 -->
          <div class="flex items-center gap-3 mb-4">
            <span
              class="text-xs px-3 py-1 rounded-full bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)] font-medium"
            >
              第 {{ roundData.round }} 轮
            </span>
            <span class="text-sm font-semibold text-[var(--color-text-primary)]">{{
              getRoundName(roundData.round)
            }}</span>
            <span class="text-xs text-[var(--color-text-muted)]"
              >({{ roundData.matches.length }} 场)</span
            >
          </div>

          <!-- 本轮比赛卡片 -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              v-for="match in roundData.matches"
              :key="match.id"
              :class="[
                'relative p-4 rounded-xl border-2 transition-all duration-300',
                match.status === 'finished'
                  ? 'border-[var(--color-accent-success)] bg-[var(--color-success-bg)]'
                  : match.status === 'ongoing'
                    ? 'border-[var(--color-accent-warning)] bg-[var(--color-warning-bg)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]',
              ]"
            >
              <!-- 状态标签 -->
              <div class="absolute -top-3 left-4">
                <span :class="['text-xs px-2 py-0.5 rounded-full', getStatusColor(match.status)]">
                  {{ getStatusText(match.status) }}
                </span>
              </div>

              <!-- 比赛信息 -->
              <div class="mt-2">
                <!-- 比赛编号 -->
                <p class="text-xs text-[var(--color-text-muted)] mb-3">场次 {{ match.orderNum }}</p>

                <!-- 队伍 A -->
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-8 h-8 rounded-full bg-[var(--color-accent-bg)] flex items-center justify-center"
                    >
                      <UIcon
                        name="i-lucide-circle"
                        class="w-4 h-4 text-[var(--color-accent-primary)]"
                      />
                    </div>
                    <span :class="['text-sm font-medium', getWinnerStyle(match, match.teamA)]">
                      {{ match.teamA || '待定' }}
                    </span>
                  </div>
                  <span
                    v-if="match.scoreA !== null"
                    class="text-lg font-bold text-[var(--color-text-primary)]"
                  >
                    {{ match.scoreA }}
                  </span>
                </div>

                <!-- VS 分隔线 -->
                <div class="flex items-center justify-center gap-2 py-2">
                  <div class="flex-1 h-px bg-[var(--color-border)]" />
                  <span class="text-xs text-[var(--color-text-muted)] font-medium">VS</span>
                  <div class="flex-1 h-px bg-[var(--color-border)]" />
                </div>

                <!-- 队伍 B -->
                <div class="flex items-center justify-between mt-3">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-8 h-8 rounded-full bg-[var(--color-error-bg)] flex items-center justify-center"
                    >
                      <UIcon
                        name="i-lucide-circle"
                        class="w-4 h-4 text-[var(--color-accent-error)]"
                      />
                    </div>
                    <span :class="['text-sm font-medium', getWinnerStyle(match, match.teamB)]">
                      {{ match.teamB || '待定' }}
                    </span>
                  </div>
                  <span
                    v-if="match.scoreB !== null"
                    class="text-lg font-bold text-[var(--color-text-primary)]"
                  >
                    {{ match.scoreB }}
                  </span>
                </div>

                <!-- 辩题 -->
                <div v-if="match.topic" class="mt-3 pt-3 border-t border-[var(--color-border)]">
                  <p class="text-xs text-[var(--color-text-muted)] mb-1">辩题</p>
                  <p class="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                    {{ match.topic }}
                  </p>
                </div>

                <!-- 评委 -->
                <div v-if="match.judge" class="mt-2">
                  <p class="text-xs text-[var(--color-text-muted)]">评委：{{ match.judge }}</p>
                </div>

                <!-- 最佳辩手 -->
                <div
                  v-if="match.status === 'finished' && (match.bestDebaterA || match.bestDebaterB)"
                  class="mt-3 pt-3 border-t border-[var(--color-border)]"
                >
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-if="match.bestDebaterA"
                      class="text-xs px-2 py-0.5 rounded bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]"
                    >
                      最佳辩手(正): {{ match.bestDebaterA }}
                    </span>
                    <span
                      v-if="match.bestDebaterB"
                      class="text-xs px-2 py-0.5 rounded bg-[var(--color-error-bg)] text-[var(--color-accent-error)]"
                    >
                      最佳辩手(反): {{ match.bestDebaterB }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 轮次间箭头连接（晋级指示） -->
          <div v-if="roundIndex < matchesByRound.length - 1" class="flex justify-center mt-6">
            <div class="flex items-center gap-2 text-[var(--color-text-muted)]">
              <UIcon name="i-lucide-arrow-down" class="w-5 h-5" />
              <span class="text-xs">晋级下一轮</span>
              <UIcon name="i-lucide-arrow-down" class="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ 淘汰赛流程图（简易版） ═══ -->
      <UCard v-if="matchesByRound.length > 1" class="mt-8">
        <template #header>
          <h2
            class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <UIcon name="i-lucide-tree-pine" class="w-4 h-4 text-[var(--color-text-muted)]" />
            淘汰赛流程
          </h2>
        </template>
        <div class="flex flex-wrap items-center justify-center gap-4 py-6">
          <div
            v-for="(roundData, idx) in matchesByRound"
            :key="roundData.round"
            class="flex flex-col items-center"
          >
            <div
              :class="[
                'w-20 h-20 rounded-xl flex flex-col items-center justify-center',
                idx === matchesByRound.length - 1
                  ? 'bg-[var(--color-accent-bg)] border-2 border-[var(--color-accent-primary)]'
                  : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]',
              ]"
            >
              <span
                :class="[
                  'text-sm font-bold',
                  idx === matchesByRound.length - 1
                    ? 'text-[var(--color-accent-primary)]'
                    : 'text-[var(--color-text-primary)]',
                ]"
                >{{ getRoundName(roundData.round) }}</span
              >
              <span class="text-xs text-[var(--color-text-muted)]"
                >{{ roundData.matches.length }}场</span
              >
            </div>
            <div
              v-if="idx < matchesByRound.length - 1"
              class="w-8 h-8 flex items-center justify-center"
            >
              <UIcon name="i-lucide-arrow-right" class="w-5 h-5 text-[var(--color-text-muted)]" />
            </div>
          </div>
        </div>
      </UCard>

      <!-- ═══ 无数据提示 ═══ -->
      <div v-if="!loading && matches.length === 0" class="text-center py-12">
        <UIcon
          name="i-lucide-swords"
          class="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4"
        />
        <p class="text-[var(--color-text-muted)]">暂无对阵数据</p>
        <p class="text-sm text-[var(--color-text-muted)] mt-1">生成赛程后将显示对阵图</p>
      </div>
    </div>
  </div>
</template>
