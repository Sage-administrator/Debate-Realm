<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'

// 使用 tournament 布局，继承三阶段导航卡片
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const tournamentId = computed(() => route.params.id as string)
const authStore = useAuthStore()
const toast = useToast()

// ═══════════════════════════════════════════
// 评分问卷（match_score）相关状态
// ═══════════════════════════════════════════
const tournamentDetail = ref<any>(null)
const scoreTemplate = ref<any>(null) // 模板摘要（含 id / settings / questionCount）
const scoreStats = ref<any>(null) // match-score-stats 聚合结果

// 受众标签映射（用于模板中索引访问，避免 TS 索引类型错误）
const audienceLabels: Record<string, string> = {
  public: '公开',
  loggedIn: '登录用户',
  judges: '评委',
}

// ═══════════════════════════════════════════
// 评分问卷设计（Tab 内联，仿报名管理页「报名问卷设计」Tab）
// ═══════════════════════════════════════════
const activeTab = ref<'stats' | 'design'>('stats')

const savingDesign = ref(false)
const designLoaded = ref(false) // 设计字段是否已载入（切回 Tab 不重复拉取）
const designerAudience = ref<'public' | 'loggedIn' | 'judges'>('loggedIn')
const designerAllowMultiple = ref(false)
const designerFields = ref<any[]>([]) // FormDesigner 的 v-model
// 整卷设置（标题 / 说明 / 提交文案 / 对齐等），与 FormDesigner 双向同步
const designerFormSettings = reactive({
  title: '比赛评分问卷',
  description: '请为刚刚结束的比赛评分，您的反馈将帮助我们改进。',
  submitText: '提交评分',
  thankYouText: '感谢您的评分！您可重新提交以更新结果。',
  align: 'center',
  showNumber: true,
})
const audienceOptions = [
  { label: '登录用户', value: 'loggedIn' },
  { label: '公开（无需登录）', value: 'public' },
  { label: '仅评委', value: 'judges' },
]

// 将 API 题目定义映射为 FormDesigner 字段
function mapQuestionsToFields(questions: any[]): any[] {
  return (questions || []).map((q) => ({
    id: q.id,
    fieldName: q.title,
    fieldKey: q.fieldKey,
    fieldType: q.questionType,
    fieldOptions:
      typeof q.options === 'string' ? q.options : q.options ? JSON.stringify(q.options) : null,
    required: q.required,
    sortOrder: q.sortOrder ?? 0,
    appliesTo: 'both',
    placeholder: '',
    description: q.meta?.description || '',
    width: 'full',
    systemField: false,
    meta: q.meta && typeof q.meta === 'object' ? q.meta : null,
  }))
}

// 将 FormDesigner 字段映射回 API 题目定义
function mapFieldsToQuestions(fields: any[]) {
  return fields.map((f, i) => ({
    fieldKey: f.fieldKey,
    title: f.fieldName,
    questionType: f.fieldType,
    options: f.fieldOptions || null,
    required: !!f.required,
    sortOrder: i,
    meta: f.meta || null,
    description: f.description || '',
  }))
}

