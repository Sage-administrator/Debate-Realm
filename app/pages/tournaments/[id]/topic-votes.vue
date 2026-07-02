<script setup lang="ts">
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

const activeTab = ref<'list' | 'create'>('list')

const filterStatus = ref<string>('')
const filterScope = ref<string>('')

const editingId = ref<string | null>(null)
const saving = ref(false)
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

const statsModal = ref(false)
const statsData = ref<any>(null)
const loadingStats = ref(false)

const deleteModalOpen = ref(false)
const deleteTarget = ref<any>(null)

const voterTypeOptions = [
  { label: '参赛辩手', value: 'debater' },
  { label: '评委', value: 'judge' },
  { label: '团队管理员', value: 'admin' },
  { label: '公开投票', value: 'public' },
]

const statusMeta: Record<string, { label: string; color: 'warning' | 'success' | 'neutral' }> = {
  draft: { label: '草稿', color: 'neutral' },
  open: { label: '进行中', color: 'success' },
  closed: { label: '已关闭', color: 'warning' },
}

const voterTypeLabel: Record<string, string> = {
  debater: '辩手',
  judge: '评委',
  admin: '管理员',
  public: '公开',
}

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

async function loadVotes() {
  try {
    const params: any = {}
    if (filterStatus.value) params.status = filterStatus.value
    if (filterScope.value === 'tournament') params.matchId = 'none'
    votes.value = await getTopicVotes(tournamentId.value, params)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载投票列表失败', color: 'error' })
  }
}

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

function addTopic() {
  formData.topics.push('')
}

function removeTopic(idx: number) {
  if (formData.topics.length > 1) {
    formData.topics.splice(idx, 1)
  }
}

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

function startEdit(vote: any) {
  editingId.value = vote.id
  formData.title = vote.title || ''
  formData.description = vote.description || ''
  formData.topics = (vote.topics && vote.topics.length > 0) ? [...vote.topics] : ['']
  formData.matchId = vote.matchId || ''
  try {
    const parsed = vote.allowedVoters ? JSON.parse(vote.allowedVoters) : ['debater', 'judge', 'admin', 'public']
    formData.allowedVoters = Array.isArray(parsed) ? parsed : ['debater', 'judge', 'admin', 'public']
  } catch {
    formData.allowedVoters = ['debater', 'judge', 'admin', 'public']
  }
  formData.multipleChoice = !!vote.multipleChoice
  formData.deadline = vote.deadline ? new Date(vote.deadline).toISOString().slice(0, 16) : ''
  formData.showResults = vote.showResults !== false
  formData.status = vote.status || 'open'
  activeTab.value = 'create'
}

async function handleSubmit() {
  if (!formData.title.trim()) {
    toast.add({ title: '请填写投票标题', color: 'warning' })
    return
  }
  const topics = formData.topics.map(t => t.trim()).filter(Boolean)
  const uniqueTopics = [...new Set(topics)]
  if (uniqueTopics.length < 2) {
    toast.add({ title: '至少需要 2 个候选辩题', color: 'warning' })
    return
  }
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
      toast.add({ title: '投票已更新', color: 'success' })
    } else {
      await createTopicVote(tournamentId.value, payload)
      toast.add({ title: '投票已创建', color: 'success' })
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

function cancelForm() {
  resetForm()
  activeTab.value = 'list'
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await deleteTopicVote(tournamentId.value, deleteTarget.value.id)
    toast.add({ title: '投票已删除', color: 'success' })
    deleteTarget.value = null
    deleteModalOpen.value = false
    await loadVotes()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '删除失败', color: 'error' })
  }
}

function openDeleteModal(vote: any) {
  deleteTarget.value = vote
  deleteModalOpen.value = true
}

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

async function toggleStatus(vote: any) {
  const newStatus = vote.status === 'open' ? 'closed' : 'open'
  try {
    await updateTopicVote(tournamentId.value, vote.id, { status: newStatus })
    toast.add({ title: newStatus === 'open' ? '已开启投票' : '已关闭投票', color: 'success' })
    await loadVotes()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '操作失败', color: 'error' })
  }
}

const voteLink = (voteId: string) => {
  if (import.meta.client) {
    return `${window.location.origin}/tournaments/${tournamentId.value}/topic-vote?vote=${voteId}`
  }
  return `/tournaments/${tournamentId.value}/topic-vote?vote=${voteId}`
}

