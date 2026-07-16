<!--
  公开赛事详情页（宣传+报名入口）
  功能：
  - 无需登录即可查看赛事介绍、参赛队伍、评委信息
  - 提供报名入口（跳转到报名页）
  - 展示赛事统计数据
-->
<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const toast = useToast()

// ── 数据状态 ──
const tournament = ref<any>(null)
const loading = ref(true)
const loadError = ref(false)

const tournamentId = computed(() => route.params.id as string)

// ── 赛制中文名映射 ──
const formatLabels: Record<string, string> = {
  single_elimination: '单败淘汰赛',
  double_elimination: '双败淘汰赛',
  round_robin: '循环赛',
  page_playoff: '佩寄制',
  swiss: '瑞士制',
  group_knockout: '小组+淘汰赛',
  manual: '自定义',
}

// ── 状态中文名映射 ──
const statusLabels: Record<string, string> = {
  pending: '报名中',
  ongoing: '进行中',
  finished: '已结束',
  cancelled: '已取消',
}

const statusColors: Record<string, string> = {
  pending: 'bg-green-500/20 text-green-400',
  ongoing: 'bg-blue-500/20 text-blue-400',
  finished: 'bg-gray-500/20 text-gray-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

// ── 报名类型中文名 ──
const regTypeLabels: Record<string, string> = {
  individual: '仅个人报名',
  team: '仅队伍报名',
  both: '个人/队伍报名',
}

// ── 当前激活的Tab ──
const activeTab = ref<'intro' | 'teams' | 'judges' | 'schedule'>('intro')

// ── 加载赛事详情 ──
async function loadTournament() {
  loading.value = true
  loadError.value = false
  try {
    const res: any = await $fetch(`/api/tournaments/${tournamentId.value}/public`)
    if (res.success) {
      tournament.value = res.data
    }
  } catch (e: any) {
    loadError.value = true
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ── 格式化日期 ──
function formatDate(d: any) {
  if (!d) return '待定'
  const date = new Date(d)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(d: any) {
  if (!d) return '待定'
  const date = new Date(d)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ── 判断报名是否已截止 ──
const isRegistrationClosed = computed(() => {
  if (!tournament.value?.registrationOpen) return true
  if (tournament.value?.registrationDeadline) {
    return new Date() > new Date(tournament.value.registrationDeadline)
  }
  return false
})

// ── 跳转报名页 ──
function goRegister() {
  navigateTo(`/tournaments/${tournamentId.value}/register`)
}

// ── 初始化 ──
onMounted(() => {
  loadTournament()
})
</script>

<template>
  <div class="min-h-screen bg-[var(--color-bg-primary)]">
    <!-- ═══════════ 顶部导航 ═══════════ -->
    <header class="sticky top-0 z-50 backdrop-blur-xl bg-[var(--color-bg-secondary)]/80 border-b border-[var(--color-border)]">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3 cursor-pointer" @click="navigateTo('/tournaments')">
          <UIcon name="i-lucide-arrow-left" class="w-5 h-5 text-[var(--color-text-secondary)]" />
          <span class="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">返回赛事列表</span>
        </div>
        <div class="flex items-center gap-3">
          <UButton variant="ghost" color="neutral" size="sm" @click="() => { navigateTo('/login') }">
            登录
          </UButton>
        </div>
      </div>
    </header>

    <!-- ═══════════ 加载中 ═══════════ -->
    <div v-if="loading" class="text-center py-20">
      <div class="inline-block animate-spin w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      <p class="text-[var(--color-text-muted)] mt-4">加载中...</p>
    </div>

    <!-- ═══════════ 加载失败 ═══════════ -->
    <div v-else-if="loadError" class="text-center py-20">
      <UIcon name="i-lucide-alert-circle" class="w-16 h-16 text-red-400/50 mx-auto mb-4" />
      <p class="text-[var(--color-text-secondary)] mb-4">赛事不存在或未公开</p>
      <UButton color="neutral" variant="ghost" @click="() => { navigateTo('/tournaments') }">
        返回赛事列表
      </UButton>
    </div>

    <!-- ═══════════ 赛事详情 ═══════════ -->
    <main v-else-if="tournament" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <!-- ── 赛事头部 ── -->
      <div class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] overflow-hidden mb-8">
        <!-- 顶部渐变条 -->
        <div class="h-3 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"></div>

        <div class="p-8">
          <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div class="flex-1">
              <!-- 状态标签 -->
              <div class="flex items-center gap-3 mb-3">
                <span :class="['px-3 py-1 rounded-full text-xs font-medium', statusColors[tournament.status] || 'bg-gray-500/20 text-gray-400']">
                  {{ statusLabels[tournament.status] || tournament.status }}
                </span>
                <span class="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                  {{ formatLabels[tournament.format] || tournament.format }}
                </span>
                <span class="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                  {{ regTypeLabels[tournament.registrationType] || tournament.registrationType }}
                </span>
              </div>
              <!-- 赛事名称 -->
              <h1 class="text-3xl font-bold text-[var(--color-text-primary)] mb-3">{{ tournament.name }}</h1>
              <!-- 主办方 -->
              <div class="flex items-center gap-2 text-[var(--color-text-muted)]">
                <UIcon name="i-lucide-building" class="w-4 h-4" />
                <span>{{ tournament.organizer }}</span>
              </div>
            </div>

            <!-- 报名按钮 + 积分榜入口 -->
            <div class="flex flex-col items-end gap-2">
              <!-- 报名按钮 -->
              <button
                v-if="tournament.registrationOpen && !isRegistrationClosed"
                class="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-[var(--color-text-primary)] rounded-xl font-medium hover:from-blue-600 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/25"
                @click="goRegister"
              >
                立即报名
              </button>
              <button
                v-else
                class="px-8 py-3 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded-xl font-medium cursor-not-allowed"
                disabled
              >
                {{ tournament.registrationDeadline && isRegistrationClosed ? '报名已截止' : '报名未开放' }}
              </button>
              <span v-if="tournament.registrationDeadline" class="text-xs text-[var(--color-text-muted)]">
                截止：{{ formatDate(tournament.registrationDeadline) }}
              </span>
              <!-- 积分榜入口 -->
              <button
                class="mt-2 px-6 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg text-sm hover:bg-[var(--color-bg-tertiary)] transition-all flex items-center gap-2"
                @click="navigateTo(`/tournaments/${tournament.id}/standings`)"
              >
                <UIcon name="i-lucide-bar-chart-3" class="w-4 h-4" />
                查看积分榜
              </button>
            </div>
          </div>

          <!-- 数据统计卡片 -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
              <div class="text-2xl font-bold text-[var(--color-text-primary)]">{{ tournament.stats.registrationCount }}</div>
              <div class="text-xs text-[var(--color-text-muted)] mt-1">已报名</div>
            </div>
            <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
              <div class="text-2xl font-bold text-[var(--color-text-primary)]">{{ tournament.teams.length }}</div>
              <div class="text-xs text-[var(--color-text-muted)] mt-1">参赛队伍</div>
            </div>
            <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
              <div class="text-2xl font-bold text-[var(--color-text-primary)]">{{ tournament.stats.judgeCount }}</div>
              <div class="text-xs text-[var(--color-text-muted)] mt-1">评委</div>
            </div>
            <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
              <div class="text-2xl font-bold text-[var(--color-text-primary)]">{{ tournament.stats.matchCount }}</div>
              <div class="text-xs text-[var(--color-text-muted)] mt-1">比赛场次</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Tab 切换 ── -->
      <div class="flex gap-2 mb-6 border-b border-[var(--color-border)] pb-0">
        <button
          v-for="tab in [
            { key: 'intro', label: '赛事介绍', icon: 'i-lucide-file-text' },
            { key: 'teams', label: '参赛队伍', icon: 'i-lucide-users' },
            { key: 'judges', label: '评委阵容', icon: 'i-lucide-gavel' },
            { key: 'schedule', label: '赛程安排', icon: 'i-lucide-calendar' },
          ]"
          :key="tab.key"
          :class="[
            'px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-all',
            activeTab === tab.key
              ? 'text-blue-400 border-blue-400'
              : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-primary)]',
          ]"
          @click="() => { activeTab = tab.key as any }"
        >
          <div class="flex items-center gap-2">
            <UIcon :name="tab.icon" class="w-4 h-4" />
            {{ tab.label }}
          </div>
        </button>
      </div>

      <!-- ── Tab 内容 ── -->
      <div class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-6">
        <!-- 赛事介绍 -->
        <div v-if="activeTab === 'intro'">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">赛事信息</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-calendar" class="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <div class="text-xs text-[var(--color-text-muted)]">比赛时间</div>
                <div class="text-[var(--color-text-primary)]">{{ formatDateShort(tournament.scheduledAt) }}</div>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-map-pin" class="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <div class="text-xs text-[var(--color-text-muted)]">比赛地点</div>
                <div class="text-[var(--color-text-primary)]">{{ tournament.venue || '待定' }}</div>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-swords" class="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <div class="text-xs text-[var(--color-text-muted)]">比赛赛制</div>
                <div class="text-[var(--color-text-primary)]">{{ formatLabels[tournament.format] || tournament.format }}</div>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-users" class="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <div class="text-xs text-[var(--color-text-muted)]">队伍人数要求</div>
                <div class="text-[var(--color-text-primary)]">
                  {{ tournament.teamSize ? (tournament.teamSize + 'v' + tournament.teamSize + ' 制') : '不限' }}
                </div>
              </div>
            </div>
          </div>

          <!-- 赛事介绍 -->
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-3">赛事介绍</h3>
          <div class="prose prose-invert max-w-none">
            <p v-if="tournament.description" class="text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {{ tournament.description }}
            </p>
            <p v-else class="text-[var(--color-text-muted)] italic">暂无赛事介绍</p>
          </div>

          <!-- 报名须知 -->
          <div v-if="tournament.registrationInfo" class="mt-6 pt-6 border-t border-[var(--color-border)]">
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
              <span class="flex items-center gap-2">
                <UIcon name="i-lucide-info" class="w-5 h-5 text-amber-400" />
                报名须知
              </span>
            </h3>
            <p class="text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {{ tournament.registrationInfo }}
            </p>
          </div>
        </div>

        <!-- 参赛队伍 -->
        <div v-if="activeTab === 'teams'">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            参赛队伍
            <span class="text-sm font-normal text-[var(--color-text-muted)] ml-2">共 {{ tournament.teams.length }} 支</span>
          </h3>
          <div v-if="tournament.teams.length === 0" class="text-center py-12">
            <UIcon name="i-lucide-users" class="w-12 h-12 text-[var(--color-border-muted)] mx-auto mb-3" />
            <p class="text-[var(--color-text-muted)]">暂无参赛队伍</p>
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              v-for="(team, idx) in tournament.teams"
              :key="idx"
              class="flex items-center gap-3 bg-[var(--color-bg-secondary)] rounded-xl p-4"
            >
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-[var(--color-text-primary)] font-bold text-sm">
                {{ Number(idx) + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[var(--color-text-primary)] font-medium truncate">{{ team.name }}</div>
                <div v-if="team.groupLabel" class="text-xs text-[var(--color-text-muted)]">{{ team.groupLabel }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 评委阵容 -->
        <div v-if="activeTab === 'judges'">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            评委阵容
            <span class="text-sm font-normal text-[var(--color-text-muted)] ml-2">共 {{ tournament.judges.length }} 位</span>
          </h3>
          <div v-if="tournament.judges.length === 0" class="text-center py-12">
            <UIcon name="i-lucide-gavel" class="w-12 h-12 text-[var(--color-border-muted)] mx-auto mb-3" />
            <p class="text-[var(--color-text-muted)]">暂无评委信息</p>
          </div>
          <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div
              v-for="(judge, idx) in tournament.judges"
              :key="idx"
              class="flex items-center gap-3 bg-[var(--color-bg-secondary)] rounded-xl p-4"
            >
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center text-[var(--color-text-primary)] font-bold text-sm">
                {{ judge.charAt(0) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[var(--color-text-primary)] font-medium truncate">{{ judge }}</div>
                <div class="text-xs text-[var(--color-text-muted)]">评委</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 赛程安排 -->
        <div v-if="activeTab === 'schedule'">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">赛程安排</h3>
          <div class="text-center py-12">
            <UIcon name="i-lucide-calendar-clock" class="w-12 h-12 text-[var(--color-border-muted)] mx-auto mb-3" />
            <p class="text-[var(--color-text-muted)] mb-2">赛程即将公布</p>
            <p class="text-[var(--color-text-muted)] text-sm">请关注赛事主办方后续通知</p>
          </div>
        </div>
      </div>

      <!-- ── 底部报名 CTA ── -->
      <div v-if="tournament.registrationOpen && !isRegistrationClosed" class="mt-8 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl border border-blue-500/30 p-8 text-center">
        <h3 class="text-xl font-bold text-[var(--color-text-primary)] mb-2">心动不如行动</h3>
        <p class="text-[var(--color-text-secondary)] mb-6">立即报名，展现你的辩论风采！</p>
        <button
          class="px-10 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-[var(--color-text-primary)] rounded-xl font-medium hover:from-blue-600 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/25"
          @click="goRegister"
        >
          立即报名参赛
        </button>
      </div>
    </main>

    <!-- ═══════════ 底部 Footer ═══════════ -->
    <footer class="border-t border-[var(--color-border)] py-8 mt-12">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p class="text-[var(--color-text-muted)] text-sm">
          © 2024 辩论计时系统 · 专业辩论赛管理平台
        </p>
      </div>
    </footer>
  </div>
</template>