// 载入已有问卷到设计器字段（仅在有模板且尚未载入时；切换 Tab 触发）
async function loadDesignIntoFields() {
  if (designLoaded.value) return
  if (scoreTemplate.value?.id) {
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId.value}/questionnaires/${scoreTemplate.value.id}`,
        {
          headers: { Authorization: `Bearer ${authStore.token}` },
        },
      )
      const detail = await res.json()
      const settings = detail.settings || {}
      designerFormSettings.title = detail.title || '比赛评分问卷'
      designerFormSettings.description = detail.description || ''
      designerFormSettings.submitText = settings.submitText || '提交评分'
      designerFormSettings.thankYouText =
        settings.thankYouText || '感谢您的评分！您可重新提交以更新结果。'
      designerFormSettings.align = settings.align || 'center'
      designerFormSettings.showNumber = settings.showNumber !== false
      designerAudience.value = settings.audience || 'loggedIn'
      designerAllowMultiple.value = !!settings.allowMultiple
      designerFields.value = mapQuestionsToFields(detail.questions || [])
    } catch {
      toast.add({ title: '加载问卷详情失败', color: 'error' })
      return
    }
  } else {
    designerFormSettings.title = '比赛评分问卷'
    designerFormSettings.description = '请为刚刚结束的比赛评分，您的反馈将帮助我们改进。'
    designerFormSettings.submitText = '提交评分'
    designerFormSettings.thankYouText = '感谢您的评分！您可重新提交以更新结果。'
    designerFormSettings.align = 'center'
    designerFormSettings.showNumber = true
    designerAudience.value = 'loggedIn'
    designerAllowMultiple.value = false
    designerFields.value = [
      {
        id: '',
        fieldName: '请为本次比赛打分',
        fieldKey: `field_scale_${Date.now().toString(36)}`,
        fieldType: 'scale',
        fieldOptions: null,
        required: true,
        sortOrder: 0,
        appliesTo: 'both',
        placeholder: '',
        description: '',
        width: 'full',
        systemField: false,
        meta: { min: 1, max: 5, step: 1, leftLabel: '差', rightLabel: '好' },
      },
    ]
  }
  designLoaded.value = true
}

// 保存评分问卷设计
async function saveDesign() {
  if (designerFields.value.length === 0) {
    toast.add({ title: '请至少添加一道题目', color: 'warning' })
    return
  }
  savingDesign.value = true
  try {
    const res = await fetch(`/api/tournaments/${tournamentId.value}/questionnaires`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify({
        sourceType: 'match_score',
        sourceId: tournamentId.value,
        title: designerFormSettings.title.trim() || '比赛评分问卷',
        description: designerFormSettings.description,
        status: 'open',
        settings: {
          audience: designerAudience.value,
          allowMultiple: designerAllowMultiple.value,
          submitText: designerFormSettings.submitText,
          thankYouText: designerFormSettings.thankYouText,
          align: designerFormSettings.align,
          showNumber: designerFormSettings.showNumber,
        },
        questions: mapFieldsToQuestions(designerFields.value),
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.message || '保存失败')
    toast.add({ title: '评分问卷已保存', color: 'success' })
    designLoaded.value = false
    await loadScoreData()
    activeTab.value = 'stats'
  } catch (e: any) {
    toast.add({ title: e?.message || '保存失败', color: 'error' })
  } finally {
    savingDesign.value = false
  }
}

// 切换到「评分问卷」Tab 时载入问卷（仅一次）；mount 时若默认在 design 也尝试
watch(activeTab, (t) => {
  if (t === 'design') loadDesignIntoFields()
})

// 组织者（写权限）：system_admin 或 该赛事 team.adminId 对应用户
const canDesign = computed(() => {
  const role = authStore.user?.role
  if (role === 'system_admin') return true
  // UserInfo 中主键字段是 id 而非 userId
  if (role === 'admin') return tournamentDetail.value?.team?.adminId === authStore.user?.id
  return false
})

// 每场提交数（来自评分统计），用于「去评分 (n)」按钮
const submissionCountByMatch = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  for (const m of scoreStats.value?.matches || []) {
    map[m.matchId] = m.submissionCount
  }
  return map
})

// 根据 matchId 查比赛（取队名用于统计展示）
function matchOf(id: string): any {
  return (matches.value || []).find((m: any) => m.id === id) || null
}

// ═══════════════════════════════════════════
// 数据状态
// ═══════════════════════════════════════════
const stats = ref<any>(null)
const matches = ref<any[]>([])
const loading = ref(true)
const loadingMatches = ref(true)

// 搜索与筛选状态
const searchQuery = ref('')
const statusFilter = ref('all') // all | finished | ongoing | pending

// ═══════════════════════════════════════════
// 数据加载
// ═══════════════════════════════════════════

// 获取赛果统计数据
async function loadStats() {
  try {
    const res = await fetch(`/api/tournaments/${tournamentId.value}/standings`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    const data = await res.json()
    if (data.success) {
      stats.value = data.data
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

// 获取比赛场次列表
async function loadMatches() {
  try {
    loadingMatches.value = true
    const res = await fetch(`/api/tournaments/${tournamentId.value}/matches`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    const data = await res.json()
    // 防御：接口在鉴权失败时返回错误对象而非数组，直接赋值会导致后续
    // matches.value.filter(...) 抛 TypeError，进而整页渲染崩溃（内容区空白）
    matches.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('加载比赛列表失败:', error)
    matches.value = []
  } finally {
    loadingMatches.value = false
  }
}

onMounted(() => {
  loading.value = true
  Promise.all([loadStats(), loadMatches(), loadTournamentDetail(), loadScoreData()]).finally(() => {
    loading.value = false
  })
})

// 获取赛事详情（含 team.adminId，用于 canDesign 判定）
// ⚠️ 必须带 Authorization：getUserFromEventWithSession 实际只认 Bearer 令牌，
// 不读 cookie。缺失令牌会 401，导致 tournamentDetail 为空，admin 拥有者看不到入口。
async function loadTournamentDetail() {
  try {
    const res = await fetch(`/api/tournaments/${tournamentId.value}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (res.ok) tournamentDetail.value = await res.json()
  } catch {
    tournamentDetail.value = null
  }
}

