<script setup lang="ts">
// 独立赛事概览页面
definePageMeta({ layout: 'standalone' })

const route = useRoute()
const toast = useToast()
const { delete: deleteStandaloneMatch } = useStandaloneMatches()

// 从布局层注入的赛事数据
const standaloneMatch = inject<Ref<any>>('standaloneMatch')!
const matchId = computed(() => route.params.id as string)

// ── 删除赛事 ──
const deleting = ref(false)
async function handleDeleteMatch() {
  if (!confirm('确定要删除此赛事吗？此操作不可撤销。')) return
  deleting.value = true
  try {
    await deleteStandaloneMatch(matchId.value)
    toast.add({ title: '赛事已删除', color: 'success' })
    standaloneMatch.value = null
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

// ── 解析 description 中的扩展信息 ──
const extendedInfo = computed(() => {
  const desc = standaloneMatch.value?.description || ''
  if (!desc.includes('；')) return []
  return desc.split('；').filter(Boolean)
})
</script>

<template>
  <!-- ═══ 概览内容（赛事数据由布局提供） ═══ -->
  <div v-if="standaloneMatch" class="space-y-6">
    <!-- 基本信息卡片 -->
    <div class="glass-card p-6">
      <h2 class="text-base font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
        <UIcon name="i-lucide-info" class="w-4 h-4 text-[var(--color-text-muted)]" />
        赛事概览
      </h2>

      <!-- 状态徽章 -->
      <div class="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--color-border)]">
        <span class="text-sm text-[var(--color-text-muted)]">当前状态：</span>
        <UBadge :label="statusLabel(standaloneMatch.status)" :color="statusColor(standaloneMatch.status)" size="sm" variant="soft" />
        <span v-if="standaloneMatch.scheduledAt" class="text-sm text-[var(--color-text-muted)]">
          · {{ new Date(standaloneMatch.scheduledAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }) }}
        </span>
      </div>

      <!-- 信息网格 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="bg-[var(--color-bg-secondary)] rounded-md p-4">
          <p class="text-xs text-[var(--color-text-muted)] mb-1">赛事名称</p>
          <p class="text-sm font-medium text-[var(--color-text-primary)]">{{ standaloneMatch.name }}</p>
        </div>
        <div class="bg-[var(--color-bg-secondary)] rounded-md p-4">
          <p class="text-xs text-[var(--color-text-muted)] mb-1">举办地点</p>
          <p class="text-sm font-medium text-[var(--color-text-primary)]">{{ standaloneMatch.venue || '未设置' }}</p>
        </div>
        <div class="bg-[var(--color-bg-secondary)] rounded-md p-4">
          <p class="text-xs text-[var(--color-text-muted)] mb-1">比赛时间</p>
          <p class="text-sm font-medium text-[var(--color-text-primary)]">
            {{ standaloneMatch.scheduledAt ? new Date(standaloneMatch.scheduledAt).toLocaleString('zh-CN') : '未设置' }}
          </p>
        </div>
        <div class="bg-[var(--color-bg-secondary)] rounded-md p-4">
          <p class="text-xs text-[var(--color-text-muted)] mb-1">当前状态</p>
          <UBadge :label="statusLabel(standaloneMatch.status)" :color="statusColor(standaloneMatch.status)" size="xs" variant="soft" />
        </div>
        <div class="bg-[var(--color-bg-secondary)] rounded-md p-4">
          <p class="text-xs text-[var(--color-text-muted)] mb-1">创建时间</p>
          <p class="text-sm font-medium text-[var(--color-text-primary)]">{{ new Date(standaloneMatch.createdAt).toLocaleDateString('zh-CN') }}</p>
        </div>
      </div>

      <!-- 扩展信息 -->
      <div v-if="extendedInfo.length" class="mt-5 pt-4 border-t border-[var(--color-border)]">
        <p class="text-xs text-[var(--color-text-muted)] mb-2">详细信息</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="info in extendedInfo"
            :key="info"
            class="px-3 py-1 text-xs text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] rounded-full"
          >{{ info }}</span>
        </div>
      </div>
    </div>

    <!-- 操作区 -->
    <div class="flex items-center gap-3 pt-2">
      <NuxtLink
        :to="`/standalone/${matchId}/info`"
        class="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />
        编辑赛事信息
      </NuxtLink>
      <button
        class="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-500/30 rounded text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
        :disabled="deleting"
        @click="handleDeleteMatch"
      >
        <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
        {{ deleting ? '删除中...' : '删除赛事' }}
      </button>
    </div>
  </div>
</template>