<!--
  赛事管理页（登录用户后台）
  - 套用 default.vue 侧边栏布局（有仪表盘侧边栏），区别于公开落地页 /tournaments
  - 面向 admin/subaccount：展示本团队赛事列表，支持搜索、状态筛选、进入详情、删除
  - 数据源：useTournament().getTournaments(teamId)，与仪表盘 /home 一致
-->
<script setup lang="ts">
const store = useAuthStore()
const toast = useToast()
const { getTournaments, deleteTournament } = useTournament()

// ── 数据状态 ──
const keyword = ref('')
const statusFilter = ref('all')

// ── 赛制中文名映射 ──
const formatLabels: Record<string, string> = {
  single_elimination: '单败淘汰赛',
  double_elimination: '双败淘汰赛',
  round_robin: '循环赛',
  page_playoff: '佩寄制',
  swiss: '瑞士制',
  group_knockout: '小组+淘汰赛',
  manual: '自定义',
  knockout: '淘汰赛',
}

// ── 状态中文名映射（兼容后端 running/ongoing 两种写法）──
const statusLabels: Record<string, string> = {
  pending: '待开始',
  ongoing: '进行中',
  running: '进行中',
  finished: '已完成',
  cancelled: '已取消',
}

const statusColors: Record<string, string> = {
  pending: 'neutral',
  ongoing: 'primary',
  running: 'primary',
  finished: 'success',
  cancelled: 'error',
}

// ── 团队 ID ──
const teamId = computed(() => store.user?.team?.id ?? '')

// ── SSR 数据预取：使用 useAsyncData 在服务端预加载赛事列表 ──
const { data: tournaments, pending: loading, refresh: loadTournaments, error } = useAsyncData(
  'tournaments-manage',
  () => {
    if (!teamId.value) return []
    return getTournaments(teamId.value)
  },
  { watch: [teamId], default: () => [] },
)

// Error handling for SSR/client fetch
watch(error, (err) => {
  if (err) {
    toast.add({ title: (err as any)?.statusMessage || '加载失败', color: 'error' })
  }
})

// ── 客户端搜索 + 状态筛选（数据量小，无需服务端分页）──
const filtered = computed(() => {
  const list = tournaments.value ?? []
  const kw = keyword.value.trim().toLowerCase()
  return list.filter((t) => {
    const matchKw = !kw || t.name?.toLowerCase().includes(kw)
    const matchStatus = statusFilter.value === 'all' || t.status === statusFilter.value
    return matchKw && matchStatus
  })
})

// ── 删除赛事 ──
async function handleDelete(t: any) {
  if (!confirm(`确定删除赛事「${t.name}」吗？此操作不可撤销。`)) return
  try {
    await deleteTournament(t.id)
    toast.add({ title: '赛事已删除', color: 'success' })
    loadTournaments()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '删除失败', color: 'error' })
  }
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="min-h-screen">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- ── 页头 ── -->
      <div class="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">赛事管理</h1>
          <p class="text-[var(--color-text-secondary)] mt-1 text-sm">管理本团队的所有赛事</p>
        </div>
        <UButton
          icon="i-lucide-plus-circle"
          color="primary"
          to="/tournaments/create"
        >
          创建赛事
        </UButton>
      </div>

      <!-- ── 无团队引导（individual 等）── -->
      <div v-if="!teamId" class="glass-card p-10 text-center">
        <UIcon name="i-lucide-info" class="w-10 h-10 mx-auto mb-3 text-[var(--color-text-muted)]" />
        <p class="text-[var(--color-text-secondary)]">当前账号未归属团队，无法管理团队赛事。</p>
      </div>

      <template v-else>
        <!-- ── 工具栏：搜索 + 状态筛选 ── -->
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div class="flex items-center gap-2 flex-1 min-w-[220px] max-w-md glass-card px-4 py-2">
            <UIcon name="i-lucide-search" class="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
            <input
              v-model="keyword"
              type="text"
              placeholder="搜索赛事名称..."
              class="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none text-sm"
            />
          </div>
          <div class="flex items-center gap-2">
            <button
              v-for="s in [
                { value: 'all', label: '全部' },
                { value: 'pending', label: '待开始' },
                { value: 'ongoing', label: '进行中' },
                { value: 'finished', label: '已完成' },
              ]"
              :key="s.value"
              :class="[
                'px-3 py-1.5 rounded-lg text-sm transition-all',
                statusFilter === s.value
                  ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]',
              ]"
              @click="statusFilter = s.value"
            >
              {{ s.label }}
            </button>
          </div>
        </div>

        <!-- ── 列表 ── -->
        <div class="glass-card p-6">
          <div v-if="loading" class="text-center py-12">
            <UIcon name="i-lucide-loader" class="w-6 h-6 animate-spin mx-auto text-indigo-600 dark:text-indigo-400" />
            <p class="text-[var(--color-text-muted)] mt-3 text-sm">加载中...</p>
          </div>

          <div v-else-if="filtered.length === 0" class="text-center py-12 text-[var(--color-text-muted)]">
            <UIcon name="i-lucide-inbox" class="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p v-if="tournaments.length === 0">暂无赛事，点击右上角「创建赛事」开始</p>
            <p v-else>没有符合条件的赛事</p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm table-glass">
              <thead>
                <tr>
                  <th class="text-left">赛事名称</th>
                  <th class="text-left">赛制</th>
                  <th class="text-left">状态</th>
                  <th class="text-left">场次数</th>
                  <th class="text-left">创建时间</th>
                  <th class="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="t in filtered"
                  :key="t.id"
                  class="cursor-pointer"
                  @click="navigateTo(`/tournaments/${t.id}/info`)"
                >
                  <td class="font-medium text-[var(--color-text-primary)]">{{ t.name }}</td>
                  <td>{{ formatLabels[t.format] || t.format }}</td>
                  <td>
                    <UBadge
                      :label="statusLabels[t.status] || t.status"
                      :color="(statusColors[t.status] || 'neutral') as any"
                      size="xs"
                      variant="soft"
                    />
                  </td>
                  <td>{{ t.matchCount ?? 0 }}</td>
                  <td class="text-[var(--color-text-secondary)]">{{ fmtDate(t.createdAt) }}</td>
                  <td class="text-right" @click.stop>
                    <div class="flex items-center justify-end gap-1">
                      <UButton
                        icon="i-lucide-arrow-right"
                        color="primary"
                        variant="ghost"
                        size="xs"
                        :to="`/tournaments/${t.id}/info`"
                      >
                        进入
                      </UButton>
                      <UButton
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="xs"
                        @click="handleDelete(t)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>