// 加载评分问卷模板与统计
async function loadScoreData() {
  try {
    const [listRes, statsRes] = await Promise.all([
      fetch(`/api/tournaments/${tournamentId.value}/questionnaires?sourceType=match_score`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      }),
      fetch(`/api/tournaments/${tournamentId.value}/match-score-stats`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      }),
    ])
    const list = await listRes.json()
    scoreTemplate.value = Array.isArray(list) ? list[0] || null : null
    const stats = await statsRes.json()
    scoreStats.value = stats?.success ? stats : null
  } catch (error) {
    console.error('加载评分问卷数据失败:', error)
  }
}

// ═══════════════════════════════════════════
// 计算属性：筛选后的比赛列表
// ═══════════════════════════════════════════
const filteredMatches = computed(() => {
  let result = matches.value

  // 状态筛选
  if (statusFilter.value !== 'all') {
    result = result.filter((m) => m.status === statusFilter.value)
  }

  // 搜索筛选（按队伍名称）
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (m) =>
        (m.teamA && m.teamA.toLowerCase().includes(query)) ||
        (m.teamB && m.teamB.toLowerCase().includes(query)) ||
        (m.topic && m.topic.toLowerCase().includes(query)),
    )
  }

  return result
})

// 按轮次分组的比赛（用于展示）
const matchesByRound = computed(() => {
  const groups: Record<number, any[]> = {}
  filteredMatches.value.forEach((match) => {
    const round = match.round || 1
    if (!groups[round]) {
      groups[round] = []
    }
    groups[round].push(match)
  })

  const sortedKeys = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
  return sortedKeys.map((key) => {
    const roundMatches = groups[key] || []
    return {
      round: key,
      matches: roundMatches.sort((a, b) => Number(a.orderNum || 0) - Number(b.orderNum || 0)),
    }
  })
})

// 状态统计
const statusStats = computed(() => {
  const total = matches.value.length
  const finished = matches.value.filter((m) => m.status === 'finished').length
  const ongoing = matches.value.filter((m) => m.status === 'ongoing').length
  const pending = matches.value.filter((m) => m.status === 'pending').length
  return { total, finished, ongoing, pending }
})

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

// 格式化进度百分比
const formatPercent = (num: number) => `${num}%`

// 获取轮次名称
const getRoundName = (round: number) => {
  const totalRounds = matchesByRound.value.length
  if (round === totalRounds) return '决赛'
  if (round === totalRounds - 1) return '半决赛'
  if (round === totalRounds - 2) return '四分之一决赛'
  if (round === totalRounds - 3) return '八分之一决赛'
  return `第 ${round} 轮`
}

// 判断比赛状态颜色
const getStatusColor = (status: string) => {
  switch (status) {
    case 'finished':
      return 'bg-[var(--color-success-bg)] text-[var(--color-accent-success)]'
    case 'ongoing':
      return 'bg-[var(--color-warning-bg)] text-[var(--color-accent-warning)]'
    default:
      return 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
  }
}

// 判断胜者样式
const getWinnerStyle = (match: any, team: string) => {
  if (match.status !== 'finished') return ''
  const isWinner =
    (match.winner === 'teamA' && team === match.teamA) ||
    (match.winner === 'teamB' && team === match.teamB)
  return isWinner
    ? 'font-bold text-[var(--color-accent-primary)]'
    : 'text-[var(--color-text-muted)]'
}

// 获取比赛状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'finished':
      return '已结束'
    case 'ongoing':
      return '进行中'
    default:
      return '待进行'
  }
}