function copyVoteLink(voteId: string) {
  if (import.meta.client) {
    navigator.clipboard.writeText(voteLink(voteId))
    toast.add({ title: '投票链接已复制', color: 'success' })
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '未设置'
  return new Date(d).toLocaleString('zh-CN', { hour12: false })
}

function parseVoterTypes(allowedVoters: string | null): string[] {
  if (!allowedVoters) return ['debater', 'judge', 'admin', 'public']
  try {
    const parsed = JSON.parse(allowedVoters)
    return Array.isArray(parsed) ? parsed : ['debater', 'judge', 'admin', 'public']
  } catch {
    return ['debater', 'judge', 'admin', 'public']
  }
}

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
          { key: 'list', label: '投票列表', icon: 'i-lucide-list' },
          { key: 'create', label: editingId ? '编辑投票' : '创建投票', icon: 'i-lucide-plus-circle' },
        ]"
        :key="tab.key"
        @click="activeTab = tab.key as any; if (tab.key === 'create' && !editingId) resetForm()"
        class="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        :class="activeTab === tab.key
          ? 'bg-blue-600 text-white'
          : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'"
      >
        <UIcon :name="tab.icon" class="w-4 h-4" /> {{ tab.label }}
      </button>
    </div>

    <template v-if="activeTab === 'list'">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-white/50">投票总数</p>
              <p class="text-2xl font-bold text-white mt-1">{{ summaryStats.total }}</p>
            </div>
            <UIcon name="i-lucide-vote" class="w-8 h-8 text-blue-400/60" />
          </div>
          <p class="text-xs text-white/40 mt-2">草稿 {{ summaryStats.draft }} · 进行 {{ summaryStats.open }} · 关闭 {{ summaryStats.closed }}</p>
        </div>
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-white/50">进行中</p>
              <p class="text-2xl font-bold text-green-400 mt-1">{{ summaryStats.open }}</p>
            </div>
            <UIcon name="i-lucide-circle-dot" class="w-8 h-8 text-green-400/60" />
          </div>
          <p class="text-xs text-white/40 mt-2">接受投票中</p>
        </div>
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-white/50">已关闭</p>
              <p class="text-2xl font-bold text-amber-400 mt-1">{{ summaryStats.closed }}</p>
            </div>
            <UIcon name="i-lucide-lock" class="w-8 h-8 text-amber-400/60" />
          </div>
          <p class="text-xs text-white/40 mt-2">已结束投票</p>
        </div>
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-white/50">累计票数</p>
              <p class="text-2xl font-bold text-indigo-400 mt-1">{{ summaryStats.totalVotes }}</p>
            </div>
            <UIcon name="i-lucide-chart-bar" class="w-8 h-8 text-indigo-400/60" />
          </div>
          <p class="text-xs text-white/40 mt-2">所有投票合计</p>
        </div>
      </div>

      <UCard>
        <div class="flex flex-wrap items-center gap-3">
          <select
            v-model="filterStatus"
            @change="loadVotes"
            class="px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="open">进行中</option>
            <option value="closed">已关闭</option>
          </select>
          <select
            v-model="filterScope"
            @change="loadVotes"
            class="px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
          >
            <option value="">全部范围</option>
            <option value="tournament">赛事级</option>
            <option value="match">场次级</option>
          </select>
          <div class="flex-1" />
          <UButton
            color="primary"
            icon="i-lucide-plus"
            @click="resetForm(); activeTab = 'create'"
          >
            创建投票
          </UButton>
        </div>
      </UCard>

      <div v-if="votes.length === 0" class="glass-card p-12 text-center">
        <UIcon name="i-lucide-inbox" class="w-12 h-12 text-white/30 mx-auto mb-3" />
        <p class="text-white/60">暂无辩题投票</p>
        <p class="text-xs text-white/40 mt-1">点击"创建投票"开始</p>
      </div>

      <div v-else class="space-y-3">
        <UCard v-for="vote in votes" :key="vote.id">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base font-semibold text-white">{{ vote.title }}</h3>
                <UBadge :color="statusMeta[vote.status]?.color || 'neutral'" size="xs" variant="soft">
                  {{ statusMeta[vote.status]?.label || vote.status }}
                </UBadge>
                <UBadge v-if="vote.matchId" color="blue" size="xs" variant="soft">
                  场次级
                </UBadge>
                <UBadge v-else color="purple" size="xs" variant="soft">
                  赛事级
                </UBadge>
                <UBadge v-if="vote.multipleChoice" color="cyan" size="xs" variant="soft">
                  多选
                </UBadge>
              </div>
              <p v-if="vote.description" class="text-sm text-white/60 mt-1.5 line-clamp-2">{{ vote.description }}</p>

              <div class="mt-2.5 flex flex-wrap gap-1.5">
                <span
                  v-for="(t, i) in vote.topics.slice(0, 4)"
                  :key="i"
                  class="px-2 py-0.5 text-xs bg-white/5 border border-white/10 rounded text-white/70"
                >
                  {{ t.length > 20 ? t.slice(0, 20) + '...' : t }}
                </span>
                <span v-if="vote.topics.length > 4" class="px-2 py-0.5 text-xs text-white/40">
                  +{{ vote.topics.length - 4 }} 个
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-3 mt-3 text-xs text-white/40">
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
      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-white flex items-center gap-2">
            <UIcon name="i-lucide-plus-circle" class="w-4 h-4 text-white/40" />
            {{ editingId ? '编辑投票' : '创建辩题投票' }}
          </h2>
        </template>

        <div class="space-y-5">
          <div>
            <label class="block text-xs text-white/40 mb-1">投票标题 <span class="text-red-500">*</span></label>
            <UInput
              v-model="formData.title"
              placeholder="如：第一轮辩题投票"
              class="w-full"
              :ui="{ base: 'input-glass' }"
            />
          </div>

          <div>
            <label class="block text-xs text-white/40 mb-1">投票说明（选填）</label>
            <UTextarea
              v-model="formData.description"
              :rows="2"
              placeholder="向投票者说明此次投票的规则与意义"
              class="w-full"
              :ui="{ base: 'input-glass' }"
            />
          </div>

          <div>
            <label class="block text-xs text-white/40 mb-1">投票范围</label>
            <select
              v-model="formData.matchId"
              class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
            >
              <option value="">赛事级（适用于整个赛事）</option>
              <option v-for="m in matches" :key="m.id" :value="m.id">
                场次：第{{ m.round }}轮 {{ m.teamA || '?' }} vs {{ m.teamB || '?' }}
              </option>
            </select>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs text-white/40">候选辩题 <span class="text-red-500">*</span>（至少 2 个）</label>
              <button
                class="flex items-center gap-1 px-2 py-1 text-xs border border-indigo-500/30 rounded text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                @click="addTopic"
              >
                <UIcon name="i-lucide-plus" class="w-3 h-3" />添加辩题
              </button>
            </div>
            <div class="space-y-2">
              <div
                v-for="(t, idx) in formData.topics"
                :key="idx"
                class="flex items-center gap-2"
              >
                <span class="text-xs text-white/40 w-6">{{ idx + 1 }}.</span>
                <UInput
                  v-model="formData.topics[idx]"
                  :placeholder="`请输入候选辩题 ${idx + 1}`"
                  class="flex-1"
                  :ui="{ base: 'input-glass' }"
                />
                <button
                  v-if="formData.topics.length > 1"
                  class="text-red-400 hover:text-red-300 p-1"
                  @click="removeTopic(idx)"
                >
                  <UIcon name="i-lucide-x" class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs text-white/40 mb-2">允许的投票者类型</label>
            <div class="flex flex-wrap gap-3">
              <label
                v-for="opt in voterTypeOptions"
                :key="opt.value"
                class="flex items-center gap-2 text-sm text-white/80 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="opt.value"
                  :checked="formData.allowedVoters.includes(opt.value)"
                  class="rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/30"
                  @change="toggleVoterType(opt.value)"
                />
                {{ opt.label }}
              </label>
            </div>
            <p class="text-xs text-white/40 mt-1">勾选"公开投票"后未登录用户也可参与</p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <label class="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
              <input
                type="checkbox"
                v-model="formData.multipleChoice"
                class="rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/30"
              />
              允许多选
            </label>
            <label class="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
              <input
                type="checkbox"
                v-model="formData.showResults"
                class="rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/30"
              />
              向投票者展示实时结果
            </label>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-white/40 mb-1">截止时间（选填）</label>
              <UInput
                v-model="formData.deadline"
                type="datetime-local"
                class="w-full"
                :ui="{ base: 'input-glass' }"
              />
            </div>
            <div>
              <label class="block text-xs text-white/40 mb-1">投票状态</label>
              <select
                v-model="formData.status"
                class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
              >
                <option value="draft">草稿（不开放投票）</option>
                <option value="open">进行中（开放投票）</option>
                <option value="closed">已关闭</option>
              </select>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-white/10">
          <UButton color="neutral" variant="outline" @click="cancelForm">取消</UButton>
          <UButton color="primary" :loading="saving" @click="handleSubmit">
            <UIcon name="i-lucide-save" class="w-4 h-4 mr-1" />
            {{ editingId ? '保存修改' : '创建投票' }}
          </UButton>
        </div>
      </UCard>
    </template>
  </div>

  <UModal v-model:open="statsModal">
    <template #content>
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">投票统计</h3>
          <button class="text-white/40 hover:text-white/60" @click="statsModal = false">
            <UIcon name="i-lucide-x" class="w-5 h-5" />
          </button>
        </div>

        <div v-if="loadingStats" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader" class="w-6 h-6 animate-spin text-indigo-400" />
        </div>

        <template v-else-if="statsData">
          <div class="glass-card p-4 mb-4">
            <h4 class="text-base font-semibold text-white">{{ statsData.title }}</h4>
            <p class="text-xs text-white/40 mt-1">
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
                <span class="text-sm text-white/90 flex-1">{{ r.topic }}</span>
                <span class="text-sm font-semibold text-indigo-400 ml-2">{{ r.count }} 票 ({{ r.percent }}%)</span>
              </div>
              <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all"
                  :style="{ width: r.percent + '%' }"
                />
              </div>
              <div v-if="Object.keys(r.byType).length > 0" class="flex flex-wrap gap-2 mt-1.5">
                <span
                  v-for="(count, type) in r.byType"
                  :key="type"
                  class="text-xs text-white/40"
                >
                  {{ voterTypeLabel[type as string] || type }}: {{ count }}
                </span>
              </div>
            </div>
          </div>

          <div class="glass-card p-3 mb-4">
            <p class="text-xs text-white/40 mb-2">投票者类型分布</p>
            <div class="flex flex-wrap gap-3">
              <span
                v-for="(count, type) in statsData.byType"
                :key="type"
                class="text-xs px-2 py-1 bg-white/5 rounded text-white/70"
              >
                {{ voterTypeLabel[type as string] || type }}: {{ count }}
              </span>
            </div>
          </div>

          <div v-if="statsData.voters && statsData.voters.length > 0">
            <p class="text-xs text-white/40 mb-2">投票者列表（{{ statsData.voters.length }}）</p>
            <div class="max-h-48 overflow-y-auto space-y-1.5">
              <div
                v-for="v in statsData.voters"
                :key="v.id"
                class="flex items-center justify-between text-xs bg-white/5 px-3 py-2 rounded"
              >
                <span class="text-white/80">
                  <UBadge :color="v.voterType === 'public' ? 'purple' : 'blue'" size="xs" variant="soft" class="mr-2">
                    {{ voterTypeLabel[v.voterType] || v.voterType }}
                  </UBadge>
                  {{ v.voterName || '（匿名）' }}
                </span>
                <span class="text-white/40">
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
            <h3 class="text-base font-semibold text-white">确认删除投票</h3>
            <p class="text-xs text-white/50 mt-0.5">此操作不可撤销，所有投票记录将一并删除</p>
          </div>
        </div>
        <p class="text-sm text-white/70 mb-5">
          确定要删除投票 <span class="font-semibold text-white">"{{ deleteTarget?.title }}"</span> 吗？
        </p>
        <div class="flex items-center justify-end gap-3">
          <UButton color="neutral" variant="outline" @click="deleteModalOpen = false; deleteTarget = null">取消</UButton>
          <UButton color="error" @click="confirmDelete">确认删除</UButton>
        </div>
      </div>
    </template>
  </UModal>
  </template>
</template>

<style scoped>
</style>
