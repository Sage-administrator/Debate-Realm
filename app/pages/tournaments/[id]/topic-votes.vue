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
const { getTopicVotes, createTopicVote, updateTopicVote, deleteTopicVote, getVoteStats } =
  useTopicVote()
const { listTopics, createTopic, updateTopic, deleteTopic, importTopics } = useDebateTopic()

const tournament = inject<Ref<any>>('tournament')!
const tournamentId = computed(() => route.params.id as string)
const matches = ref<any[]>([])
const votes = ref<any[]>([])
const loading = ref(false)

// 客户端展示文本：优先"正方 / 反方"组合，否则回退到 text
function disp(t: any): string {
  if (typeof t === 'string') return t
  if (!t) return ''
  const aff = (t.affirmative || '').toString().trim()
  const neg = (t.negative || '').toString().trim()
  if (aff && neg) return `正方：${aff} ｜ 反方：${neg}`
  if (aff) return `正方：${aff}`
  if (neg) return `反方：${neg}`
  return (t.text || '').toString().trim()
}

// 当前激活的 Tab：list 投票问卷列表 / create 创建或编辑投票问卷 / library 辩题库
const activeTab = ref<'list' | 'create' | 'library'>('list')

// 筛选条件：状态、范围（赛事级/场次级）
// 'all' 表示不筛选（reka-ui 不允许 SelectItem value 为空字符串，故用 'all' 占位）
const filterStatus = ref<string>('all')
const filterScope = ref<string>('all')

// 正在编辑的投票 ID（null 表示新建）
const editingId = ref<string | null>(null)
const saving = ref(false)
// 投票问卷表单数据（topics 为结构化数组：{ text, affirmative, negative, sourceTopicId, category }）
const formData = reactive({
  title: '',
  description: '',
  topics: [{ text: '' }] as any[],
  matchId: '' as string,
  allowedVoters: ['debater', 'judge', 'admin', 'public'] as string[],
  multipleChoice: false,
  deadline: '',
  showResults: true,
  status: 'open' as 'draft' | 'open' | 'closed',
})

// 辩题库选择器弹窗
const pickerOpen = ref(false)

// 从辩题库拉取辩题到候选列表
function onPickTopic(item: any) {
  const srcId = item?.id || item?.sourceTopicId
  const aff = (item?.affirmative || '').toString().trim().toLowerCase()
  const neg = (item?.negative || '').toString().trim().toLowerCase()
  const text = item?.text || ''
  // 去重：已存在相同来源 / 相同正方反方 / 相同展示文本的跳过
  const dup = formData.topics.some((t: any) => {
    if (srcId && t.sourceTopicId && t.sourceTopicId === srcId) return true
    if (
      aff &&
      neg &&
      (t.affirmative || '').toString().trim().toLowerCase() === aff &&
      (t.negative || '').toString().trim().toLowerCase() === neg
    )
      return true
    if (text && t.text && t.text === text) return true
    return false
  })
  if (dup) {
    toast.add({ title: '该辩题已在候选列表中', color: 'warning' })
    return
  }
  formData.topics.push({
    text: '',
    affirmative: (item?.affirmative || '').toString().trim() || null,
    negative: (item?.negative || '').toString().trim() || null,
    sourceTopicId: srcId || null,
    category: item?.category || null,
  })
  toast.add({ title: '已加入候选辩题', color: 'success' })
}

// ═══════════ 辩题库 Tab（赛事级辩题库的增删改查） ═══════════
const libTopics = ref<any[]>([])
const libLoading = ref(false)
const libLoaded = ref(false)
const libSearch = ref('')
const libCategory = ref('all')

// 辩题库派生分类列表
const libCategories = computed(() => {
  const set = new Set<string>()
  for (const t of libTopics.value) if (t.category) set.add(t.category)
  return Array.from(set)
})

// 辩题库表单弹窗状态
const libFormOpen = ref(false)
const libEditingId = ref<string | null>(null)
const libSaving = ref(false)
const libForm = reactive({
  affirmative: '',
  negative: '',
  category: '',
  note: '',
})

// 辩题库删除确认弹窗
const libDeleteOpen = ref(false)
const libDeleteTarget = ref<any>(null)

// 加载辩题库列表
async function loadLibrary() {
  libLoading.value = true
  try {
    const res = await listTopics(tournamentId.value, {
      search: libSearch.value.trim() || undefined,
      category: libCategory.value !== 'all' ? libCategory.value : undefined,
    })
    libTopics.value = res.topics || []
    libLoaded.value = true
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载辩题库失败', color: 'error' })
  } finally {
    libLoading.value = false
  }
}

// 搜索/分类变化时重新加载（仅在辩题库已加载后生效，避免初始重复请求）
watch([libSearch, libCategory], () => {
  if (libLoaded.value) loadLibrary()
})

// 切换到辩题库 Tab 时懒加载一次
watch(activeTab, (tab) => {
  if (tab === 'library' && !libLoaded.value) loadLibrary()
})

function libResetForm() {
  libEditingId.value = null
  libForm.affirmative = ''
  libForm.negative = ''
  libForm.category = ''
  libForm.note = ''
}

function libOpenCreate() {
  libResetForm()
  libFormOpen.value = true
}

function libOpenEdit(t: any) {
  libEditingId.value = t.id
  libForm.affirmative = t.affirmative || ''
  libForm.negative = t.negative || ''
  libForm.category = t.category || ''
  libForm.note = t.note || ''
  libFormOpen.value = true
}

