<script setup lang="ts">
// 赛事概览页面
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const toast = useToast()
const { deleteTournament } = useTournament()

// 从布局层注入的赛事数据（避免重复加载）
const tournament = inject<Ref<any>>('tournament')!
const tournamentId = computed(() => route.params.id as string)

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
</script>

<template>
  <!-- ═══ 概览内容（赛事数据由布局提供，数据加载前不渲染，避免 SSR 报错） ═══ -->
  <div v-if="tournament" class="space-y-6">
    <!-- 基本信息卡片 -->
    <div class="glass-card p-6">
      <h2 class="text-base font-semibold text-white mb-4 flex items-center gap-2">
        <UIcon name="i-lucide-info" class="w-4 h-4 text-white/40" />
        赛事概览
      </h2>

      <!-- 状态徽章 -->
      <div class="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
        <span class="text-sm text-white/50">当前状态：</span>
        <UBadge :label="statusLabel(tournament.status)" :color="statusColor(tournament.status)" size="sm" variant="soft" />
        <span class="text-sm text-white/40">·</span>
        <span class="text-sm text-white/50">{{ formatLabel(tournament.format) }}</span>
        <span v-if="tournament.scheduledAt" class="text-sm text-white/40">
          · {{ formatDateMonth(tournament.scheduledAt) }}
        </span>
      </div>

      <!-- 信息网格 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="bg-white/5 rounded-md p-4">
          <p class="text-xs text-white/40 mb-1">赛事名称</p>
          <p class="text-sm font-medium text-white/90">{{ tournament.name }}</p>
        </div>
        <div class="bg-white/5 rounded-md p-4">
          <p class="text-xs text-white/40 mb-1">赛制</p>
          <p class="text-sm font-medium text-white/90">{{ formatLabel(tournament.format) }}</p>
        </div>
        <div class="bg-white/5 rounded-md p-4">
          <p class="text-xs text-white/40 mb-1">举办地点</p>
          <p class="text-sm font-medium text-white/90">{{ tournament.venue || '未设置' }}</p>
        </div>
        <div class="bg-white/5 rounded-md p-4">
          <p class="text-xs text-white/40 mb-1">参赛队伍数</p>
          <p class="text-sm font-medium text-white/90">{{ tournament.teams?.length || 0 }} 支</p>
        </div>
        <div class="bg-white/5 rounded-md p-4">
          <p class="text-xs text-white/40 mb-1">评委人数</p>
          <p class="text-sm font-medium text-white/90">{{ tournament.judges?.length || 0 }} 人</p>
        </div>
        <div class="bg-white/5 rounded-md p-4">
          <p class="text-xs text-white/40 mb-1">场次数</p>
          <p class="text-sm font-medium text-white/90">{{ tournament.matches?.length || 0 }} 场</p>
        </div>
      </div>

      <!-- 扩展信息 -->
      <div v-if="extendedInfo.length" class="mt-5 pt-4 border-t border-white/10">
        <p class="text-xs text-white/40 mb-2">详细信息</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="info in extendedInfo"
            :key="info"
            class="px-3 py-1 text-xs text-white/80 bg-white/10 rounded-full"
          >{{ info }}</span>
        </div>
      </div>
    </div>

    <!-- 队伍 & 评委列表 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- 参赛队伍 -->
      <div class="glass-card p-6">
        <h3 class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-users" class="w-4 h-4 text-white/40" />
          参赛队伍
          <span class="text-xs font-normal text-white/40">({{ tournament.teams?.length || 0 }})</span>
        </h3>
        <div v-if="!tournament.teams?.length" class="text-sm text-white/40 py-4 text-center">
          暂无参赛队伍
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="(t, i) in tournament.teams"
            :key="t.id"
            class="flex items-center gap-2 text-sm text-white/80 py-1.5 px-3 bg-white/5 rounded"
          >
            <span class="w-5 h-5 rounded-full bg-white/10 text-white/50 text-xs flex items-center justify-center shrink-0">
              {{ Number(i) + 1 }}
            </span>
            {{ t.name }}
          </div>
        </div>
      </div>

      <!-- 评委 -->
      <div class="glass-card p-6">
        <h3 class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-gavel" class="w-4 h-4 text-white/40" />
          评委
          <span class="text-xs font-normal text-white/40">({{ tournament.judges?.length || 0 }})</span>
        </h3>
        <div v-if="!tournament.judges?.length" class="text-sm text-white/40 py-4 text-center">
          暂无评委
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="(j, i) in tournament.judges"
            :key="j.id"
            class="flex items-center gap-2 text-sm text-white/80 py-1.5 px-3 bg-white/5 rounded"
          >
            <span class="w-5 h-5 rounded-full bg-white/10 text-white/50 text-xs flex items-center justify-center shrink-0">
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
        class="flex items-center gap-1 px-3 py-1.5 text-sm border border-white/10 rounded text-white/70 hover:bg-white/5 transition-colors"
      >
        <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />
        编辑赛事信息
      </NuxtLink>
      <button
        class="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-500/30 rounded text-red-400 hover:bg-red-500/10 transition-colors"
        :disabled="deleting"
        @click="handleDeleteTournament"
      >
        <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
        {{ deleting ? '删除中...' : '删除赛事' }}
      </button>
    </div>
  </div>
</template>
