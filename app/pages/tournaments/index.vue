<!--
  公开赛事列表页（宣传入口）
  功能：
  - 无需登录即可浏览所有公开赛事
  - 支持搜索、筛选、分页
  - 点击进入赛事详情/报名页
-->
<script setup lang="ts">
definePageMeta({ layout: false })

const toast = useToast()
const router = useRouter()
const store = useAuthStore()

// 「创建赛事」按钮：已登录跳转创建页，未登录先去登录
const createTo = computed(() => (store.isAuthenticated ? '/tournaments/create' : '/login'))

// ── 数据状态 ──
const tournaments = ref<any[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)
const totalPages = ref(0)

// ── 搜索与筛选 ──
const keyword = ref('')
const statusFilter = ref('all')
const searchInput = ref('')

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
  pending: 'bg-green-500/20 text-green-600 dark:text-green-400',
  ongoing: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
  finished: 'bg-gray-500/20 text-gray-400',
  cancelled: 'bg-red-500/20 text-red-600 dark:text-red-400',
}

// ── 加载赛事列表 ──
async function loadTournaments() {
  loading.value = true
  try {
    const params: any = {
      page: page.value,
      pageSize: pageSize.value,
    }
    if (keyword.value) params.keyword = keyword.value
    if (statusFilter.value && statusFilter.value !== 'all') params.status = statusFilter.value

    const res: any = await $fetch('/api/tournaments/public.list', {
      query: params,
    })

    if (res.success) {
      tournaments.value = res.data.list
      total.value = res.data.pagination.total
      totalPages.value = res.data.pagination.totalPages
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ── 搜索 ──
function handleSearch() {
  keyword.value = searchInput.value.trim()
  page.value = 1
  loadTournaments()
}

// ── 状态筛选 ──
function handleStatusChange(val: string) {
  statusFilter.value = val
  page.value = 1
  loadTournaments()
}

// ── 分页 ──
function goPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  loadTournaments()
}

// ── 格式化日期 ──
function formatDate(d: any) {
  if (!d) return '待定'
  const date = new Date(d)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ── 截断描述 ──
function truncate(text: string, len: number) {
  if (!text) return ''
  if (text.length <= len) return text
  return text.slice(0, len) + '...'
}

// ── 跳转详情 ──
function goDetail(id: string) {
  navigateTo(`/tournaments/${id}/public`)
}

// ── 初始化 ──
onMounted(() => {
  loadTournaments()
})
</script>

<template>
  <div class="min-h-screen bg-[var(--color-bg-primary)]">
    <!-- ═══════════ 顶部导航 ═══════════ -->
    <PublicHeader>
      <template #actions>
        <NuxtLink
          :to="createTo"
          class="text-sm px-5 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] flex items-center gap-2 transition-all"
        >
          <UIcon name="i-lucide-plus-circle" class="w-4 h-4" />
          <span>创建赛事</span>
        </NuxtLink>
      </template>
    </PublicHeader>

    <!-- ═══════════ Hero 区域 ═══════════ -->
    <section class="py-16 sm:py-24 text-center">
      <div class="max-w-4xl mx-auto px-4">
        <div
          class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6"
        >
          <UIcon name="i-lucide-sparkles" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span class="text-sm font-medium text-indigo-600">专业辩论赛管理平台</span>
        </div>
        <h1
          class="text-4xl sm:text-6xl font-bold text-[var(--color-text-primary)] mb-6 leading-tight"
        >
          发现精彩赛事
          <br />
          <span
            class="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
          >
            一键报名参与
          </span>
        </h1>
        <p class="text-lg text-[var(--color-text-secondary)] mb-8 max-w-2xl mx-auto">
          支持多种赛制自动生成赛程、专业计时系统、评委评分、实时数据统计，
          让辩论赛组织更简单、更专业。
        </p>
        <!-- 搜索框 -->
        <div class="max-w-2xl mx-auto">
          <div
            class="flex gap-3 bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl p-2 border border-[var(--color-border)]"
          >
            <div class="flex-1 flex items-center gap-3 px-4">
              <UIcon name="i-lucide-search" class="w-5 h-5 text-[var(--color-text-muted)]" />
              <input
                v-model="searchInput"
                type="text"
                placeholder="搜索赛事名称、关键词..."
                class="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-3"
                @keyup.enter="handleSearch"
              />
            </div>
            <button
              class="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-purple-700 transition-all"
              @click="handleSearch"
            >
              搜索
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════ 筛选与列表 ═══════════ -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      <!-- 筛选栏 -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div class="flex items-center gap-2">
          <span class="text-[var(--color-text-secondary)] text-sm">状态筛选：</span>
          <div class="flex gap-2">
            <button
              v-for="s in [
                { value: 'all', label: '全部' },
                { value: 'pending', label: '报名中' },
                { value: 'ongoing', label: '进行中' },
                { value: 'finished', label: '已结束' },
              ]"
              :key="s.value"
              :class="[
                'px-4 py-1.5 rounded-lg text-sm transition-all',
                statusFilter === s.value
                  ? 'bg-indigo-500 text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]',
              ]"
              @click="handleStatusChange(s.value)"
            >
              {{ s.label }}
            </button>
          </div>
        </div>
        <div class="text-sm text-[var(--color-text-muted)]">共 {{ total }} 场赛事</div>
      </div>

      <!-- 赛事卡片列表 -->
      <div v-if="loading" class="text-center py-20">
        <div
          class="inline-block animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"
        ></div>
        <p class="text-[var(--color-text-muted)] mt-4">加载中...</p>
      </div>

      <div v-else-if="tournaments.length === 0" class="text-center py-20">
        <UIcon
          name="i-lucide-calendar-off"
          class="w-16 h-16 text-[var(--color-border-muted)] mx-auto mb-4"
        />
        <p class="text-[var(--color-text-muted)]">暂无公开赛事</p>
        <p class="text-[var(--color-text-muted)] text-sm mt-2">尝试调整筛选条件或稍后再来查看</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="t in tournaments"
          :key="t.id"
          class="group bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-accent-primary)]/50 hover:bg-[var(--color-bg-tertiary)] transition-all cursor-pointer"
          @click="goDetail(t.id)"
        >
          <!-- 卡片顶部装饰条 -->
          <div class="h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>

          <div class="p-6">
            <!-- 状态标签 -->
            <div class="flex items-center justify-between mb-3">
              <span
                :class="[
                  'px-2.5 py-1 rounded-md text-xs font-medium',
                  statusColors[t.status] || 'bg-gray-500/20 text-gray-400',
                ]"
              >
                {{ statusLabels[t.status] || t.status }}
              </span>
              <span class="text-xs text-[var(--color-text-muted)]">{{
                formatLabels[t.format] || t.format
              }}</span>
            </div>

            <!-- 赛事名称 -->
            <h3
              class="text-lg font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-[var(--color-accent-primary)] transition-colors line-clamp-2"
            >
              {{ t.name }}
            </h3>

            <!-- 描述 -->
            <p class="text-sm text-[var(--color-text-muted)] mb-4 line-clamp-2 min-h-[2.5rem]">
              {{ truncate(t.description, 80) || '暂无赛事介绍' }}
            </p>

            <!-- 信息项 -->
            <div class="space-y-2 text-sm text-[var(--color-text-secondary)] mb-4">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-calendar" class="w-4 h-4 text-[var(--color-text-muted)]" />
                <span>{{ formatDate(t.scheduledAt) }}</span>
              </div>
              <div v-if="t.venue" class="flex items-center gap-2">
                <UIcon name="i-lucide-map-pin" class="w-4 h-4 text-[var(--color-text-muted)]" />
                <span class="truncate">{{ t.venue }}</span>
              </div>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-building" class="w-4 h-4 text-[var(--color-text-muted)]" />
                <span class="truncate">{{ t.organizer }}</span>
              </div>
            </div>

            <!-- 底部统计 -->
            <div
              class="flex items-center justify-between pt-4 border-t border-[var(--color-border)]"
            >
              <div class="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-users" class="w-3.5 h-3.5" />
                  {{ t.registrationCount }} 人报名
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-gavel" class="w-3.5 h-3.5" />
                  {{ t.judgeCount }} 评委
                </span>
              </div>
              <UIcon
                name="i-lucide-arrow-right"
                class="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent-primary)] group-hover:translate-x-1 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mt-12">
        <button
          class="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-all disabled:opacity-30"
          :disabled="page === 1"
          @click="goPage(page - 1)"
        >
          上一页
        </button>
        <div class="flex gap-1">
          <button
            v-for="p in Math.min(5, totalPages)"
            :key="p"
            :class="[
              'w-10 h-10 rounded-lg transition-all',
              page === p
                ? 'bg-indigo-500 text-white'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]',
            ]"
            @click="goPage(p)"
          >
            {{ p }}
          </button>
        </div>
        <button
          class="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-all disabled:opacity-30"
          :disabled="page === totalPages"
          @click="goPage(page + 1)"
        >
          下一页
        </button>
      </div>
    </section>

    <!-- ═══════════ 底部 Footer（与公开首页共用 PublicFooter）═══════════ -->
    <PublicFooter />
  </div>
</template>
