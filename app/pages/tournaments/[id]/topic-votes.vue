<script setup lang="ts">
// 辩题投票问卷管理页面
// 功能：
// - 投票问卷列表：查看赛事下所有辩题投票问卷，支持按状态/范围筛选，复制问卷链接、查看统计
// - 创建/编辑投票问卷：配置标题、说明、候选辩题（至少 2 个）、投票范围（赛事级/场次级）
//   允许的投票者类型、单选/多选、截止时间、是否展示实时结果、状态（草稿/进行中/已关闭）
// - 统计弹窗：查看每个辩题的票数、占比、按投票者类型分布及投票者列表
// - 开关问卷：快速切换投票问卷状态（进行中 ↔ 已关闭）
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const toast = useToast()
const { getMatches } = useTournament()
const {
  getTopicVotes, createTopicVote, updateTopicVote, deleteTopicVote, getVoteStats,
} = useTopicVote()

const tournament = inject<Ref<any>>('tournament')!
const tournamentId = computed(() => route.params.id as string)
const matches = ref<any[]>([])
const votes = ref<any[]>([])
const loading = ref(false)

// 当前激活的 Tab：list 投票问卷列表 / create 创建或编辑投票问卷
const activeTab = ref<'list' | 'create'>('list')

// 筛选条件：状态、范围（赛事级/场次级）
// 'all' 表示不筛选（reka-ui 不允许 SelectItem value 为空字符串，故用 'all' 占位）
const filterStatus = ref<string>('all')
const filterScope = ref<string>('all')

// 正在编辑的投票 ID（null 表示新建）
const editingId = ref<string | null>(null)
const saving = ref(false)
// 投票问卷表单数据
const formData = reactive({
  title: '',
  description: '',
  topics: [''],
  matchId: '' as string,
  allowedVoters: ['debater', 'judge', 'admin', 'public'] as string[],
  multipleChoice: false,
  deadline: '',
  showResults: true,
  status: 'open' as 'draft' | 'open' | 'closed',
})

// 统计弹窗状态
const statsModal = ref(false)
const statsData = ref<any>(null)
const loadingStats = ref(false)

// 删除确认弹窗状态
const deleteModalOpen = ref(false)
const deleteTarget = ref<any>(null)

// 投票者类型选项
const voterTypeOptions = [
  { label: '参赛辩手', value: 'debater' },
  { label: '评委', value: 'judge' },
  { label: '团队管理员', value: 'admin' },
  { label: '公开投票', value: 'public' },
]

// 投票状态元信息（标签文字与颜色）
const statusMeta: Record<string, { label: string; color: 'warning' | 'success' | 'neutral' }> = {
  draft: { label: '草稿', color: 'neutral' },
  open: { label: '进行中', color: 'success' },
  closed: { label: '已关闭', color: 'warning' },
}

// 投票者类型中文标签
const voterTypeLabel: Record<string, string> = {
  debater: '辩手',
  judge: '评委',
  admin: '管理员',
  public: '公开',
}

// 当前投票问卷的题型标签
const voteQuestionTypeLabel = computed(() => formData.multipleChoice ? '多选题' : '单选题')