async function libHandleSubmit() {
  if (!libForm.affirmative.trim() || !libForm.negative.trim()) {
    toast.add({ title: '正方立场与反方立场均不能为空', color: 'warning' })
    return
  }
  libSaving.value = true
  try {
    const payload = {
      affirmative: libForm.affirmative.trim(),
      negative: libForm.negative.trim(),
      category: libForm.category.trim() || undefined,
      note: libForm.note.trim() || undefined,
    }
    if (libEditingId.value) {
      await updateTopic(tournamentId.value, libEditingId.value, payload)
      toast.add({ title: '已更新', color: 'success' })
    } else {
      await createTopic(tournamentId.value, payload)
      toast.add({ title: '已添加', color: 'success' })
    }
    libFormOpen.value = false
    await loadLibrary()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    libSaving.value = false
  }
}

function libOpenDelete(t: any) {
  libDeleteTarget.value = t
  libDeleteOpen.value = true
}

async function libConfirmDelete() {
  if (!libDeleteTarget.value) return
  try {
    await deleteTopic(tournamentId.value, libDeleteTarget.value.id)
    toast.add({ title: '已删除', color: 'success' })
    libDeleteTarget.value = null
    libDeleteOpen.value = false
    await loadLibrary()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '删除失败', color: 'error' })
  }
}

// 从辩题库列表直接引用某辩题到"创建投票问卷"候选中
function libUseInVote(t: any) {
  onPickTopic({
    id: t.id,
    affirmative: t.affirmative,
    negative: t.negative,
    category: t.category,
    text: '',
  })
  activeTab.value = 'create'
}

// ═══════════ 辩题库 CSV 导入 ═══════════
const importOpen = ref(false)
const importFile = ref<File | null>(null)
const importParsed = ref<any[]>([]) // 解析后的有效行
const importInvalid = ref(0) // 因缺正方/反方而无效的行数
const importBusy = ref(false) // 解析中 / 提交中
const importResult = ref<{ created: number; skipped: number; total: number } | null>(null)

// 最小 CSV 解析（支持引号包裹、字段内逗号 / 换行、\r\n 与 \n）
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length
  while (i < n) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += ch
    i++
    continue
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => (c || '').trim() !== ''))
}

function handleFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importFile.value = file
  importBusy.value = true
  importResult.value = null
  const reader = new FileReader()
  reader.onload = () => {
    try {
      let text = String(reader.result || '')
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // 去 UTF-8 BOM
      const rows = parseCsv(text)
      if (rows.length < 2) {
        importParsed.value = []
        importInvalid.value = 0
        toast.add({ title: '未找到数据行，请使用模板填写', color: 'warning' })
      } else {
        // rows[0] 已由 rows.length >= 2 保证存在，cells 也由 rows[r] 保证存在
        const header = rows[0]!.map((h) => h.trim())
        const affIdx = header.findIndex((h) => h.includes('正方'))
        const negIdx = header.findIndex((h) => h.includes('反方'))
        const catIdx = header.findIndex((h) => h.includes('分类'))
        const noteIdx = header.findIndex((h) => h.includes('备注'))
        const parsed: any[] = []
        let invalid = 0
        for (let r = 1; r < rows.length; r++) {
          const cells = rows[r]!
          const aff = (affIdx >= 0 ? cells[affIdx] : '')?.toString().trim() || ''
          const neg = (negIdx >= 0 ? cells[negIdx] : '')?.toString().trim() || ''
          if (!aff || !neg) {
            invalid++
            continue
          }
          parsed.push({
            affirmative: aff,
            negative: neg,
            category: (catIdx >= 0 ? cells[catIdx] : '')?.toString().trim() || undefined,
            note: (noteIdx >= 0 ? cells[noteIdx] : '')?.toString().trim() || undefined,
          })
        }
        importParsed.value = parsed
        importInvalid.value = invalid
        if (parsed.length === 0)
          toast.add({ title: '没有有效的辩题行（正方/反方需齐全）', color: 'warning' })
      }
    } catch {
      toast.add({ title: '解析文件失败', color: 'error' })
    } finally {
      importBusy.value = false
    }
  }
  reader.onerror = () => {
    importBusy.value = false
    toast.add({ title: '读取文件失败', color: 'error' })
  }
  reader.readAsText(file, 'UTF-8')
}

function openImport() {
  importFile.value = null
  importParsed.value = []
  importInvalid.value = 0
  importResult.value = null
  importOpen.value = true
}

async function confirmImport() {
  if (importParsed.value.length === 0) {
    toast.add({ title: '没有可导入的辩题', color: 'warning' })
    return
  }
  importBusy.value = true
  try {
    const res = await importTopics(tournamentId.value, importParsed.value)
    importResult.value = res
    toast.add({ title: `成功导入 ${res.created} 条，跳过 ${res.skipped} 条重复`, color: 'success' })
    await loadLibrary()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '导入失败', color: 'error' })
  } finally {
    importBusy.value = false
  }
}

