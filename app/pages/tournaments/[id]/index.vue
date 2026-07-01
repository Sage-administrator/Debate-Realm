<script setup lang="ts">
// 赛事概览页面
const route = useRoute()
const toast = useToast()
const { getTournament, deleteTournament } = useTournament()

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

// ── 删除赛事 ──
const deleting = ref(false)
async function handleDeleteTournament() {
  if (!confirm('确定要删除此赛事吗？此操作不可撤销。')) return
  deleting.value = true
  try {
    await deleteTournament(tournamentId.value)
    toast.add({ title: '赛事已删除', color: 'success' })
    tournament.value = null
    await navigateTo('/', { replace: true })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '删除失败', color: 'error' })
  } finally {
    deleting.value = false
  }
}

// ── 工具函数 ──
const statusLabel = (s: string) => ({ pending: '待开始', running: '进行中', finished: '已完成' }[s] || s)
const statusColor = (s: string): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' => {
  return ({ pending: 'neutral', running: 'primary', finished: 'success' } as Record<string, any>)[s] || 'neutral'
}
const formatLabel = (f: string) => f === 'knockout' ? '淘汰赛' : '循环赛'
const formatDateMonth = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${d.getMonth() + 1}`
}

// ── 解析 description 中的扩展信息 ──
const extendedInfo = computed(() => {
  const desc = tournament.value?.description || ''
  if (!desc.includes('；')) return []
  return desc.split('；').filter(Boolean)
})

onMounted(() => loadTournament())
</script>

<template>
  <div class="min-h-screen" style="background-color: #F5F7FA;">
    <div class="max-w-[1200px] mx-auto px-6">

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
          <div class="flex items-center gap-3">
            <button
              class="h-9 px-4 text-sm border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              离线版下载
            </button>
            <button
              class="h-9 px-4 text-sm rounded-md text-white transition-colors"
              style="background-color: #1F2937;"
              @click="navigateTo(`/tournaments/${tournamentId}/timer`)"
            >
              打开在线版计时器
            </button>
          </div>
        </header>

        <!-- ═══ 表格样式双层Tab导航 ═══ -->
        <div class="tab-table-row1">
          <span class="tab-primary tab-primary--active">基础配置</span>
          <span class="tab-primary">视听设计</span>
          <span class="tab-primary">进阶功能</span>
        </div>
        <div class="tab-table-row2">
          <NuxtLink :to="`/tournaments/${tournamentId}`" class="tab-secondary tab-secondary--active">概览</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/info`" class="tab-secondary">比赛信息</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/timing`" class="tab-secondary">计时器环节</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/skin`" class="tab-secondary">背景</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/details`" class="tab-secondary">界面</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/audio`" class="tab-secondary">提示音</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/teams`" class="tab-secondary">队徽</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/schedule`" class="tab-secondary">赛程</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/offline`" class="tab-secondary">离线版</NuxtLink>
        </div>

        <!-- ═══ 概览内容 ═══ -->
        <main class="py-6 space-y-6">
          <!-- 基本信息卡片 -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UIcon name="i-lucide-info" class="w-4 h-4 text-gray-400" />
              赛事概览
            </h2>

            <!-- 状态徽章 -->
            <div class="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
              <span class="text-sm text-gray-500">当前状态：</span>
              <UBadge :label="statusLabel(tournament.status)" :color="statusColor(tournament.status)" size="sm" variant="soft" />
              <span class="text-sm text-gray-400">·</span>
              <span class="text-sm text-gray-500">{{ formatLabel(tournament.format) }}</span>
              <span v-if="tournament.scheduledAt" class="text-sm text-gray-400">
                · {{ formatDateMonth(tournament.scheduledAt) }}
              </span>
            </div>

            <!-- 信息网格 -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div class="bg-gray-50 rounded-md p-4">
                <p class="text-xs text-gray-400 mb-1">赛事名称</p>
                <p class="text-sm font-medium text-gray-800">{{ tournament.name }}</p>
              </div>
              <div class="bg-gray-50 rounded-md p-4">
                <p class="text-xs text-gray-400 mb-1">赛制</p>
                <p class="text-sm font-medium text-gray-800">{{ formatLabel(tournament.format) }}</p>
              </div>
              <div class="bg-gray-50 rounded-md p-4">
                <p class="text-xs text-gray-400 mb-1">举办地点</p>
                <p class="text-sm font-medium text-gray-800">{{ tournament.venue || '未设置' }}</p>
              </div>
              <div class="bg-gray-50 rounded-md p-4">
                <p class="text-xs text-gray-400 mb-1">参赛队伍数</p>
                <p class="text-sm font-medium text-gray-800">{{ tournament.teams?.length || 0 }} 支</p>
              </div>
              <div class="bg-gray-50 rounded-md p-4">
                <p class="text-xs text-gray-400 mb-1">评委人数</p>
                <p class="text-sm font-medium text-gray-800">{{ tournament.judges?.length || 0 }} 人</p>
              </div>
              <div class="bg-gray-50 rounded-md p-4">
                <p class="text-xs text-gray-400 mb-1">场次数</p>
                <p class="text-sm font-medium text-gray-800">{{ tournament.matches?.length || 0 }} 场</p>
              </div>
            </div>

            <!-- 扩展信息 -->
            <div v-if="extendedInfo.length" class="mt-5 pt-4 border-t border-gray-100">
              <p class="text-xs text-gray-400 mb-2">详细信息</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="info in extendedInfo"
                  :key="info"
                  class="px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded-full"
                >{{ info }}</span>
              </div>
            </div>
          </div>

          <!-- 队伍 & 评委列表 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- 参赛队伍 -->
            <div class="bg-white rounded-lg shadow-sm p-6">
              <h3 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <UIcon name="i-lucide-users" class="w-4 h-4 text-gray-400" />
                参赛队伍
                <span class="text-xs font-normal text-gray-400">({{ tournament.teams?.length || 0 }})</span>
              </h3>
              <div v-if="!tournament.teams?.length" class="text-sm text-gray-400 py-4 text-center">
                暂无参赛队伍
              </div>
              <div v-else class="space-y-1.5">
                <div
                  v-for="(t, i) in tournament.teams"
                  :key="t.id"
                  class="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 bg-gray-50 rounded"
                >
                  <span class="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center shrink-0">
                    {{ Number(i) + 1 }}
                  </span>
                  {{ t.name }}
                </div>
              </div>
            </div>

            <!-- 评委 -->
            <div class="bg-white rounded-lg shadow-sm p-6">
              <h3 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <UIcon name="i-lucide-gavel" class="w-4 h-4 text-gray-400" />
                评委
                <span class="text-xs font-normal text-gray-400">({{ tournament.judges?.length || 0 }})</span>
              </h3>
              <div v-if="!tournament.judges?.length" class="text-sm text-gray-400 py-4 text-center">
                暂无评委
              </div>
              <div v-else class="space-y-1.5">
                <div
                  v-for="(j, i) in tournament.judges"
                  :key="j.id"
                  class="flex items-center gap-2 text-sm text-gray-700 py-1.5 px-3 bg-gray-50 rounded"
                >
                  <span class="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center shrink-0">
                    {{ Number(i) + 1 }}
                  </span>
                  {{ j.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- 操作区 -->
          <div class="flex items-center gap-3 pt-2">
            <NuxtLink
              :to="`/tournaments/${tournamentId}/info`"
              class="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded text-gray-600 bg-white hover:bg-gray-50 transition-colors"
            >
              <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />
              编辑赛事信息
            </NuxtLink>
            <button
              class="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-200 rounded text-red-500 bg-white hover:bg-red-50 transition-colors"
              :disabled="deleting"
              @click="handleDeleteTournament"
            >
              <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
              {{ deleting ? '删除中...' : '删除赛事' }}
            </button>
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
  padding: 0.5rem 0.75rem;       /* 与其他页面一致：8px 12px */
  font-size: 0.8125rem;          /* 与其他页面一致：13px */
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