// ═══════════════════════════════════════════
// CSV 导出功能
// ═══════════════════════════════════════════
function exportStandingsCSV() {
  if (!stats.value?.standings?.length) {
    alert('暂无数据可导出')
    return
  }

  // 构建 CSV 内容
  const headers = ['排名', '队伍', '分组', '场次', '胜', '平', '负', '净胜分', '积分']
  const rows = stats.value.standings.map((team: any, index: number) => [
    index + 1,
    team.name,
    team.groupLabel || '-',
    team.played,
    team.wins,
    team.draws,
    team.losses,
    team.scoreDiff,
    team.points,
  ])

  const csvContent = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n')

  // 添加 BOM 以支持中文
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.href = url
  link.download = `${stats.value.tournament?.name || '赛事'}_积分榜.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div>
    <UButton
      v-if="stats?.standings?.length"
      color="primary"
      variant="outline"
      size="sm"
      class="mb-6"
      @click="exportStandingsCSV"
    >
      <UIcon name="i-lucide-download" class="w-4 h-4 mr-1" />
      导出积分榜
    </UButton>

    <!-- ═══ 加载状态 ═══ -->
    <div v-if="loading" class="text-center py-12">
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-[var(--color-text-muted)] mx-auto"
      />
      <p class="text-sm text-[var(--color-text-muted)] mt-3">加载中...</p>
    </div>

    <!-- ═══ Tab 切换栏（仅组织者可见）：赛果统计 / 评分问卷 ═══ -->
    <div
      v-if="canDesign && !loading"
      class="inline-flex gap-1 p-1 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] mb-6"
    >
      <button
        v-for="tab in [
          { key: 'stats', label: '赛果统计', icon: 'i-lucide-bar-chart' },
          { key: 'design', label: '评分问卷', icon: 'i-lucide-pencil' },
        ]"
        :key="tab.key"
        type="button"
        class="px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
        :class="
          activeTab === tab.key
            ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
        "
        @click="activeTab = tab.key as any"
      >
        <UIcon :name="tab.icon" class="w-4 h-4" /> {{ tab.label }}
      </button>
    </div>

    <!-- ═══ 数据内容：赛果统计 ═══ -->
    <div v-if="!loading && (!canDesign || activeTab === 'stats')">
      <!-- ═══ 比赛进度概览 ═══ -->
      <div v-if="stats?.matchStats" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <UCard class="p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">总场次</p>
              <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
                {{ stats.matchStats.total }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center"
            >
              <UIcon name="i-lucide-calendar" class="w-6 h-6 text-[var(--color-text-muted)]" />
            </div>
          </div>
        </UCard>
        <UCard class="p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">已完成</p>
              <p class="text-2xl font-bold text-[var(--color-accent-success)] mt-1">
                {{ stats.matchStats.finished }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-xl bg-[var(--color-success-bg)] flex items-center justify-center"
            >
              <UIcon
                name="i-lucide-check-circle"
                class="w-6 h-6 text-[var(--color-accent-success)]"
              />
            </div>
          </div>
        </UCard>
        <UCard class="p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">进行中</p>
              <p class="text-2xl font-bold text-[var(--color-accent-warning)] mt-1">
                {{ stats.matchStats.ongoing }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-xl bg-[var(--color-warning-bg)] flex items-center justify-center"
            >
              <UIcon name="i-lucide-clock" class="w-6 h-6 text-[var(--color-accent-warning)]" />
            </div>
          </div>
        </UCard>
        <UCard class="p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-[var(--color-text-muted)]">进度</p>
              <p class="text-2xl font-bold text-[var(--color-accent-primary)] mt-1">
                {{ formatPercent(stats.matchStats.progress) }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-xl bg-[var(--color-accent-bg)] flex items-center justify-center"
            >
              <UIcon
                name="i-lucide-trending-up"
                class="w-6 h-6 text-[var(--color-accent-primary)]"
              />
            </div>
          </div>
        </UCard>
      </div>

      <!-- ═══ 进度条 ═══ -->
      <UCard v-if="stats?.matchStats" class="mb-6">
        <template #header>
          <h2
            class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <UIcon name="i-lucide-bar-chart" class="w-4 h-4 text-[var(--color-text-muted)]" />
            赛事进度
          </h2>
        </template>
        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-[var(--color-text-secondary)]"
              >已完成 {{ stats.matchStats.finished }} / {{ stats.matchStats.total }} 场</span
            >
            <span class="font-medium text-[var(--color-text-primary)]">{{
              formatPercent(stats.matchStats.progress)
            }}</span>
          </div>
          <div class="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] rounded-full transition-all duration-500"
              :style="{ width: formatPercent(stats.matchStats.progress) }"
            />
          </div>
          <div class="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>待进行 {{ stats.matchStats.pending }} 场</span>
            <span>进行中 {{ stats.matchStats.ongoing }} 场</span>
          </div>
        </div>
      </UCard>

      <!-- ═══ 积分榜 ═══ -->
      <UCard v-if="stats?.standings?.length" class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h2
              class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-trophy" class="w-4 h-4 text-[var(--color-accent-primary)]" />
              积分榜
            </h2>
            <span class="text-xs text-[var(--color-text-muted)]"
              >{{ stats.standings.length }} 支队伍</span
            >
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-[var(--color-border)]">
                <th
                  class="text-left py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  排名
                </th>
                <th
                  class="text-left py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  队伍
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  分组
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  场次
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  胜
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  平
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  负
                </th>
                <th
                  class="text-center py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  净胜分
                </th>
                <th
                  class="text-right py-3 px-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  积分
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(team, index) in stats.standings"
                :key="team.id"
                :class="[
                  'border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors',
                  index === 0 ? 'bg-[var(--color-accent-bg)]' : '',
                ]"
              >
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <span v-if="index === 0" class="text-xl">🥇</span>
                    <span v-else-if="index === 1" class="text-xl">🥈</span>
                    <span v-else-if="index === 2" class="text-xl">🥉</span>
                    <span v-else class="text-sm font-medium text-[var(--color-text-muted)]">{{
                      Number(index) + 1
                    }}</span>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span class="font-medium text-[var(--color-text-primary)]">{{ team.name }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-sm text-[var(--color-text-secondary)]">{{
                    team.groupLabel || '-'
                  }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-sm font-medium text-[var(--color-text-primary)]">{{
                    team.played
                  }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-sm font-medium text-[var(--color-accent-success)]">{{
                    team.wins
                  }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-sm font-medium text-[var(--color-accent-warning)]">{{
                    team.draws
                  }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-sm font-medium text-[var(--color-accent-error)]">{{
                    team.losses
                  }}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <span
                    :class="[
                      'text-sm font-medium',
                      team.scoreDiff >= 0
                        ? 'text-[var(--color-accent-success)]'
                        : 'text-[var(--color-accent-error)]',
                    ]"
                    >{{ team.scoreDiff >= 0 ? '+' : '' }}{{ team.scoreDiff }}</span
                  >
                </td>
                <td class="py-3 px-4 text-right">
                  <span
                    :class="[
                      'text-lg font-bold',
                      index === 0
                        ? 'text-[var(--color-accent-primary)]'
                        : 'text-[var(--color-text-primary)]',
                    ]"
                    >{{ team.points }}</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- ═══ 分组积分榜 ═══ -->
      <UCard v-if="stats?.groupStandings?.length" class="mb-6">
        <template #header>
          <h2
            class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <UIcon name="i-lucide-users" class="w-4 h-4 text-[var(--color-text-muted)]" />
            分组积分榜
          </h2>
        </template>
        <div class="space-y-6">
          <div v-for="group in stats.groupStandings" :key="group.group">
            <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
              {{ group.group }}
            </h3>
            <div class="space-y-2">
              <div
                v-for="(team, index) in group.teams"
                :key="team.id"
                class="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)]"
              >
                <div class="flex items-center gap-3">
                  <span class="text-xs font-medium text-[var(--color-text-muted)] w-6">{{
                    Number(index) + 1
                  }}</span>
                  <span class="text-sm font-medium text-[var(--color-text-primary)]">{{
                    team.name
                  }}</span>
                </div>
                <div class="flex items-center gap-4 text-xs">
                  <span class="text-[var(--color-text-muted)]"
                    >{{ team.wins }}胜 {{ team.losses }}负</span
                  >
                  <span class="font-bold text-[var(--color-accent-primary)]"
                    >{{ team.points }} 分</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- ═══ 最佳辩手榜 ═══ -->
      <UCard v-if="stats?.bestDebaters?.length" class="mb-6">
        <template #header>
          <h2
            class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <UIcon name="i-lucide-award" class="w-4 h-4 text-[var(--color-accent-primary)]" />
            最佳辩手榜
          </h2>
        </template>
        <div class="space-y-3">
          <div
            v-for="(debater, index) in stats.bestDebaters"
            :key="debater.name"
            class="flex items-center justify-between p-3 rounded-lg"
            :class="
              Number(index) < 3 ? 'bg-[var(--color-accent-bg)]' : 'bg-[var(--color-bg-secondary)]'
            "
          >
            <div class="flex items-center gap-3">
              <div
                :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                  index === 0
                    ? 'bg-yellow-400 text-white'
                    : index === 1
                      ? 'bg-gray-300 text-gray-700'
                      : index === 2
                        ? 'bg-orange-300 text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]',
                ]"
              >
                {{ Number(index) + 1 }}
              </div>
              <span class="font-medium text-[var(--color-text-primary)]">{{ debater.name }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-[var(--color-text-muted)]">获得最佳辩手</span>
              <span class="text-lg font-bold text-[var(--color-accent-primary)]">{{
                debater.count
              }}</span>
              <span class="text-sm text-[var(--color-text-muted)]">次</span>
            </div>
          </div>
        </div>
      </UCard>

      <!-- ═══ 评委评分统计 ═══ -->
      <UCard v-if="stats?.judgeRankings?.length" class="mb-6">
        <template #header>
          <h2
            class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <UIcon name="i-lucide-gavel" class="w-4 h-4 text-[var(--color-text-muted)]" />
            评委评分统计
          </h2>
        </template>
        <div class="space-y-3">
          <div
            v-for="(judge, index) in stats.judgeRankings"
            :key="judge.name"
            class="flex items-center gap-3"
          >
            <span class="text-sm font-medium text-[var(--color-text-muted)] w-6">{{
              Number(index) + 1
            }}</span>
            <div class="flex-1">
              <div class="flex justify-between mb-1">
                <span class="text-sm font-medium text-[var(--color-text-primary)]">{{
                  judge.name
                }}</span>
                <span class="text-xs text-[var(--color-text-muted)]">{{ judge.count }} 场</span>
              </div>
              <div class="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                <div
                  class="h-full bg-[var(--color-accent-primary)] rounded-full transition-all duration-300"
                  :style="{
                    width: formatPercent((judge.count / stats.judgeRankings[0].count) * 100),
                  }"
                />
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- ═══ 比赛结果列表 ═══ -->
      <UCard v-if="matches.length" class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h2
              class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-swords" class="w-4 h-4 text-[var(--color-text-muted)]" />
              比赛结果
            </h2>
            <span class="text-xs text-[var(--color-text-muted)]"
              >共 {{ filteredMatches.length }} 场</span
            >
          </div>
        </template>

        <!-- 搜索与筛选工具栏 -->
        <div class="flex flex-col sm:flex-row gap-3 mb-4">
          <div class="relative flex-1">
            <UIcon
              name="i-lucide-search"
              class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索队伍或辩题..."
              class="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] border border-[var(--color-border)] focus:border-[var(--color-accent-primary)] focus:outline-none transition-colors"
            />
          </div>
          <div class="flex gap-2">
            <button
              v-for="status in [
                { value: 'all', label: '全部', count: statusStats.total },
                { value: 'finished', label: '已结束', count: statusStats.finished },
                { value: 'ongoing', label: '进行中', count: statusStats.ongoing },
                { value: 'pending', label: '待进行', count: statusStats.pending },
              ]"
              :key="status.value"
              :class="[
                'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                statusFilter === status.value
                  ? 'bg-[var(--color-accent-primary)] text-white'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
              ]"
              @click="statusFilter = status.value"
            >
              {{ status.label }} ({{ status.count }})
            </button>
          </div>
        </div>

        <!-- 按轮次分组展示 -->
        <div v-if="filteredMatches.length" class="space-y-6">
          <div v-for="roundData in matchesByRound" :key="roundData.round">
            <h3
              class="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2"
            >
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]"
              >
                第 {{ roundData.round }} 轮
              </span>
              <span class="text-[var(--color-text-muted)]">{{
                getRoundName(roundData.round)
              }}</span>
              <span class="text-xs text-[var(--color-text-muted)]"
                >({{ roundData.matches.length }} 场)</span
              >
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="match in roundData.matches"
                :key="match.id"
                :class="[
                  'relative p-4 rounded-xl border transition-all duration-200',
                  match.status === 'finished'
                    ? 'border-[var(--color-accent-success)] bg-[var(--color-success-bg)]'
                    : match.status === 'ongoing'
                      ? 'border-[var(--color-accent-warning)] bg-[var(--color-warning-bg)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]',
                ]"
              >
                <!-- 状态标签 -->
                <div class="absolute -top-2 left-4">
                  <span :class="['text-xs px-2 py-0.5 rounded-full', getStatusColor(match.status)]">
                    {{ getStatusText(match.status) }}
                  </span>
                </div>

                <div class="mt-3">
                  <!-- 比赛编号 -->
                  <p class="text-xs text-[var(--color-text-muted)] mb-2">
                    场次 {{ match.orderNum }}
                  </p>

                  <!-- 队伍 A -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <UIcon
                        name="i-lucide-circle"
                        class="w-4 h-4 text-[var(--color-accent-primary)]"
                      />
                      <span :class="['text-sm font-medium', getWinnerStyle(match, match.teamA)]">
                        {{ match.teamA || '待定' }}
                      </span>
                    </div>
                    <span
                      v-if="match.scoreA !== null"
                      class="text-lg font-bold text-[var(--color-text-primary)]"
                    >
                      {{ match.scoreA }}
                    </span>
                  </div>

                  <!-- VS -->
                  <div class="flex items-center justify-center gap-2 py-1.5">
                    <div class="flex-1 h-px bg-[var(--color-border)]" />
                    <span class="text-xs text-[var(--color-text-muted)]">VS</span>
                    <div class="flex-1 h-px bg-[var(--color-border)]" />
                  </div>

                  <!-- 队伍 B -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <UIcon
                        name="i-lucide-circle"
                        class="w-4 h-4 text-[var(--color-accent-error)]"
                      />
                      <span :class="['text-sm font-medium', getWinnerStyle(match, match.teamB)]">
                        {{ match.teamB || '待定' }}
                      </span>
                    </div>
                    <span
                      v-if="match.scoreB !== null"
                      class="text-lg font-bold text-[var(--color-text-primary)]"
                    >
                      {{ match.scoreB }}
                    </span>
                  </div>

                  <!-- 辩题 -->
                  <div v-if="match.topic" class="mt-2 pt-2 border-t border-[var(--color-border)]">
                    <p class="text-xs text-[var(--color-text-muted)] truncate">{{ match.topic }}</p>
                  </div>

                  <!-- 最佳辩手 -->
                  <div
                    v-if="match.bestDebaterA || match.bestDebaterB"
                    class="mt-2 flex flex-wrap gap-1"
                  >
                    <span
                      v-if="match.bestDebaterA"
                      class="text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]"
                    >
                      最佳辩手(正): {{ match.bestDebaterA }}
                    </span>
                    <span
                      v-if="match.bestDebaterB"
                      class="text-xs px-1.5 py-0.5 rounded bg-[var(--color-error-bg)] text-[var(--color-accent-error)]"
                    >
                      最佳辩手(反): {{ match.bestDebaterB }}
                    </span>
                  </div>

                  <!-- 去评分 -->
                  <div
                    v-if="match.status === 'finished'"
                    class="mt-3 pt-2 border-t border-[var(--color-border)]"
                  >
                    <UButton
                      size="xs"
                      color="primary"
                      variant="soft"
                      @click="
                        void navigateTo(`/tournaments/${tournamentId}/score-survey/${match.id}`)
                      "
                    >
                      <UIcon name="i-lucide-star" class="w-3.5 h-3.5 mr-1" />
                      去评分{{
                        submissionCountByMatch[match.id]
                          ? ` (${submissionCountByMatch[match.id]})`
                          : ''
                      }}
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 筛选结果为空 -->
        <div v-else-if="matches.length" class="text-center py-8">
          <UIcon
            name="i-lucide-search-x"
            class="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3"
          />
          <p class="text-[var(--color-text-muted)]">未找到匹配的比赛</p>
          <p class="text-xs text-[var(--color-text-muted)] mt-1">请尝试其他搜索条件</p>
        </div>
      </UCard>

      <!-- ═══ 评分统计 ═══ -->
      <UCard
        v-if="
          scoreStats?.hasTemplate && scoreStats.matches?.some((m: any) => m.submissionCount > 0)
        "
        class="mb-6"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <h2
              class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon
                name="i-lucide-bar-chart-3"
                class="w-4 h-4 text-[var(--color-accent-primary)]"
              />
              评分统计
            </h2>
            <span class="text-xs text-[var(--color-text-muted)]">
              共 {{ scoreStats.submissionTotal }} 份评分
            </span>
          </div>
        </template>

        <div class="space-y-5">
          <div
            v-for="m in scoreStats.matches.filter((x: any) => x.submissionCount > 0)"
            :key="m.matchId"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 text-sm">
                <span class="font-medium text-[var(--color-text-primary)]">{{
                  matchOf(m.matchId)?.teamA || '待定'
                }}</span>
                <span class="text-[var(--color-text-muted)] text-xs">VS</span>
                <span class="font-medium text-[var(--color-text-primary)]">{{
                  matchOf(m.matchId)?.teamB || '待定'
                }}</span>
              </div>
              <span class="text-xs text-[var(--color-text-muted)]"
                >{{ m.submissionCount }} 人评分</span
              >
            </div>

            <div class="space-y-3 pl-1">
              <div v-for="s in m.scales" :key="s.fieldKey">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-[var(--color-text-secondary)]">{{ s.title }}</span>
                  <span class="text-xs font-semibold text-[var(--color-accent-primary)]">
                    平均 {{ s.avg }} / {{ s.max }}
                  </span>
                </div>
                <!-- 分布条 -->
                <div class="flex items-end gap-1 h-12">
                  <div
                    v-for="d in s.distribution"
                    :key="d.value"
                    class="flex-1 flex flex-col items-center justify-end"
                  >
                    <span class="text-[10px] text-[var(--color-text-muted)] mb-0.5">{{
                      d.count
                    }}</span>
                    <div
                      class="w-full rounded-t bg-gradient-to-t from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)]"
                      :style="{ height: `${Math.max(8, (d.count / m.submissionCount) * 100)}%` }"
                      :title="`${d.value} 分：${d.count} 人`"
                    />
                    <span class="text-[10px] text-[var(--color-text-muted)] mt-0.5">{{
                      d.value
                    }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- ═══ 数据内容：评分问卷（设计器，仿报名管理页「报名问卷设计」Tab）═══ -->
    <div v-if="!loading && canDesign && activeTab === 'design'" class="space-y-6">
      <!-- 模板摘要 -->
      <UCard v-if="scoreTemplate" class="mb-6">
        <template #header>
          <h2
            class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <UIcon
              name="i-lucide-clipboard-list"
              class="w-4 h-4 text-[var(--color-accent-primary)]"
            />
            评分问卷设计
          </h2>
        </template>
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span class="text-[var(--color-text-secondary)]"
            >题目数：<b class="text-[var(--color-text-primary)]">{{
              scoreTemplate.questionCount
            }}</b></span
          >
          <span class="text-[var(--color-text-secondary)]"
            >提交数：<b class="text-[var(--color-text-primary)]">{{
              scoreTemplate.submissionCount
            }}</b></span
          >
          <span class="text-[var(--color-text-secondary)]"
            >受众：<b class="text-[var(--color-text-primary)]">{{
              audienceLabels[scoreTemplate.settings?.audience as keyof typeof audienceLabels] ||
              '登录用户'
            }}</b></span
          >
          <UBadge
            :color="scoreTemplate.status === 'open' ? 'success' : 'neutral'"
            size="xs"
            variant="soft"
            >{{ scoreTemplate.status === 'open' ? '收集中' : scoreTemplate.status }}</UBadge
          >
        </div>
      </UCard>
      <p v-else class="text-sm text-[var(--color-text-muted)] mb-4">
        尚未设计评分问卷。添加量表题并选择可填写人群，即可在对每场已结束比赛下收集评分。
      </p>

      <!-- 受众 / 允许多次提交（整卷设置其余项已在下方设计器内编辑） -->
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 mb-2">
        <div>
          <label class="block text-xs text-[var(--color-text-secondary)] mb-1">受众</label>
          <ClientOnly>
            <USelect v-model="designerAudience" :items="audienceOptions" />
            <template #fallback
              ><div
                class="w-full h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
            /></template>
          </ClientOnly>
        </div>
        <label
          class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer pt-5"
        >
          <input
            v-model="designerAllowMultiple"
            type="checkbox"
            class="rounded border-[var(--color-border)]"
          />
          允许同一人多次提交（重复提交将覆盖上次）
        </label>
      </div>

      <!-- 表单设计器 -->
      <div class="border border-[var(--color-border)] rounded-lg overflow-hidden h-[720px]">
        <ClientOnly>
          <LazyFormDesigner
            v-model="designerFields"
            :form-settings="designerFormSettings"
            @update:form-settings="(s: any) => Object.assign(designerFormSettings, s)"
          />
          <template #fallback
            ><div
              class="h-full flex items-center justify-center text-[var(--color-text-muted)] text-sm"
            >
              加载设计器…
            </div></template
          >
        </ClientOnly>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <UButton color="primary" :loading="savingDesign" @click="saveDesign">
          <UIcon name="i-lucide-save" class="w-4 h-4 mr-1" />保存问卷
        </UButton>
      </div>
    </div>
  </div>
</template>
