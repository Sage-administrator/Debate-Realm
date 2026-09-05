<!--
  赛事统计/积分榜页面
  功能：
  - 展示赛事积分榜、比赛进度、最佳辩手榜、评委评分榜
  - 支持公开访问（isPublic 的赛事）
-->
<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const toast = useToast()

const tournamentId = computed(() => route.params.id as string)

// ── 数据状态 ──
const loading = ref(true)
// ponytail: 显式声明类型，避免 Volar 模板中 v-for 索引被误推断为 string | number
interface StandingsTeam {
  id: string
  name: string
  played: number
  wins: number
  draws: number
  losses: number
  scoreFor: number
  scoreAgainst: number
  scoreDiff: number
  points: number
  groupLabel?: string
}
const data = ref<{
  tournament: { name: string; organizer: string; status: string; format: string }
  matchStats: { total: number; finished: number; ongoing: number; progress: number }
  standings: StandingsTeam[]
  groups: { label: string; teams: StandingsTeam[] }[]
  bestDebaters: { name: string; count: number }[]
  judgeRankings: { name: string; count: number }[]
} | null>(null)
const activeTab = ref<'overall' | 'groups' | 'matches' | 'debaters'>('overall')

// ── 赛制中文名 ──
const formatLabels: Record<string, string> = {
  single_elimination: '单败淘汰赛',
  double_elimination: '双败淘汰赛',
  round_robin: '循环赛',
  page_playoff: '佩寄制',
  swiss: '瑞士制',
  group_knockout: '小组+淘汰赛',
  manual: '自定义',
}

const statusLabels: Record<string, string> = {
  pending: '报名中',
  ongoing: '进行中',
  finished: '已结束',
  cancelled: '已取消',
}

