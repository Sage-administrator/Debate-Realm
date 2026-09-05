<script setup lang="ts">
// ════════════════════════════════════════════════════
// 独立赛事列表页 —— 个人用户赛事首页
// - 展示当前用户的所有独立赛事
// - 跳转创建赛事页面
// - 进入赛事详情或删除赛事
// ════════════════════════════════════════════════════
const toast = useToast()
const { list: getStandaloneMatches, delete: deleteStandaloneMatch } = useStandaloneMatches()

const matches = ref<any[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    matches.value = await getStandaloneMatches()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function handleDelete(id: string, name: string) {
  if (!confirm(`确定要删除「${name}」吗？`)) return
  try {
    await deleteStandaloneMatch(id)
    toast.add({ title: '已删除', color: 'success' })
    load()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '删除失败', color: 'error' })
  }
}

const statusLabel = (s: string) =>
  ({ pending: '待开始', running: '进行中', finished: '已完成' })[s] || s

onMounted(() => load())
</script>

<template>
  <!-- 最外层容器：页面背景 -->
  <div class="min-h-screen">
    <!-- 内容容器：居中布局 -->
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">我的独立赛事</h1>
        <UButton color="primary" to="/standalone/create">创建独立赛事</UButton>
      </div>

      <div v-if="loading" class="text-center py-12">
        <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin mx-auto" />
      </div>

      <div v-else class="glass-card p-6">
        <div v-if="matches.length === 0" class="text-center py-8 text-[var(--color-text-muted)]">
          暂无独立赛事，点击"创建独立赛事"开始
        </div>
        <div v-else class="divide-y divide-white/10">
          <div v-for="m in matches" :key="m.id" class="flex items-center justify-between py-3">
            <div>
              <div class="font-medium text-[var(--color-text-primary)]">{{ m.name }}</div>
              <div class="text-xs text-[var(--color-text-muted)] mt-0.5">
                <UBadge :label="statusLabel(m.status)" size="xs" variant="soft" />
                <span class="ml-2">{{ m.matchCount }} 场</span>
                <span v-if="m.scheduledAt" class="ml-2"
                  >· {{ new Date(m.scheduledAt).toLocaleDateString() }}</span
                >
              </div>
            </div>
            <div class="flex gap-2">
              <UButton color="neutral" variant="ghost" size="xs" :to="`/standalone/${m.id}`"
                >详情</UButton
              >
              <UButton color="error" variant="ghost" size="xs" @click="handleDelete(m.id, m.name)"
                >删除</UButton
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