// 加载页面数据：比赛场次 + 投票问卷列表
async function loadData() {
  loading.value = true
  try {
    matches.value = await getMatches(tournamentId.value)
    await loadVotes()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// 按筛选条件加载投票问卷列表
async function loadVotes() {
  try {
    const params: any = {}
    // 'all' 表示不筛选（reka-ui 不允许 SelectItem value 为空字符串，故用 'all' 占位）
    if (filterStatus.value && filterStatus.value !== 'all') params.status = filterStatus.value
    // 赛事级投票：matchId 为 none（即无关联场次）
    if (filterScope.value === 'tournament') params.matchId = 'none'
    votes.value = await getTopicVotes(tournamentId.value, params)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载投票问卷列表失败', color: 'error' })
  }
}

// 重置投票问卷表单为默认值
function resetForm() {
  editingId.value = null
  formData.title = ''
  formData.description = ''
  formData.topics = ['']
  formData.matchId = ''
  formData.allowedVoters = ['debater', 'judge', 'admin', 'public']
  formData.multipleChoice = false
  formData.deadline = ''
  formData.showResults = true
  formData.status = 'open'
}

// 添加一个候选辩题选项输入框
function addTopic() {
  formData.topics.push('')
}

// 删除指定索引的候选辩题选项（至少保留 1 个）
function removeTopic(idx: number) {
  if (formData.topics.length > 1) {
    formData.topics.splice(idx, 1)
  }
}

// 切换投票者类型勾选（至少保留 1 种类型）
function toggleVoterType(value: string) {
  const idx = formData.allowedVoters.indexOf(value)
  if (idx >= 0) {
    if (formData.allowedVoters.length > 1) {
      formData.allowedVoters.splice(idx, 1)
    }
  } else {
    formData.allowedVoters.push(value)
  }
}

// 进入编辑模式：将投票问卷数据回填到表单
function startEdit(vote: any) {
  editingId.value = vote.id
  formData.title = vote.title || ''
  formData.description = vote.description || ''
  formData.topics = (vote.topics && vote.topics.length > 0) ? [...vote.topics] : ['']
  formData.matchId = vote.matchId || ''
  // allowedVoters 在数据库中以 JSON 字符串存储，需解析
  try {
    const parsed = vote.allowedVoters ? JSON.parse(vote.allowedVoters) : ['debater', 'judge', 'admin', 'public']
    formData.allowedVoters = Array.isArray(parsed) ? parsed : ['debater', 'judge', 'admin', 'public']
  } catch {
    formData.allowedVoters = ['debater', 'judge', 'admin', 'public']
  }
  formData.multipleChoice = !!vote.multipleChoice
  // 截止时间转换为 datetime-local 所需格式
  formData.deadline = vote.deadline ? new Date(vote.deadline).toISOString().slice(0, 16) : ''
  formData.showResults = vote.showResults !== false
  formData.status = vote.status || 'open'
  activeTab.value = 'create'
}

// 提交表单：创建或更新投票问卷
async function handleSubmit() {
  // 校验：标题必填
  if (!formData.title.trim()) {
    toast.add({ title: '请填写问卷标题', color: 'warning' })
    return
  }
  // 校验：候选辩题去重后至少 2 个
  const topics = formData.topics.map(t => t.trim()).filter(Boolean)
  const uniqueTopics = [...new Set(topics)]
  if (uniqueTopics.length < 2) {
    toast.add({ title: '至少需要 2 个候选选项', color: 'warning' })
    return
  }
  // 校验：至少选择一种投票者类型
  if (formData.allowedVoters.length === 0) {
    toast.add({ title: '至少选择一种投票者类型', color: 'warning' })
    return
  }

  saving.value = true
  try {
    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      topics: uniqueTopics,
      matchId: formData.matchId || null,
      allowedVoters: formData.allowedVoters,
      multipleChoice: formData.multipleChoice,
      deadline: formData.deadline || null,
      showResults: formData.showResults,
      status: formData.status,
    }
    if (editingId.value) {
      await updateTopicVote(tournamentId.value, editingId.value, payload)
      toast.add({ title: '投票问卷已更新', color: 'success' })
    } else {
      await createTopicVote(tournamentId.value, payload)
      toast.add({ title: '投票问卷已创建', color: 'success' })
    }
    resetForm()
    activeTab.value = 'list'
    await loadVotes()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    saving.value = false
  }
}

// 取消编辑/创建，返回问卷列表
function cancelForm() {
  resetForm()
  activeTab.value = 'list'
}

// 确认删除投票问卷
async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await deleteTopicVote(tournamentId.value, deleteTarget.value.id)
    toast.add({ title: '投票问卷已删除', color: 'success' })
    deleteTarget.value = null
    deleteModalOpen.value = false
    await loadVotes()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '删除失败', color: 'error' })
  }
}

// 打开删除确认弹窗
function openDeleteModal(vote: any) {
  deleteTarget.value = vote
  deleteModalOpen.value = true
}

// 打开统计弹窗并加载统计数据
async function openStats(vote: any) {
  loadingStats.value = true
  statsModal.value = true
  try {
    statsData.value = await getVoteStats(tournamentId.value, vote.id)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载统计失败', color: 'error' })
    statsModal.value = false
  } finally {
    loadingStats.value = false
  }
}

