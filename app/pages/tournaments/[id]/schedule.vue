<script setup lang="ts">
// 赛程页面
const route = useRoute()
const toast = useToast()
const { getTournament } = useTournament()

const tournament = ref<any>(null)
const loading = ref(true)
const tournamentId = computed(() => route.params.id as string)

// ── 赛程配置 ──
const scheduleConfig = ref({
  matches: [] as any[],
  currentMatch: 0,
})

// ── 数据加载 ──
async function loadTournament() {
  loading.value = true
  try {
    tournament.value = await getTournament(tournamentId.value)
    if (tournament.value?.matches) {
      scheduleConfig.value.matches = tournament.value.matches
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(() => loadTournament())
</script>

<template>
  <div class="min-h-screen" style="background-color: #F5F7FA;">
    <div class="max-w-[75rem] mx-auto px-6">

      <!-- ═══ 加载状态 ═══ -->
      <div v-if="loading" class="flex justify-center py-24">
        <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin text-gray-400" />
      </div>

      <template v-else-if="tournament">
        <!-- ═══ 头部区域 ═══ -->
        <header class="flex items-end justify-between pt-10 pb-5">
          <div>
            <p class="text-xs text-gray-400 mb-1">
              赛事管理 / ID: {{ tournament.id }}
            </p>
            <h1 class="text-[1.75rem] font-bold text-gray-900 leading-tight">
              {{ tournament.name }}
            </h1>
          </div>
        </header>

        <!-- ═══ 表格样式双层Tab导航 ═══ -->
        <div class="tab-table-row1">
          <span class="tab-primary">基础配置</span>
          <span class="tab-primary">视听设计</span>
          <span class="tab-primary tab-primary--active">进阶功能</span>
        </div>
        <div class="tab-table-row2">
          <NuxtLink :to="`/tournaments/${tournamentId}`" class="tab-secondary">概览</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/info`" class="tab-secondary">比赛信息</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/timing`" class="tab-secondary">计时器环节</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/skin`" class="tab-secondary">背景</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/details`" class="tab-secondary">界面</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/audio`" class="tab-secondary">提示音</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/teams`" class="tab-secondary">队徽</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/schedule`" class="tab-secondary tab-secondary--active">赛程</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/offline`" class="tab-secondary">离线版</NuxtLink>
        </div>

        <!-- ═══ 赛程内容 ═══ -->
        <main class="py-6 space-y-6">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UIcon name="i-lucide-calendar-days" class="w-4 h-4 text-gray-400" /> 赛程管理
            </h2>

            <div v-if="scheduleConfig.matches.length === 0" class="ui-panel text-center py-8 text-sm text-gray-500">
              暂无场次安排
            </div>
            <div v-else class="ui-panel space-y-3">
              <div v-for="(match, index) in scheduleConfig.matches" :key="index" class="flex items-center justify-between p-3 border border-gray-200 rounded">
                <div>
                  <span class="text-sm font-medium text-gray-900">{{ match.round || `第 ${index + 1} 场` }}</span>
                  <span class="text-sm text-gray-500 ml-2">{{ match.teamA }} vs {{ match.teamB }}</span>
                </div>
                <span class="text-xs text-gray-400">{{ match.status || '未开始' }}</span>
              </div>
            </div>
          </div>
        </main>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════ 表格样式双层Tab导航 ═══════════ */
.tab-table-row1 {
  display: grid;
  grid-template-columns: 3fr 4fr 2fr;
  border: 1px solid #D1D5DB;
  border-bottom: none;
  background: #F9FAFB;
}

.tab-primary {
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  color: #6B7280;
  cursor: default;
  border-right: 1px solid #D1D5DB;
  pointer-events: none;
  user-select: none;
}

.tab-primary:last-child {
  border-right: none;
}

.tab-primary--active {
  color: #1F2937;
  background: #FFFFFF;
  border-bottom: 2px solid #3B82F6;
}

.tab-table-row2 {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  border: 1px solid #D1D5DB;
  border-top: none;
  background: #FFFFFF;
}

.tab-secondary {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: center;
  color: #6B7280;
  cursor: pointer;
  border-right: 1px solid #E5E7EB;
  text-decoration: none;
  transition: background 0.2s, color 0.2s;
}

.tab-secondary:last-child {
  border-right: none;
}

.tab-secondary:hover {
  color: #374151;
  background: #F3F4F6;
}

.tab-secondary--active {
  color: #3B82F6;
  background: #EFF6FF;
  font-weight: 600;
}
</style>
