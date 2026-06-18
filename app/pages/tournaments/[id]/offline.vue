<script setup lang="ts">
// 离线版页面
const route = useRoute()
const toast = useToast()
const { getTournament } = useTournament()

const tournament = ref<any>(null)
const loading = ref(true)
const tournamentId = computed(() => route.params.id as string)

// ── 数据加载 ──
async function loadTournament() {
  loading.value = true
  try {
    tournament.value = await getTournament(tournamentId.value)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ── 导出离线包 ──
function exportOffline() {
  toast.add({ title: '正在生成离线版...', color: 'primary' })
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
          <NuxtLink :to="`/tournaments/${tournamentId}/schedule`" class="tab-secondary">赛程</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/offline`" class="tab-secondary tab-secondary--active">离线版</NuxtLink>
        </div>

        <!-- ═══ 离线版内容 ═══ -->
        <main class="py-6 space-y-6">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UIcon name="i-lucide-download" class="w-4 h-4 text-gray-400" /> 离线版导出
            </h2>

            <div class="ui-panel space-y-4">
              <p class="text-sm text-gray-600">
                导出当前赛事的完整离线版本，包含所有配置、样式和资源文件，可在无网络环境下独立运行。
              </p>

              <div class="flex items-center gap-2 pt-2">
                <button
                  @click="exportOffline"
                  class="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <UIcon name="i-lucide-download" class="w-4 h-4" />
                  导出离线版
                </button>
              </div>

              <div class="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                导出的离线版将包含：计时器核心逻辑、所有已配置的视觉样式、背景图片、音效资源和赛事数据。
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