// 下载 CSV 导入模板（带 UTF-8 BOM，便于 Excel 打开中文不乱码）
function downloadTemplate() {
  const header = '正方立场,反方立场,分类标签,备注\n'
  const example =
    '人工智能利大于弊,人工智能弊大于利,政策辩,可引用最新数据\n' +
    '网络匿名利大于弊,网络匿名弊大于利,价值辩,\n'
  const csv = '﻿' + header + example
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '辩题库导入模板.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.add({ title: '模板已下载，填写后点击"导入"', color: 'success' })
}

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
const voteQuestionTypeLabel = computed(() => (formData.multipleChoice ? '多选题' : '单选题'))

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
  formData.topics = [{ text: '' }]
  formData.matchId = ''
  formData.allowedVoters = ['debater', 'judge', 'admin', 'public']
  formData.multipleChoice = false
  formData.deadline = ''
  formData.showResults = true
  formData.status = 'open'
}

// 添加一个候选辩题选项输入框
function addTopic() {
  formData.topics.push({ text: '' })
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
  formData.topics =
    vote.topics && vote.topics.length > 0
      ? vote.topics.map((t: any) => ({
          text: (t?.text || '').toString(),
          affirmative: (t?.affirmative || '').toString() || null,
          negative: (t?.negative || '').toString() || null,
          sourceTopicId: t?.sourceTopicId || null,
          category: t?.category || null,
        }))
      : [{ text: '' }]
  formData.matchId = vote.matchId || ''
  // allowedVoters 在数据库中以 JSON 字符串存储，需解析
  try {
    const parsed = vote.allowedVoters
      ? JSON.parse(vote.allowedVoters)
      : ['debater', 'judge', 'admin', 'public']
    formData.allowedVoters = Array.isArray(parsed)
      ? parsed
      : ['debater', 'judge', 'admin', 'public']
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
  // 校验：候选辩题去重后至少 2 个（按展示文本去重；支持纯 text 或 正/反 结构）
  const items = formData.topics
    .map((t: any) => ({
      text: (t?.text || '').toString().trim(),
      affirmative: (t?.affirmative || '').toString().trim() || null,
      negative: (t?.negative || '').toString().trim() || null,
      sourceTopicId: t?.sourceTopicId || null,
      category: t?.category || null,
    }))
    .filter((t: any) => t.text || (t.affirmative && t.negative))
  const seen = new Set<string>()
  const uniqueTopics: any[] = []
  for (const t of items) {
    const key = disp(t)
    if (!key || seen.has(key)) continue
    seen.add(key)
    uniqueTopics.push(t)
  }
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
    toast.add({
      title: newStatus === 'open' ? '已开启投票问卷' : '已关闭投票问卷',
      color: 'success',
    })
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
  let open = 0,
    closed = 0,
    draft = 0,
    totalVotes = 0
  for (const v of votes.value) {
    if (v.status === 'open') open++
    else if (v.status === 'closed') closed++
    else if (v.status === 'draft') draft++
    totalVotes += v.totalVotes || 0
  }
  return { total: votes.value.length, open, closed, draft, totalVotes }
})

onMounted(() => {
  // 支持从辩题库选择器/链接携带 ?tab=library 直接定位到辩题库标签
  if (route.query.tab === 'library') activeTab.value = 'library'
  loadData()
})
</script>