// 切换投票问卷状态（进行中 ↔ 已关闭）
async function toggleStatus(vote: any) {
  const newStatus = vote.status === 'open' ? 'closed' : 'open'
  try {
    await updateTopicVote(tournamentId.value, vote.id, { status: newStatus })
    toast.add({ title: newStatus === 'open' ? '已开启投票问卷' : '已关闭投票问卷', color: 'success' })
    await loadVotes()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '操作失败', color: 'error' })
  }
}

// 生成投票问卷公开链接（客户端拼接完整 URL）
const voteLink = (voteId: string) => {
  if (import.meta.client) {
    return `${window.location.origin}/tournaments/${tournamentId.value}/topic-vote?vote=${voteId}`
  }
  return `/tournaments/${tournamentId.value}/topic-vote?vote=${voteId}`
}

// 复制投票问卷链接到剪贴板
function copyVoteLink(voteId: string) {
  if (import.meta.client) {
    navigator.clipboard.writeText(voteLink(voteId))
    toast.add({ title: '投票问卷链接已复制', color: 'success' })
  }
}

// 格式化日期为中文显示（24 小时制）
function formatDate(d: string | null | undefined): string {
  if (!d) return '未设置'
  return new Date(d).toLocaleString('zh-CN', { hour12: false })
}

// 解析投票者类型（数据库中以 JSON 字符串存储）
function parseVoterTypes(allowedVoters: string | null): string[] {
  if (!allowedVoters) return ['debater', 'judge', 'admin', 'public']
  try {
    const parsed = JSON.parse(allowedVoters)
    return Array.isArray(parsed) ? parsed : ['debater', 'judge', 'admin', 'public']
  } catch {
    return ['debater', 'judge', 'admin', 'public']
  }
}

// 投票问卷汇总统计：按状态统计数量并累加总票数
const summaryStats = computed(() => {
  let open = 0, closed = 0, draft = 0, totalVotes = 0
  for (const v of votes.value) {
    if (v.status === 'open') open++
    else if (v.status === 'closed') closed++
    else if (v.status === 'draft') draft++
    totalVotes += v.totalVotes || 0
  }
  return { total: votes.value.length, open, closed, draft, totalVotes }
})

onMounted(() => loadData())
</script>

