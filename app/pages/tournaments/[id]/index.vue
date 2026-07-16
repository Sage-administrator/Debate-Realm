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
    <div class="glass-card p-4">
      <h2 class="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
        <UIcon name="i-lucide-info" class="w-4 h-4 text-[var(--color-text-muted)]" />
        赛事概览
      </h2>

      <!-- 状态徽章 -->
      <div class="flex items-center gap-2 mb-3 pb-3 border-b border-[var(--color-border)]">
        <span class="text-xs text-[var(--color-text-muted)]">当前状态：</span>
        <UBadge :label="statusLabel(tournament.status)" :color="statusColor(tournament.status)" size="xs" variant="soft" />
        <span class="text-xs text-[var(--color-text-muted)]">·</span>
        <span class="text-xs text-[var(--color-text-muted)]">{{ formatLabel(tournament.format) }}</span>
        <span v-if="tournament.scheduledAt" class="text-xs text-[var(--color-text-muted)]">
          · {{ formatDateMonth(tournament.scheduledAt) }}
        </span>
      </div>

      <!-- 信息网格 -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <div class="bg-[var(--color-bg-secondary)] rounded p-2.5">
          <p class="text-[11px] text-[var(--color-text-muted)] mb-0.5">赛事名称</p>
          <p class="text-xs font-medium text-[var(--color-text-primary)] truncate">{{ tournament.name }}</p>
        </div>
        <div class="bg-[var(--color-bg-secondary)] rounded p-2.5">
          <p class="text-[11px] text-[var(--color-text-muted)] mb-0.5">赛制</p>
          <p class="text-xs font-medium text-[var(--color-text-primary)]">{{ formatLabel(tournament.format) }}</p>
        </div>
        <div class="bg-[var(--color-bg-secondary)] rounded p-2.5">
          <p class="text-[11px] text-[var(--color-text-muted)] mb-0.5">举办地点</p>
          <p class="text-xs font-medium text-[var(--color-text-primary)] truncate">{{ tournament.venue || '未设置' }}</p>
        </div>
        <div class="bg-[var(--color-bg-secondary)] rounded p-2.5">
          <p class="text-[11px] text-[var(--color-text-muted)] mb-0.5">参赛队伍数</p>
          <p class="text-xs font-medium text-[var(--color-text-primary)]">{{ tournament.teams?.length || 0 }} 支</p>
        </div>
        <div class="bg-[var(--color-bg-secondary)] rounded p-2.5">
          <p class="text-[11px] text-[var(--color-text-muted)] mb-0.5">评委人数</p>
          <p class="text-xs font-medium text-[var(--color-text-primary)]">{{ tournament.judges?.length || 0 }} 人</p>
        </div>
        <div class="bg-[var(--color-bg-secondary)] rounded p-2.5">
          <p class="text-[11px] text-[var(--color-text-muted)] mb-0.5">场次数</p>
          <p class="text-xs font-medium text-[var(--color-text-primary)]">{{ tournament.matches?.length || 0 }} 场</p>
        </div>
      </div>

      <!-- 扩展信息 -->
      <div v-if="extendedInfo.length" class="mt-3 pt-3 border-t border-[var(--color-border)]">
        <p class="text-[11px] text-[var(--color-text-muted)] mb-1.5">详细信息</p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="info in extendedInfo"
            :key="info"
            class="px-2 py-0.5 text-[11px] text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] rounded-full"
          >{{ info }}</span>
        </div>
      </div>
    </div>

    <!-- 队伍 & 评委列表 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- 参赛队伍 -->
      <div class="glass-card p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-users" class="w-4 h-4 text-[var(--color-text-muted)]" />
          参赛队伍
          <span class="text-xs font-normal text-[var(--color-text-muted)]">({{ tournament.teams?.length || 0 }})</span>
        </h3>
        <div v-if="!tournament.teams?.length" class="text-sm text-[var(--color-text-muted)] py-4 text-center">
          暂无参赛队伍
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="(t, i) in tournament.teams"
            :key="t.id"
            class="flex items-center gap-2 text-sm text-[var(--color-text-primary)] py-1.5 px-3 bg-[var(--color-bg-secondary)] rounded"
          >
            <span class="w-5 h-5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] text-xs flex items-center justify-center shrink-0">
              {{ Number(i) + 1 }}
            </span>
            {{ t.name }}
          </div>
        </div>
      </div>

      <!-- 评委 -->
      <div class="glass-card p-6">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-gavel" class="w-4 h-4 text-[var(--color-text-muted)]" />
          评委
          <span class="text-xs font-normal text-[var(--color-text-muted)]">({{ tournament.judges?.length || 0 }})</span>
        </h3>
        <div v-if="!tournament.judges?.length" class="text-sm text-[var(--color-text-muted)] py-4 text-center">
          暂无评委
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="(j, i) in tournament.judges"
            :key="j.id"
            class="flex items-center gap-2 text-sm text-[var(--color-text-primary)] py-1.5 px-3 bg-[var(--color-bg-secondary)] rounded"
          >
            <span class="w-5 h-5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] text-xs flex items-center justify-center shrink-0">
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
        class="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
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