<template>
  <template v-if="tournament">
    <div class="space-y-6">
      <div class="flex gap-2">
        <button
          v-for="tab in [
            { key: 'list', label: '投票问卷列表', icon: 'i-lucide-list' },
            {
              key: 'create',
              label: editingId ? '编辑投票问卷' : '创建投票问卷',
              icon: 'i-lucide-plus-circle',
            },
            { key: 'library', label: '辩题库', icon: 'i-lucide-library' },
          ]"
          :key="tab.key"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          :class="
            activeTab === tab.key
              ? 'bg-blue-600 text-white'
              : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
          "
          @click="
            () => {
              activeTab = tab.key as any
              if (tab.key === 'create' && !editingId) resetForm()
            }
          "
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
                <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
                  {{ summaryStats.total }}
                </p>
              </div>
              <UIcon name="i-lucide-vote" class="w-8 h-8 text-blue-600/60 dark:text-blue-400/60" />
            </div>
            <p class="text-xs text-[var(--color-text-muted)] mt-2">
              草稿 {{ summaryStats.draft }} · 进行 {{ summaryStats.open }} · 关闭
              {{ summaryStats.closed }}
            </p>
          </div>
          <div class="glass-card p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">进行中</p>
                <p class="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {{ summaryStats.open }}
                </p>
              </div>
              <UIcon
                name="i-lucide-circle-dot"
                class="w-8 h-8 text-green-600/60 dark:text-green-400/60"
              />
            </div>
            <p class="text-xs text-[var(--color-text-muted)] mt-2">接受提交中</p>
          </div>
          <div class="glass-card p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">已关闭</p>
                <p class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {{ summaryStats.closed }}
                </p>
              </div>
              <UIcon
                name="i-lucide-lock"
                class="w-8 h-8 text-amber-600/60 dark:text-amber-400/60"
              />
            </div>
            <p class="text-xs text-[var(--color-text-muted)] mt-2">已结束提交</p>
          </div>
          <div class="glass-card p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">累计票数</p>
                <p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {{ summaryStats.totalVotes }}
                </p>
              </div>
              <UIcon
                name="i-lucide-chart-bar"
                class="w-8 h-8 text-indigo-600 dark:text-indigo-400/60"
              />
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
                :items="[
                  { label: '全部状态', value: 'all' },
                  { label: '草稿', value: 'draft' },
                  { label: '进行中', value: 'open' },
                  { label: '已关闭', value: 'closed' },
                ]"
                class="w-32"
                :ui="{
                  base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]',
                }"
                @update:model-value="loadVotes"
              />
              <template #fallback>
                <div class="w-32 h-9 rounded-lg bg-[var(--color-bg-secondary)]" />
              </template>
            </ClientOnly>
            <ClientOnly>
              <USelect
                v-model="filterScope"
                :items="[
                  { label: '全部范围', value: 'all' },
                  { label: '赛事级', value: 'tournament' },
                  { label: '场次级', value: 'match' },
                ]"
                class="w-32"
                :ui="{
                  base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]',
                }"
                @update:model-value="loadVotes"
              />
              <template #fallback>
                <div class="w-32 h-9 rounded-lg bg-[var(--color-bg-secondary)]" />
              </template>
            </ClientOnly>
            <div class="flex-1" />
            <UButton
              color="primary"
              icon="i-lucide-plus"
              @click="
                () => {
                  resetForm()
                  activeTab = 'create'
                }
              "
            >
              创建投票问卷
            </UButton>
          </div>
        </UCard>

        <div v-if="votes.length === 0" class="glass-card p-12 text-center">
          <UIcon
            name="i-lucide-inbox"
            class="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3"
          />
          <p class="text-[var(--color-text-secondary)]">暂无投票问卷</p>
          <p class="text-xs text-[var(--color-text-muted)] mt-1">点击“创建投票问卷”开始</p>
        </div>

        <div v-else class="space-y-3">
          <UCard v-for="vote in votes" :key="vote.id">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-base font-semibold text-[var(--color-text-primary)]">
                    {{ vote.title }}
                  </h3>
                  <UBadge
                    :color="statusMeta[vote.status]?.color || 'neutral'"
                    size="xs"
                    variant="soft"
                  >
                    {{ statusMeta[vote.status]?.label || vote.status }}
                  </UBadge>
                  <!-- ponytail: UBadge color 枚举不含 blue/purple/cyan，用自定义 class 保持视觉差异 -->
                  <UBadge
                    v-if="vote.matchId"
                    size="xs"
                    variant="soft"
                    class="bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  >
                    场次级
                  </UBadge>
                  <UBadge
                    v-else
                    size="xs"
                    variant="soft"
                    class="bg-purple-500/20 text-purple-600 dark:text-purple-400"
                  >
                    赛事级
                  </UBadge>
                  <UBadge
                    v-if="vote.multipleChoice"
                    size="xs"
                    variant="soft"
                    class="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                  >
                    多选
                  </UBadge>
                </div>
                <p
                  v-if="vote.description"
                  class="text-sm text-[var(--color-text-secondary)] mt-1.5 line-clamp-2"
                >
                  {{ vote.description }}
                </p>

                <div class="mt-2.5 flex flex-wrap gap-1.5">
                  <span
                    v-for="(t, i) in vote.topics.slice(0, 4)"
                    :key="i"
                    class="px-2 py-0.5 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)]"
                  >
                    {{ disp(t).length > 24 ? disp(t).slice(0, 24) + '...' : disp(t) }}
                  </span>
                  <span
                    v-if="vote.topics.length > 4"
                    class="px-2 py-0.5 text-xs text-[var(--color-text-muted)]"
                  >
                    +{{ vote.topics.length - 4 }} 个
                  </span>
                </div>

                <div
                  class="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]"
                >
                  <span class="flex items-center gap-1">
                    <UIcon name="i-lucide-users" class="w-3 h-3" />
                    {{
                      parseVoterTypes(vote.allowedVoters)
                        .map((t) => voterTypeLabel[t] || t)
                        .join(' / ')
                    }}
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
                <UButton
                  size="xs"
                  variant="outline"
                  icon="i-lucide-bar-chart-3"
                  @click="openStats(vote)"
                >
                  统计
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  icon="i-lucide-link"
                  @click="copyVoteLink(vote.id)"
                >
                  链接
                </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  icon="i-lucide-pencil"
                  @click="startEdit(vote)"
                >
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
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  @click="openDeleteModal(vote)"
                >
                  删除
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </template>

      <template v-else-if="activeTab === 'create'">
        <!-- ═══ 投票问卷编辑器：与 FormDesigner 统一的深色三栏 SaaS 布局 ═══ -->
        <div
          class="fd-container flex flex-col h-[760px] rounded-xl overflow-hidden border border-[var(--color-border)] bg-[#0f1320]/60 backdrop-blur-md"
        >
          <!-- ═══ 顶部导航栏 ═══ -->
          <header
            class="fd-header flex items-center justify-between h-12 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]"
          >
            <!-- 左：Logo + 步骤条 -->
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <UIcon name="i-lucide-vote" class="w-4 h-4" />
                <span class="text-xs font-medium text-[var(--color-text-primary)]">{{
                  editingId ? '编辑投票问卷' : '创建投票问卷'
                }}</span>
              </div>
              <!-- 步骤条 -->
              <nav class="flex items-center gap-3 text-xs">
                <span class="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                  <span class="w-1 h-1 rounded-full bg-indigo-400" />
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
              >
                取消
              </button>
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
            <aside
              class="fd-left w-[200px] shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-3"
            >
              <p class="px-4 mb-1 text-[11px] text-[var(--color-text-muted)]">题型库</p>
              <button
                type="button"
                class="w-full flex items-center gap-2 h-9 pl-4 pr-3 text-left text-sm transition-colors border-l-[3px]"
                :class="
                  !formData.multipleChoice
                    ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-400'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border-transparent'
                "
                @click="
                  () => {
                    formData.multipleChoice = false
                  }
                "
              >
                <UIcon name="i-lucide-circle-dot" class="w-4 h-4 shrink-0" />
                <span>单选题</span>
              </button>
              <button
                type="button"
                class="w-full flex items-center gap-2 h-9 pl-4 pr-3 text-left text-sm transition-colors border-l-[3px]"
                :class="
                  formData.multipleChoice
                    ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-400'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border-transparent'
                "
                @click="
                  () => {
                    formData.multipleChoice = true
                  }
                "
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
            <div
              class="fd-canvas flex-1 min-w-0 overflow-y-auto p-6 md:p-8 bg-[var(--color-bg-secondary)] relative"
            >
              <!-- 装饰性几何图形 -->
              <div
                class="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none"
              />

              <!-- 问卷纸张容器 -->
              <div
                class="fd-paper mx-auto max-w-[800px] min-h-[600px] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg shadow-xl p-8 md:p-10 relative"
              >
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
                />

                <!-- 题目卡片：辩题选择题 -->
                <div class="rounded-md border border-indigo-500/30 bg-indigo-500/[0.05] p-4">
                  <div class="flex items-center justify-between mb-3">
                    <div>
                      <p class="text-xs text-[var(--color-text-secondary)]">
                        第 01 题 · {{ voteQuestionTypeLabel }}
                      </p>
                      <h4 class="text-base font-semibold text-[var(--color-text-primary)] mt-1">
                        请选择你支持的辩题
                        <span class="text-red-500 dark:text-red-400">*</span>
                      </h4>
                    </div>
                    <span
                      class="text-[11px] px-2 py-1 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                      >{{ voteQuestionTypeLabel }}</span
                    >
                  </div>

                  <!-- 候选辩题选项列表（支持正方/反方） -->
                  <div class="space-y-3">
                    <div
                      v-for="(t, idx) in formData.topics"
                      :key="idx"
                      class="px-3 py-2.5 border border-[var(--color-border)] rounded bg-[var(--color-bg-tertiary)] group"
                    >
                      <div class="flex items-center gap-2">
                        <UIcon
                          :name="formData.multipleChoice ? 'i-lucide-square' : 'i-lucide-circle'"
                          class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
                        />
                        <input
                          v-model="formData.topics[idx].text"
                          type="text"
                          :placeholder="`辩题标题（可选，留空则按正方/反方显示）${idx + 1}`"
                          class="flex-1 bg-transparent border-none outline-none text-sm font-medium text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                        />
                        <button
                          v-if="formData.topics.length > 1"
                          type="button"
                          class="text-[var(--color-text-muted)] hover:text-red-500 dark:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          @click="removeTopic(idx)"
                        >
                          <UIcon name="i-lucide-x" class="w-4 h-4" />
                        </button>
                      </div>
                      <!-- 正方 / 反方 立场 -->
                      <div class="grid grid-cols-2 gap-2 mt-2">
                        <div class="flex items-center gap-1.5">
                          <span class="side-badge side-badge-pro shrink-0">正方</span>
                          <input
                            v-model="formData.topics[idx].affirmative"
                            type="text"
                            placeholder="正方立场"
                            class="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-indigo-500/50"
                          />
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span class="side-badge side-badge-con shrink-0">反方</span>
                          <input
                            v-model="formData.topics[idx].negative"
                            type="text"
                            placeholder="反方立场"
                            class="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-indigo-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="flex items-center gap-1 px-2 py-1 text-xs border border-indigo-500/30 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                      @click="addTopic"
                    >
                      <UIcon name="i-lucide-plus" class="w-3 h-3" />手动添加
                    </button>
                    <button
                      type="button"
                      class="flex items-center gap-1 px-2 py-1 text-xs border border-emerald-500/30 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      @click="pickerOpen = true"
                    >
                      <UIcon name="i-lucide-library" class="w-3 h-3" />从辩题库拉取
                    </button>
                  </div>
                  <p class="text-xs text-[var(--color-text-muted)] mt-2">
                    至少需要 2
                    个候选选项，保存时会自动去除空项和重复项。填写"正方/反方"后，投票页将按双方立场展示。
                  </p>
                </div>

                <!-- 页码指示器 -->
                <div class="mt-8 pt-4 border-t border-[var(--color-border-muted)] text-center">
                  <span class="text-[11px] text-[var(--color-text-muted)]"
                    >第 1 页 / 共 1 页 （1 题）</span
                  >
                </div>
              </div>
            </div>

            <!-- ═══ 右侧：设置面板（280px） ═══ -->
            <aside
              class="fd-right w-[280px] shrink-0 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            >
              <div class="h-10 flex items-center px-4 border-b border-[var(--color-border)]">
                <span
                  class="text-xs text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-400 h-10 leading-10"
                  >问卷设置</span
                >
              </div>

              <div class="p-4 space-y-4">
                <!-- 问卷范围 -->
                <div>
                  <label class="block text-xs text-[var(--color-text-secondary)] mb-1"
                    >问卷范围</label
                  >
                  <ClientOnly>
                    <USelect
                      v-model="formData.matchId"
                      :items="[
                        { label: '赛事级（适用于整个赛事）', value: '' },
                        ...matches.map((m) => ({
                          label: `场次：第${m.round}轮 ${m.teamA || '?'} vs ${m.teamB || '?'}`,
                          value: m.id,
                        })),
                      ]"
                      class="w-full"
                      :ui="{ base: 'input-glass' }"
                    />
                    <template #fallback>
                      <div
                        class="w-full h-9 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                      />
                    </template>
                  </ClientOnly>
                </div>

                <!-- 谁可以填写 -->
                <div>
                  <label class="block text-xs text-[var(--color-text-secondary)] mb-1"
                    >谁可以填写</label
                  >
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
                  <p class="text-[11px] text-[var(--color-text-muted)] mt-1">
                    勾选"公开投票"后未登录用户也可填写。
                  </p>
                </div>

                <!-- 展示实时结果 -->
                <div class="flex items-center justify-between h-8">
                  <div>
                    <p class="text-xs text-[var(--color-text-secondary)]">展示实时结果</p>
                    <p class="text-[11px] text-[var(--color-text-muted)]">填写者提交后可看到统计</p>
                  </div>
                  <span class="relative inline-block w-9 h-5">
                    <input v-model="formData.showResults" type="checkbox" class="sr-only peer" />
                    <span
                      class="block w-9 h-5 bg-[var(--color-bg-tertiary)] rounded-full peer-checked:bg-indigo-500 transition-colors"
                    />
                    <span
                      class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"
                    />
                  </span>
                </div>

                <!-- 截止时间 -->
                <div>
                  <label class="block text-xs text-[var(--color-text-secondary)] mb-1"
                    >截止时间（选填）</label
                  >
                  <BaseDateTimePicker
                    v-model="formData.deadline"
                    mode="datetime"
                    placeholder="选择截止时间"
                    input-class="fd-input w-full"
                  />
                </div>

                <!-- 问卷状态 -->
                <div>
                  <label class="block text-xs text-[var(--color-text-secondary)] mb-1"
                    >问卷状态</label
                  >
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
                      <div
                        class="w-full h-9 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                      />
                    </template>
                  </ClientOnly>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </template>

      <template v-else-if="activeTab === 'library'">
        <!-- ═══ 辩题库：赛事级辩题（正方/反方）增删改查 ═══ -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div class="glass-card p-4">
            <p class="text-xs text-[var(--color-text-muted)]">辩题总数</p>
            <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
              {{ libTopics.length }}
            </p>
          </div>
          <div class="glass-card p-4">
            <p class="text-xs text-[var(--color-text-muted)]">分类数</p>
            <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {{ libCategories.length }}
            </p>
          </div>
          <div class="glass-card p-4">
            <p class="text-xs text-[var(--color-text-muted)]">使用方式</p>
            <p class="text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed">
              在此维护辩题，创建投票问卷时点击“从辩题库拉取”或下方“用于投票”即可引用。
            </p>
          </div>
        </div>

        <UCard>
          <div class="flex flex-wrap items-center gap-3">
            <input
              v-model="libSearch"
              type="text"
              placeholder="搜索正方 / 反方 / 备注"
              class="fd-input w-full md:w-72"
            />
            <ClientOnly>
              <USelect
                v-model="libCategory"
                :items="[
                  { label: '全部分类', value: 'all' },
                  ...libCategories.map((c) => ({ label: c, value: c })),
                ]"
                class="w-40"
                :ui="{
                  base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]',
                }"
              />
              <template #fallback>
                <div
                  class="w-40 h-9 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                />
              </template>
            </ClientOnly>
            <div class="flex-1" />
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-download"
              @click="downloadTemplate"
              >下载模板</UButton
            >
            <UButton color="neutral" variant="outline" icon="i-lucide-upload" @click="openImport"
              >导入</UButton
            >
            <UButton color="primary" icon="i-lucide-plus" @click="libOpenCreate">新增辩题</UButton>
          </div>
        </UCard>

        <div v-if="libLoading" class="flex justify-center py-12">
          <UIcon
            name="i-lucide-loader"
            class="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <div v-else-if="libTopics.length === 0" class="glass-card p-12 text-center">
          <UIcon
            name="i-lucide-inbox"
            class="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3"
          />
          <p class="text-[var(--color-text-secondary)]">辩题库暂无条目</p>
          <p class="text-xs text-[var(--color-text-muted)] mt-1">
            点击右上角“新增辩题”开始积累你的辩题库
          </p>
        </div>
        <div v-else class="space-y-3">
          <UCard v-for="t in libTopics" :key="t.id">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                  <h3 class="text-base font-semibold text-[var(--color-text-primary)]">辩题</h3>
                  <UBadge
                    v-if="t.category"
                    size="xs"
                    variant="soft"
                    class="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    >{{ t.category }}</UBadge
                  >
                </div>
                <div class="flex items-start gap-2 text-sm mb-1.5">
                  <span class="side-badge side-badge-pro shrink-0">正方</span>
                  <span class="text-[var(--color-text-primary)] leading-relaxed">{{
                    t.affirmative
                  }}</span>
                </div>
                <div class="flex items-start gap-2 text-sm">
                  <span class="side-badge side-badge-con shrink-0">反方</span>
                  <span class="text-[var(--color-text-primary)] leading-relaxed">{{
                    t.negative
                  }}</span>
                </div>
                <p v-if="t.note" class="text-xs text-[var(--color-text-muted)] mt-2">
                  {{ t.note }}
                </p>
              </div>
              <div class="flex flex-col gap-1.5 shrink-0">
                <UButton
                  size="xs"
                  variant="soft"
                  color="primary"
                  icon="i-lucide-vote"
                  @click="libUseInVote(t)"
                  >用于投票</UButton
                >
                <UButton size="xs" variant="outline" icon="i-lucide-pencil" @click="libOpenEdit(t)"
                  >编辑</UButton
                >
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  @click="libOpenDelete(t)"
                  >删除</UButton
                >
              </div>
            </div>
          </UCard>
        </div>
      </template>
    </div>

    <UModal v-model:open="statsModal">
      <template #content>
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">投票统计</h3>
            <button
              class="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              @click="
                () => {
                  statsModal = false
                }
              "
            >
              <UIcon name="i-lucide-x" class="w-5 h-5" />
            </button>
          </div>

          <div v-if="loadingStats" class="flex justify-center py-12">
            <UIcon
              name="i-lucide-loader"
              class="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400"
            />
          </div>

          <template v-else-if="statsData">
            <div class="glass-card p-4 mb-4">
              <h4 class="text-base font-semibold text-[var(--color-text-primary)]">
                {{ statsData.title }}
              </h4>
              <p class="text-xs text-[var(--color-text-muted)] mt-1">
                共 {{ statsData.totalVotes }} 票 · {{ statsData.topics.length }} 个候选辩题
              </p>
            </div>

            <div class="space-y-3 mb-4">
              <div v-for="r in statsData.results" :key="r.index" class="glass-card p-3">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-sm text-[var(--color-text-primary)] flex-1">{{ r.topic }}</span>
                  <span class="text-sm font-semibold text-indigo-600 dark:text-indigo-400 ml-2"
                    >{{ r.count }} 票 ({{ r.percent }}%)</span
                  >
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
              <p class="text-xs text-[var(--color-text-muted)] mb-2">
                投票者列表（{{ statsData.voters.length }}）
              </p>
              <div class="max-h-48 overflow-y-auto space-y-1.5">
                <div
                  v-for="v in statsData.voters"
                  :key="v.id"
                  class="flex items-center justify-between text-xs bg-[var(--color-bg-secondary)] px-3 py-2 rounded"
                >
                  <span class="text-[var(--color-text-primary)]">
                    <!-- ponytail: UBadge color 枚举不含 blue/purple，用自定义 class -->
                    <UBadge
                      size="xs"
                      variant="soft"
                      :class="
                        v.voterType === 'public'
                          ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                          : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      "
                      class="mr-2"
                    >
                      {{ voterTypeLabel[v.voterType] || v.voterType }}
                    </UBadge>
                    {{ v.voterName || '（匿名）' }}
                  </span>
                  <span class="text-[var(--color-text-muted)]">
                    选 {{ v.topicIndices.map((i: number) => i + 1).join(',') }} ·
                    {{ formatDate(v.createdAt) }}
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
              <UIcon
                name="i-lucide-alert-triangle"
                class="w-5 h-5 text-red-500 dark:text-red-400"
              />
            </div>
            <div>
              <h3 class="text-base font-semibold text-[var(--color-text-primary)]">确认删除投票</h3>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                此操作不可撤销，所有投票记录将一并删除
              </p>
            </div>
          </div>
          <p class="text-sm text-[var(--color-text-secondary)] mb-5">
            确定要删除投票
            <span class="font-semibold text-[var(--color-text-primary)]"
              >"{{ deleteTarget?.title }}"</span
            >
            吗？
          </p>
          <div class="flex items-center justify-end gap-3">
            <UButton
              color="neutral"
              variant="outline"
              @click="
                () => {
                  deleteModalOpen = false
                  deleteTarget = null
                }
              "
              >取消</UButton
            >
            <UButton color="error" @click="confirmDelete">确认删除</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 辩题库选择器：从辩题库拉取辩题到候选列表 -->
    <DebateTopicPicker
      :open="pickerOpen"
      :tournament-id="tournamentId"
      :candidates="formData.topics"
      @update:open="(v: boolean) => (pickerOpen = v)"
      @select="onPickTopic"
    />

    <!-- 辩题库：新增 / 编辑 弹窗 -->
    <UModal v-model:open="libFormOpen" :title="libEditingId ? '编辑辩题' : '新增辩题'">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="block text-xs text-[var(--color-text-secondary)] mb-1"
              >正方立场 <span class="text-red-500">*</span></label
            >
            <input
              v-model="libForm.affirmative"
              type="text"
              placeholder="如：人工智能利大于弊"
              class="fd-input w-full"
            />
          </div>
          <div>
            <label class="block text-xs text-[var(--color-text-secondary)] mb-1"
              >反方立场 <span class="text-red-500">*</span></label
            >
            <input
              v-model="libForm.negative"
              type="text"
              placeholder="如：人工智能弊大于利"
              class="fd-input w-full"
            />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">分类标签</label>
              <input
                v-model="libForm.category"
                type="text"
                placeholder="如：政策辩 / 价值辩"
                class="fd-input w-full"
              />
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">备注</label>
              <input
                v-model="libForm.note"
                type="text"
                placeholder="可选"
                class="fd-input w-full"
              />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center justify-end gap-3">
          <UButton color="neutral" variant="outline" @click="void (libFormOpen = false)"
            >取消</UButton
          >
          <UButton color="primary" :loading="libSaving" @click="libHandleSubmit">
            {{ libEditingId ? '保存修改' : '添加' }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- 辩题库：删除确认 -->
    <UModal v-model:open="libDeleteOpen">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <UIcon
                name="i-lucide-alert-triangle"
                class="w-5 h-5 text-red-500 dark:text-red-400"
              />
            </div>
            <div>
              <h3 class="text-base font-semibold text-[var(--color-text-primary)]">确认删除辩题</h3>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">此操作不可撤销</p>
            </div>
          </div>
          <p class="text-sm text-[var(--color-text-secondary)] mb-5">
            确定要删除辩题
            <span class="font-semibold text-[var(--color-text-primary)]"
              >"{{ libDeleteTarget?.affirmative }} / {{ libDeleteTarget?.negative }}"</span
            >
            吗？
          </p>
          <div class="flex items-center justify-end gap-3">
            <UButton
              color="neutral"
              variant="outline"
              @click="
                () => {
                  libDeleteOpen = false
                  libDeleteTarget = null
                }
              "
              >取消</UButton
            >
            <UButton color="error" @click="libConfirmDelete">确认删除</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 辩题库：CSV 导入 -->
    <UModal v-model:open="importOpen" :title="'导入辩题（CSV）'">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            请先<span class="font-medium text-emerald-600 dark:text-emerald-400">下载模板</span
            >，按列填写「正方立场 / 反方立场 / 分类标签 / 备注」，保存为
            CSV（UTF-8）后选择文件导入。每条辩题的正方、反方均不可为空。
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-download"
              @click="downloadTemplate"
              >下载模板</UButton
            >
            <label
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg cursor-pointer border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <UIcon name="i-lucide-file-up" class="w-4 h-4" />
              选择 CSV 文件
              <input type="file" accept=".csv,text/csv" class="hidden" @change="handleFile" />
            </label>
            <span
              v-if="importFile"
              class="text-xs text-[var(--color-text-muted)] truncate max-w-[200px]"
              >{{ importFile.name }}</span
            >
          </div>

          <div
            v-if="importBusy && !importParsed.length"
            class="flex items-center gap-2 text-sm text-[var(--color-text-muted)]"
          >
            <UIcon name="i-lucide-loader" class="w-4 h-4 animate-spin" /> 正在解析…
          </div>

          <template v-if="importParsed.length > 0 || importInvalid > 0">
            <div class="flex flex-wrap items-center gap-3 text-sm">
              <span class="text-emerald-600 dark:text-emerald-400 font-medium"
                >有效 {{ importParsed.length }} 条</span
              >
              <span v-if="importInvalid > 0" class="text-amber-600 dark:text-amber-400"
                >跳过无效（缺正方/反方）{{ importInvalid }} 条</span
              >
            </div>
            <div
              class="rounded-lg border border-[var(--color-border)] overflow-hidden max-h-56 overflow-y-auto"
            >
              <table class="w-full text-xs">
                <thead class="bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
                  <tr>
                    <th class="text-left px-3 py-2 font-medium">正方</th>
                    <th class="text-left px-3 py-2 font-medium">反方</th>
                    <th class="text-left px-3 py-2 font-medium">分类</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, i) in importParsed.slice(0, 20)"
                    :key="i"
                    class="border-t border-[var(--color-border)]"
                  >
                    <td class="px-3 py-1.5 text-[var(--color-text-primary)]">
                      {{ r.affirmative }}
                    </td>
                    <td class="px-3 py-1.5 text-[var(--color-text-primary)]">{{ r.negative }}</td>
                    <td class="px-3 py-1.5 text-[var(--color-text-muted)]">
                      {{ r.category || '—' }}
                    </td>
                  </tr>
                  <tr v-if="importParsed.length > 20">
                    <td colspan="3" class="px-3 py-1.5 text-center text-[var(--color-text-muted)]">
                      … 仅预览前 20 条，共 {{ importParsed.length }} 条
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <div v-if="importResult" class="text-sm text-[var(--color-text-secondary)]">
            导入完成：新增
            <span class="text-emerald-600 dark:text-emerald-400 font-medium">{{
              importResult.created
            }}</span>
            条，跳过重复
            <span class="text-amber-600 dark:text-amber-400">{{ importResult.skipped }}</span> 条。
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center justify-end gap-3">
          <UButton color="neutral" variant="outline" @click="void (importOpen = false)"
            >关闭</UButton
          >
          <UButton
            color="primary"
            icon="i-lucide-upload"
            :loading="importBusy"
            :disabled="importParsed.length === 0"
            @click="confirmImport"
          >
            确认导入
          </UButton>
        </div>
      </template>
    </UModal>
  </template>
</template>

<style scoped>
/* ═══ 投票问卷编辑器深色主题样式（与 FormDesigner 统一） ═══ */

/* 正方/反方 徽标（编辑器与投票页共用同一类名） */
.side-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: 0.05rem 0.4rem;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 0.3rem;
  line-height: 1.4;
}
.side-badge-pro {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}
:global(.dark) .side-badge-pro {
  color: #f87171;
}
.side-badge-con {
  background: rgba(59, 130, 246, 0.15);
  color: #2563eb;
}
:global(.dark) .side-badge-con {
  color: #60a5fa;
}

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
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    background-color 0.15s;
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