<template>
  <template v-if="tournament">
  <div class="space-y-6">
    <div class="flex gap-2">
      <button
        v-for="tab in [
          { key: 'list', label: '投票问卷列表', icon: 'i-lucide-list' },
          { key: 'create', label: editingId ? '编辑投票问卷' : '创建投票问卷', icon: 'i-lucide-plus-circle' },
        ]"
        :key="tab.key"
        @click="() => { activeTab = tab.key as any; if (tab.key === 'create' && !editingId) resetForm() }"
        class="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        :class="activeTab === tab.key
          ? 'bg-blue-600 text-white'
          : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'"
      >
        <UIcon :name="tab.icon" class="w-4 h-4" /> {{ tab.label }}
      </button>
    </div>

    <template v-if="activeTab === 'list'">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">问卷总数</p>
              <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{{ summaryStats.total }}</p>
            </div>
            <UIcon name="i-lucide-vote" class="w-8 h-8 text-blue-400/60" />
          </div>
          <p class="text-xs text-[var(--color-text-muted)] mt-2">草稿 {{ summaryStats.draft }} · 进行 {{ summaryStats.open }} · 关闭 {{ summaryStats.closed }}</p>
        </div>
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">进行中</p>
              <p class="text-2xl font-bold text-green-400 mt-1">{{ summaryStats.open }}</p>
            </div>
            <UIcon name="i-lucide-circle-dot" class="w-8 h-8 text-green-400/60" />
          </div>
          <p class="text-xs text-[var(--color-text-muted)] mt-2">接受提交中</p>
        </div>
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">已关闭</p>
              <p class="text-2xl font-bold text-amber-400 mt-1">{{ summaryStats.closed }}</p>
            </div>
            <UIcon name="i-lucide-lock" class="w-8 h-8 text-amber-400/60" />
          </div>
          <p class="text-xs text-[var(--color-text-muted)] mt-2">已结束提交</p>
        </div>
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">累计票数</p>
              <p class="text-2xl font-bold text-indigo-400 mt-1">{{ summaryStats.totalVotes }}</p>
            </div>
            <UIcon name="i-lucide-chart-bar" class="w-8 h-8 text-indigo-400/60" />
          </div>
          <p class="text-xs text-[var(--color-text-muted)] mt-2">所有问卷合计</p>
        </div>
      </div>

      <UCard>
        <div class="flex flex-wrap items-center gap-3">
          <!-- 筛选下拉框为客户端组件，SSR 渲染会与水合结果不一致 -->
          <!-- 用 ClientOnly 包裹并提供 fallback 骨架占位，避免 hydration mismatch -->
          <ClientOnly>
            <USelect
              v-model="filterStatus"
              @update:model-value="loadVotes"
              :items="[
                { label: '全部状态', value: 'all' },
                { label: '草稿', value: 'draft' },
                { label: '进行中', value: 'open' },
                { label: '已关闭', value: 'closed' },
              ]"
              class="w-32"
              :ui="{ base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]' }"
            />
            <template #fallback>
              <div class="w-32 h-9 rounded-lg bg-[var(--color-bg-secondary)]"></div>
            </template>
          </ClientOnly>
          <ClientOnly>
            <USelect
              v-model="filterScope"
              @update:model-value="loadVotes"
              :items="[
                { label: '全部范围', value: 'all' },
                { label: '赛事级', value: 'tournament' },
                { label: '场次级', value: 'match' },
              ]"
              class="w-32"
              :ui="{ base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]' }"
            />
            <template #fallback>
              <div class="w-32 h-9 rounded-lg bg-[var(--color-bg-secondary)]"></div>
            </template>
          </ClientOnly>
          <div class="flex-1" />
          <UButton
            color="primary"
            icon="i-lucide-plus"
            @click="resetForm(); activeTab = 'create'"
          >
            创建投票问卷
          </UButton>
        </div>
      </UCard>

      <div v-if="votes.length === 0" class="glass-card p-12 text-center">
        <UIcon name="i-lucide-inbox" class="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
        <p class="text-[var(--color-text-secondary)]">暂无投票问卷</p>
        <p class="text-xs text-[var(--color-text-muted)] mt-1">点击“创建投票问卷”开始</p>
      </div>

      <div v-else class="space-y-3">
        <UCard v-for="vote in votes" :key="vote.id">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base font-semibold text-[var(--color-text-primary)]">{{ vote.title }}</h3>
                <UBadge :color="statusMeta[vote.status]?.color || 'neutral'" size="xs" variant="soft">
                  {{ statusMeta[vote.status]?.label || vote.status }}
                </UBadge>
                <!-- ponytail: UBadge color 枚举不含 blue/purple/cyan，用自定义 class 保持视觉差异 -->
                <UBadge v-if="vote.matchId" size="xs" variant="soft" class="bg-blue-500/20 text-blue-400">
                  场次级
                </UBadge>
                <UBadge v-else size="xs" variant="soft" class="bg-purple-500/20 text-purple-400">
                  赛事级
                </UBadge>
                <UBadge v-if="vote.multipleChoice" size="xs" variant="soft" class="bg-cyan-500/20 text-cyan-400">
                  多选
                </UBadge>
              </div>
              <p v-if="vote.description" class="text-sm text-[var(--color-text-secondary)] mt-1.5 line-clamp-2">{{ vote.description }}</p>

              <div class="mt-2.5 flex flex-wrap gap-1.5">
                <span
                  v-for="(t, i) in vote.topics.slice(0, 4)"
                  :key="i"
                  class="px-2 py-0.5 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)]"
                >
                  {{ t.length > 20 ? t.slice(0, 20) + '...' : t }}
                </span>
                <span v-if="vote.topics.length > 4" class="px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                  +{{ vote.topics.length - 4 }} 个
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-users" class="w-3 h-3" />
                  {{ parseVoterTypes(vote.allowedVoters).map(t => voterTypeLabel[t] || t).join(' / ') }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-lucide-chart-no-axes-column" class="w-3 h-3" />
                  {{ vote.totalVotes }} 票
                </span>
                <span v-if="vote.deadline" class="flex items-center gap-1">
                  <UIcon name="i-lucide-clock" class="w-3 h-3" />
                  截止 {{ formatDate(vote.deadline) }}
                </span>
              </div>
            </div>

            <div class="flex flex-col gap-1.5 shrink-0">
              <UButton size="xs" variant="outline" icon="i-lucide-bar-chart-3" @click="openStats(vote)">
                统计
              </UButton>
              <UButton size="xs" variant="outline" icon="i-lucide-link" @click="copyVoteLink(vote.id)">
                链接
              </UButton>
              <UButton size="xs" variant="outline" icon="i-lucide-pencil" @click="startEdit(vote)">
                编辑
              </UButton>
              <UButton
                size="xs"
                :variant="vote.status === 'open' ? 'soft' : 'outline'"
                :color="vote.status === 'open' ? 'warning' : 'success'"
                :icon="vote.status === 'open' ? 'i-lucide-pause' : 'i-lucide-play'"
                @click="toggleStatus(vote)"
              >
                {{ vote.status === 'open' ? '关闭' : '开启' }}
              </UButton>
              <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="openDeleteModal(vote)">
                删除
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </template>

    <template v-else-if="activeTab === 'create'">
      <!-- ═══ 投票问卷编辑器：与 FormDesigner 统一的深色三栏 SaaS 布局 ═══ -->
      <div class="fd-container flex flex-col h-[760px] rounded-xl overflow-hidden border border-[var(--color-border)] bg-[#0f1320]/60 backdrop-blur-md">

        <!-- ═══ 顶部导航栏 ═══ -->
        <header class="fd-header flex items-center justify-between h-12 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
          <!-- 左：Logo + 步骤条 -->
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1.5 text-indigo-400">
              <UIcon name="i-lucide-vote" class="w-4 h-4" />
              <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ editingId ? '编辑投票问卷' : '创建投票问卷' }}</span>
            </div>
            <!-- 步骤条 -->
            <nav class="flex items-center gap-3 text-xs">
              <span class="flex items-center gap-1 text-indigo-400">
                <span class="w-1 h-1 rounded-full bg-indigo-400"></span>
                编辑
              </span>
              <span class="text-[var(--color-border-muted)]">/</span>
              <span class="text-[var(--color-text-muted)]">分享</span>
              <span class="text-[var(--color-border-muted)]">/</span>
              <span class="text-[var(--color-text-muted)]">统计</span>
            </nav>
          </div>
          <!-- 右：操作按钮 -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-3 py-1 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              @click="cancelForm"
            >取消</button>
            <button
              type="button"
              class="px-3 py-1 text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded transition-colors flex items-center gap-1"
              :disabled="saving"
              @click="handleSubmit"
            >
              <UIcon v-if="saving" name="i-lucide-loader" class="w-3 h-3 animate-spin" />
              <UIcon v-else name="i-lucide-save" class="w-3 h-3" />
              {{ editingId ? '保存修改' : '创建' }}
            </button>
          </div>
        </header>

        <!-- ═══ 主体：水平三栏布局 ═══ -->
        <div class="fd-body flex flex-1 min-h-0">

          <!-- ═══ 左侧：题型选择面板（200px） ═══ -->
          <aside class="fd-left w-[200px] shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-3">
            <p class="px-4 mb-1 text-[11px] text-[var(--color-text-muted)]">题型库</p>
            <button
              type="button"
              class="w-full flex items-center gap-2 h-9 pl-4 pr-3 text-left text-sm transition-colors border-l-[3px]"
              :class="!formData.multipleChoice
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-400'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border-transparent'"
              @click="() => { formData.multipleChoice = false }"
            >
              <UIcon name="i-lucide-circle-dot" class="w-4 h-4 shrink-0" />
              <span>单选题</span>
            </button>
            <button
              type="button"
              class="w-full flex items-center gap-2 h-9 pl-4 pr-3 text-left text-sm transition-colors border-l-[3px]"
              :class="formData.multipleChoice
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-400'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border-transparent'"
              @click="() => { formData.multipleChoice = true }"
            >
              <UIcon name="i-lucide-check-square" class="w-4 h-4 shrink-0" />
              <span>多选题</span>
            </button>

            <p class="px-4 mt-4 mb-1 text-[11px] text-[var(--color-text-muted)]">说明</p>
            <p class="px-4 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
              投票问卷以辩题选择题为核心；报名问卷使用完整表单设计器。两者统一归入问卷系统管理。
            </p>
          </aside>

          <!-- ═══ 中央：画布区 ═══ -->
          <main class="fd-canvas flex-1 min-w-0 overflow-y-auto p-6 md:p-8 bg-[var(--color-bg-secondary)] relative">
            <!-- 装饰性几何图形 -->
            <div class="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none"></div>

            <!-- 问卷纸张容器 -->
            <div class="fd-paper mx-auto max-w-[800px] min-h-[600px] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg shadow-xl p-8 md:p-10 relative">

              <!-- 问卷大标题 -->
              <input
                v-model="formData.title"
                type="text"
                class="w-full text-center text-2xl font-bold text-[var(--color-text-primary)] bg-transparent border-none outline-none focus:bg-[var(--color-bg-tertiary)] rounded py-1 transition-colors"
                placeholder="投票问卷标题"
              />
              <!-- 引导语 -->
              <textarea
                v-model="formData.description"
                rows="2"
                class="w-full mt-3 mb-8 text-sm text-[var(--color-text-secondary)] bg-transparent border-none outline-none focus:bg-[var(--color-bg-tertiary)] rounded py-1 resize-none text-center leading-relaxed transition-colors"
                placeholder="向填写者说明此次投票问卷的规则、用途和截止要求"
              ></textarea>

              <!-- 题目卡片：辩题选择题 -->
              <div class="rounded-md border border-indigo-500/30 bg-indigo-500/[0.05] p-4">
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <p class="text-xs text-[var(--color-text-secondary)]">第 01 题 · {{ voteQuestionTypeLabel }}</p>
                    <h4 class="text-base font-semibold text-[var(--color-text-primary)] mt-1">
                      请选择你支持的辩题
                      <span class="text-red-400">*</span>
                    </h4>
                  </div>
                  <span class="text-[11px] px-2 py-1 rounded bg-indigo-500/15 text-indigo-300">{{ voteQuestionTypeLabel }}</span>
                </div>

                <!-- 候选辩题选项列表 -->
                <div class="space-y-2">
                  <div
                    v-for="(t, idx) in formData.topics"
                    :key="idx"
                    class="flex items-center gap-2 h-12 px-3 border border-[var(--color-border)] rounded bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border)] transition-colors group"
                  >
                    <UIcon
                      :name="formData.multipleChoice ? 'i-lucide-square' : 'i-lucide-circle'"
                      class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
                    />
                    <input
                      v-model="formData.topics[idx]"
                      type="text"
                      :placeholder="`请输入候选辩题 ${idx + 1}`"
                      class="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                    />
                    <button
                      v-if="formData.topics.length > 1"
                      type="button"
                      class="text-[var(--color-text-muted)] hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      @click="removeTopic(idx)"
                    >
                      <UIcon name="i-lucide-x" class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  class="mt-3 flex items-center gap-1 px-2 py-1 text-xs border border-indigo-500/30 rounded text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                  @click="addTopic"
                >
                  <UIcon name="i-lucide-plus" class="w-3 h-3" />添加候选选项
                </button>
                <p class="text-xs text-[var(--color-text-muted)] mt-2">至少需要 2 个候选选项，保存时会自动去除空项和重复项。</p>
              </div>

              <!-- 页码指示器 -->
              <div class="mt-8 pt-4 border-t border-[var(--color-border-muted)] text-center">
                <span class="text-[11px] text-[var(--color-text-muted)]">第 1 页 / 共 1 页 （1 题）</span>
              </div>
            </div>
          </main>

          <!-- ═══ 右侧：设置面板（280px） ═══ -->
          <aside class="fd-right w-[280px] shrink-0 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <div class="h-10 flex items-center px-4 border-b border-[var(--color-border)]">
              <span class="text-xs text-indigo-400 border-b-2 border-indigo-400 h-10 leading-10">问卷设置</span>
            </div>

            <div class="p-4 space-y-4">
              <!-- 问卷范围 -->
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">问卷范围</label>
                <ClientOnly>
                  <USelect
                    v-model="formData.matchId"
                    :items="[
                      { label: '赛事级（适用于整个赛事）', value: '' },
                      ...matches.map(m => ({
                        label: `场次：第${m.round}轮 ${m.teamA || '?'} vs ${m.teamB || '?'}`,
                        value: m.id
                      }))
                    ]"
                    class="w-full"
                    :ui="{ base: 'input-glass' }"
                  />
                  <template #fallback>
                    <div class="w-full h-9 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"></div>
                  </template>
                </ClientOnly>
              </div>

              <!-- 谁可以填写 -->
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">谁可以填写</label>
                <div class="space-y-1.5">
                  <label
                    v-for="opt in voterTypeOptions"
                    :key="opt.value"
                    class="flex items-center gap-2 h-8 text-xs text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-bg-tertiary)] rounded px-1 transition-colors"
                  >
                    <input
                      type="checkbox"
                      :value="opt.value"
                      :checked="formData.allowedVoters.includes(opt.value)"
                      class="rounded border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-indigo-500 focus:ring-indigo-500/30"
                      @change="toggleVoterType(opt.value)"
                    />
                    {{ opt.label }}
                  </label>
                </div>
                <p class="text-[11px] text-[var(--color-text-muted)] mt-1">勾选"公开投票"后未登录用户也可填写。</p>
              </div>

              <!-- 展示实时结果 -->
              <div class="flex items-center justify-between h-8">
                <div>
                  <p class="text-xs text-[var(--color-text-secondary)]">展示实时结果</p>
                  <p class="text-[11px] text-[var(--color-text-muted)]">填写者提交后可看到统计</p>
                </div>
                <span class="relative inline-block w-9 h-5">
                  <input type="checkbox" v-model="formData.showResults" class="sr-only peer" />
                  <span class="block w-9 h-5 bg-[var(--color-bg-tertiary)] rounded-full peer-checked:bg-indigo-500 transition-colors"></span>
                  <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></span>
                </span>
              </div>

              <!-- 截止时间 -->
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">截止时间（选填）</label>
                <input
                  v-model="formData.deadline"
                  type="datetime-local"
                  class="fd-input w-full"
                />
              </div>

              <!-- 问卷状态 -->
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">问卷状态</label>
                <ClientOnly>
                  <USelect
                    v-model="formData.status"
                    :items="[
                      { label: '草稿（不开放填写）', value: 'draft' },
                      { label: '进行中（开放填写）', value: 'open' },
                      { label: '已关闭', value: 'closed' },
                    ]"
                    class="w-full"
                    :ui="{ base: 'input-glass' }"
                  />
                  <template #fallback>
                    <div class="w-full h-9 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"></div>
                  </template>
                </ClientOnly>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </template>
  </div>

  <UModal v-model:open="statsModal">
    <template #content>
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">投票统计</h3>
          <button class="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" @click="() => { statsModal = false }">
            <UIcon name="i-lucide-x" class="w-5 h-5" />
          </button>
        </div>

        <div v-if="loadingStats" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader" class="w-6 h-6 animate-spin text-indigo-400" />
        </div>

        <template v-else-if="statsData">
          <div class="glass-card p-4 mb-4">
            <h4 class="text-base font-semibold text-[var(--color-text-primary)]">{{ statsData.title }}</h4>
            <p class="text-xs text-[var(--color-text-muted)] mt-1">
              共 {{ statsData.totalVotes }} 票 · {{ statsData.topics.length }} 个候选辩题
            </p>
          </div>

          <div class="space-y-3 mb-4">
            <div
              v-for="r in statsData.results"
              :key="r.index"
              class="glass-card p-3"
            >
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-sm text-[var(--color-text-primary)] flex-1">{{ r.topic }}</span>
                <span class="text-sm font-semibold text-indigo-400 ml-2">{{ r.count }} 票 ({{ r.percent }}%)</span>
              </div>
              <div class="h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all"
                  :style="{ width: r.percent + '%' }"
                />
              </div>
              <div v-if="Object.keys(r.byType).length > 0" class="flex flex-wrap gap-2 mt-1.5">
                <span
                  v-for="(count, type) in r.byType"
                  :key="type"
                  class="text-xs text-[var(--color-text-muted)]"
                >
                  {{ voterTypeLabel[type as string] || type }}: {{ count }}
                </span>
              </div>
            </div>
          </div>

          <div class="glass-card p-3 mb-4">
            <p class="text-xs text-[var(--color-text-muted)] mb-2">投票者类型分布</p>
            <div class="flex flex-wrap gap-3">
              <span
                v-for="(count, type) in statsData.byType"
                :key="type"
                class="text-xs px-2 py-1 bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-secondary)]"
              >
                {{ voterTypeLabel[type as string] || type }}: {{ count }}
              </span>
            </div>
          </div>

          <div v-if="statsData.voters && statsData.voters.length > 0">
            <p class="text-xs text-[var(--color-text-muted)] mb-2">投票者列表（{{ statsData.voters.length }}）</p>
            <div class="max-h-48 overflow-y-auto space-y-1.5">
              <div
                v-for="v in statsData.voters"
                :key="v.id"
                class="flex items-center justify-between text-xs bg-[var(--color-bg-secondary)] px-3 py-2 rounded"
              >
                <span class="text-[var(--color-text-primary)]">
                <!-- ponytail: UBadge color 枚举不含 blue/purple，用自定义 class -->
                  <UBadge size="xs" variant="soft" :class="v.voterType === 'public' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'" class="mr-2">
                    {{ voterTypeLabel[v.voterType] || v.voterType }}
                  </UBadge>
                  {{ v.voterName || '（匿名）' }}
                </span>
                <span class="text-[var(--color-text-muted)]">
                  选 {{ v.topicIndices.map((i: number) => i + 1).join(',') }} · {{ formatDate(v.createdAt) }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="deleteModalOpen">
    <template #content>
      <div class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-[var(--color-text-primary)]">确认删除投票</h3>
            <p class="text-xs text-[var(--color-text-muted)] mt-0.5">此操作不可撤销，所有投票记录将一并删除</p>
          </div>
        </div>
        <p class="text-sm text-[var(--color-text-secondary)] mb-5">
          确定要删除投票 <span class="font-semibold text-[var(--color-text-primary)]">"{{ deleteTarget?.title }}"</span> 吗？
        </p>
        <div class="flex items-center justify-end gap-3">
          <UButton color="neutral" variant="outline" @click="() => { deleteModalOpen = false; deleteTarget = null }">取消</UButton>
          <UButton color="error" @click="confirmDelete">确认删除</UButton>
        </div>
      </div>
    </template>
  </UModal>
  </template>
</template>

<style scoped>
/* ═══ 投票问卷编辑器深色主题样式（与 FormDesigner 统一） ═══ */

/* 通用输入框样式（右侧设置面板） */
/* ponytail: 使用 CSS 变量，支持深浅色模式 */
.fd-input {
  width: 100%;
  padding: 0.375rem 0.625rem;
  font-size: 0.8125rem;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
}
.fd-input::placeholder {
  color: var(--color-text-muted);
}
.fd-input:hover {
  border-color: var(--color-border-accented);
}
.fd-input:focus {
  border-color: var(--color-accent-primary);
  background: var(--color-bg-tertiary);
  box-shadow: 0 0 0 2px var(--color-accent-bg);
}

/* 滚动条细化 */
.fd-left::-webkit-scrollbar,
.fd-canvas::-webkit-scrollbar,
.fd-right::-webkit-scrollbar {
  width: 4px;
}
.fd-left::-webkit-scrollbar-thumb,
.fd-canvas::-webkit-scrollbar-thumb,
.fd-right::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}
.fd-left::-webkit-scrollbar-thumb:hover,
.fd-canvas::-webkit-scrollbar-thumb:hover,
.fd-right::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-accented);
}
</style>