// ── 加载数据 ──
async function loadData() {
  loading.value = true
  try {
    const res: any = await $fetch(`/api/tournaments/${tournamentId.value}/standings`)
    if (res.success) {
      data.value = res.data
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ── 获取排名奖牌颜色 ──
function rankMedalColor(rank: number) {
  if (rank === 1) return 'text-amber-600 dark:text-amber-400'
  if (rank === 2) return 'text-gray-300'
  if (rank === 3) return 'text-amber-700'
  return 'text-[var(--color-text-muted)]'
}

function rankBgColor(rank: number) {
  if (rank === 1) return 'bg-amber-500/20 border-amber-500/30'
  if (rank === 2) return 'bg-gray-400/10 border-gray-400/30'
  if (rank === 3) return 'bg-amber-700/20 border-amber-700/30'
  return 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
}

// ── 初始化 ──
onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="min-h-screen bg-[var(--color-bg-primary)]">
    <!-- 顶部导航 -->
    <header
      class="sticky top-0 z-50 backdrop-blur-xl bg-[var(--color-bg-secondary)]/80 border-b border-[var(--color-border)]"
    >
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3 cursor-pointer" @click="navigateTo('/tournaments')">
          <UIcon name="i-lucide-arrow-left" class="w-5 h-5 text-[var(--color-text-secondary)]" />
          <span
            class="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >返回</span
          >
        </div>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-bar-chart-3" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span class="text-[var(--color-text-primary)] font-medium">赛事统计</span>
        </div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <!-- 加载中 -->
      <div v-if="loading" class="text-center py-20">
        <div
          class="inline-block animate-spin w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full"
        ></div>
        <p class="text-[var(--color-text-muted)] mt-4">加载中...</p>
      </div>

      <template v-else-if="data">
        <!-- ═══ 赛事头部信息 ═══ -->
        <div
          class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] overflow-hidden mb-8"
        >
          <div class="h-2 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"></div>
          <div class="p-8">
            <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <div class="flex items-center gap-3 mb-2">
                  <span
                    class="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  >
                    {{ statusLabels[data.tournament.status] || data.tournament.status }}
                  </span>
                  <span
                    class="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                  >
                    {{ formatLabels[data.tournament.format] || data.tournament.format }}
                  </span>
                </div>
                <h1 class="text-3xl font-bold text-[var(--color-text-primary)]">
                  {{ data.tournament.name }}
                </h1>
                <p class="text-[var(--color-text-muted)] mt-2">
                  主办方：{{ data.tournament.organizer }}
                </p>
              </div>
            </div>

            <!-- 进度统计卡片 -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
                <div class="text-2xl font-bold text-[var(--color-text-primary)]">
                  {{ data.matchStats.total }}
                </div>
                <div class="text-xs text-[var(--color-text-muted)] mt-1">总场次</div>
              </div>
              <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
                <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {{ data.matchStats.finished }}
                </div>
                <div class="text-xs text-[var(--color-text-muted)] mt-1">已完成</div>
              </div>
              <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {{ data.matchStats.ongoing }}
                </div>
                <div class="text-xs text-[var(--color-text-muted)] mt-1">进行中</div>
              </div>
              <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
                <div class="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {{ data.matchStats.progress }}%
                </div>
                <div class="text-xs text-[var(--color-text-muted)] mt-1">完成进度</div>
              </div>
            </div>

            <!-- 进度条 -->
            <div class="mt-6">
              <div class="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                  :style="{ width: data.matchStats.progress + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ Tab 切换 ═══ -->
        <div class="flex gap-2 mb-6 border-b border-[var(--color-border)] pb-0 overflow-x-auto">
          <button
            v-for="tab in [
              { key: 'overall', label: '总积分榜', icon: 'i-lucide-trophy' },
              { key: 'groups', label: '分组榜', icon: 'i-lucide-layout-grid' },
              { key: 'debaters', label: '最佳辩手', icon: 'i-lucide-star' },
            ]"
            :key="tab.key"
            :class="[
              'px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-all whitespace-nowrap',
              activeTab === tab.key
                ? 'text-blue-600 dark:text-blue-400 border-blue-400'
                : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-primary)]',
            ]"
            @click="
              () => {
                activeTab = tab.key as any
              }
            "
          >
            <div class="flex items-center gap-2">
              <UIcon :name="tab.icon" class="w-4 h-4" />
              {{ tab.label }}
            </div>
          </button>
        </div>

        <!-- ═══ 总积分榜 ═══ -->
        <div
          v-if="activeTab === 'overall'"
          class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] overflow-hidden"
        >
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr
                  class="border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-sm"
                >
                  <th class="px-6 py-4 text-left w-16">排名</th>
                  <th class="px-6 py-4 text-left">队伍</th>
                  <th class="px-6 py-4 text-center">场次</th>
                  <th class="px-6 py-4 text-center">胜</th>
                  <th class="px-6 py-4 text-center">平</th>
                  <th class="px-6 py-4 text-center">负</th>
                  <th class="px-6 py-4 text-center">得分</th>
                  <th class="px-6 py-4 text-center">失分</th>
                  <th class="px-6 py-4 text-center">净胜分</th>
                  <th class="px-6 py-4 text-center font-bold">积分</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(team, idx) in data.standings"
                  :key="team.id"
                  :class="[
                    'border-b border-[var(--color-border-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors',
                    rankBgColor(idx + 1),
                  ]"
                >
                  <td class="px-6 py-4">
                    <span :class="['font-bold text-lg', rankMedalColor(idx + 1)]">
                      {{ idx + 1 }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold"
                      >
                        {{ team.name.charAt(0) }}
                      </div>
                      <div>
                        <div class="text-[var(--color-text-primary)] font-medium">
                          {{ team.name }}
                        </div>
                        <div v-if="team.groupLabel" class="text-xs text-[var(--color-text-muted)]">
                          {{ team.groupLabel }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-center text-[var(--color-text-secondary)]">
                    {{ team.played }}
                  </td>
                  <td class="px-6 py-4 text-center text-emerald-600 dark:text-emerald-400">
                    {{ team.wins }}
                  </td>
                  <td class="px-6 py-4 text-center text-[var(--color-text-muted)]">
                    {{ team.draws }}
                  </td>
                  <td class="px-6 py-4 text-center text-red-500 dark:text-red-400">
                    {{ team.losses }}
                  </td>
                  <td class="px-6 py-4 text-center text-[var(--color-text-secondary)]">
                    {{ team.scoreFor }}
                  </td>
                  <td class="px-6 py-4 text-center text-[var(--color-text-secondary)]">
                    {{ team.scoreAgainst }}
                  </td>
                  <td
                    class="px-6 py-4 text-center"
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
                    class="px-6 py-4 text-center text-blue-600 dark:text-blue-400 font-bold text-lg"
                  >
                    {{ team.points }}
                  </td>
                </tr>
                <tr v-if="data.standings.length === 0">
                  <td colspan="10" class="px-6 py-12 text-center text-[var(--color-text-muted)]">
                    <UIcon
                      name="i-lucide-trophy"
                      class="w-12 h-12 mx-auto mb-3 text-[var(--color-border-muted)]"
                    />
                    暂无积分数据
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ═══ 分组榜 ═══ -->
        <div v-if="activeTab === 'groups'">
          <div
            v-if="data.groups.length === 0"
            class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-12 text-center"
          >
            <UIcon
              name="i-lucide-layout-grid"
              class="w-12 h-12 mx-auto mb-3 text-[var(--color-border-muted)]"
            />
            <p class="text-[var(--color-text-muted)]">本次赛事无分组</p>
          </div>

          <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
              v-for="group in data.groups"
              :key="group.label"
              class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] overflow-hidden"
            >
              <div class="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center"
                >
                  <span class="text-white text-xs font-bold">{{
                    group.label.replace('组', '')
                  }}</span>
                </div>
                <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
                  {{ group.label }}
                </h3>
                <span class="text-[var(--color-text-muted)] text-sm ml-auto"
                  >{{ group.teams.length }} 支队伍</span
                >
              </div>
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr
                      class="border-b border-[var(--color-border-muted)] text-[var(--color-text-muted)] text-xs"
                    >
                      <th class="px-4 py-3 text-left w-12">排名</th>
                      <th class="px-4 py-3 text-left">队伍</th>
                      <th class="px-4 py-3 text-center">胜</th>
                      <th class="px-4 py-3 text-center">负</th>
                      <th class="px-4 py-3 text-center">积分</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(team, idx) in group.teams"
                      :key="team.id"
                      class="border-b border-[var(--color-border-muted)]"
                    >
                      <td class="px-4 py-3">
                        <span :class="['font-bold', rankMedalColor(idx + 1)]">{{ idx + 1 }}</span>
                      </td>
                      <td class="px-4 py-3 text-[var(--color-text-primary)] text-sm">
                        {{ team.name }}
                      </td>
                      <td
                        class="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 text-sm"
                      >
                        {{ team.wins }}
                      </td>
                      <td class="px-4 py-3 text-center text-red-500 dark:text-red-400 text-sm">
                        {{ team.losses }}
                      </td>
                      <td class="px-4 py-3 text-center text-blue-600 dark:text-blue-400 font-bold">
                        {{ team.points }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ 最佳辩手榜 ═══ -->
        <div v-if="activeTab === 'debaters'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- 最佳辩手 -->
          <div
            class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] overflow-hidden"
          >
            <div class="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
              <UIcon name="i-lucide-star" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">最佳辩手榜</h3>
            </div>
            <div class="p-6">
              <div v-if="data.bestDebaters.length === 0" class="text-center py-8">
                <UIcon
                  name="i-lucide-star"
                  class="w-12 h-12 mx-auto mb-3 text-[var(--color-border-muted)]"
                />
                <p class="text-[var(--color-text-muted)]">暂无最佳辩手数据</p>
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="(d, idx) in data.bestDebaters"
                  :key="d.name"
                  class="flex items-center gap-4"
                >
                  <div
                    :class="[
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                      idx < 3
                        ? 'bg-gradient-to-br from-amber-500 to-orange-400 text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
                    ]"
                  >
                    {{ idx + 1 }}
                  </div>
                  <div class="flex-1">
                    <div class="text-[var(--color-text-primary)] font-medium">{{ d.name }}</div>
                  </div>
                  <div class="text-amber-600 dark:text-amber-400 font-bold">{{ d.count }}</div>
                  <div class="text-[var(--color-text-muted)] text-sm">次</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 评委评分榜 -->
          <div
            class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] overflow-hidden"
          >
            <div class="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
              <UIcon name="i-lucide-gavel" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">评委评分统计</h3>
            </div>
            <div class="p-6">
              <div v-if="data.judgeRankings.length === 0" class="text-center py-8">
                <UIcon
                  name="i-lucide-gavel"
                  class="w-12 h-12 mx-auto mb-3 text-[var(--color-border-muted)]"
                />
                <p class="text-[var(--color-text-muted)]">暂无评分数据</p>
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="(j, idx) in data.judgeRankings"
                  :key="j.name"
                  class="flex items-center gap-4"
                >
                  <div
                    :class="[
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                      idx < 3
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
                    ]"
                  >
                    {{ idx + 1 }}
                  </div>
                  <div class="flex-1">
                    <div class="text-[var(--color-text-primary)] font-medium">{{ j.name }}</div>
                  </div>
                  <div class="text-blue-600 dark:text-blue-400 font-bold">{{ j.count }}</div>
                  <div class="text-[var(--color-text-muted)] text-sm">场</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- Footer -->
    <footer class="border-t border-[var(--color-border)] py-8 mt-12">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p class="text-[var(--color-text-muted)] text-sm">
          © 2024 辩论计时系统 · 专业辩论赛管理平台
        </p>
      </div>
    </footer>
  </div>
</template>
