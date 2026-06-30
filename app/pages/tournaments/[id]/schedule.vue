<script setup lang="ts">
// =====================================================================
// 赛程管理页面（完整版）
// 功能：
//   1. 显示比赛列表（按轮次分组）
//   2. 手动创建单场比赛（队伍/轮次/时间）
//   3. 编辑比赛信息
//   4. 录入比赛结果（比分 + 获胜方） → 自动晋级（淘汰赛）
//   5. 删除比赛
//   6. 根据 tournament.format 切换视图：淘汰赛 → BracketView / 其他 → 列表 + StandingsTable
//   7. 前端乐观锁（单场比赛写入串行化，防止重复点击）
//   8. 自动赛程生成：单败淘汰赛 / 循环赛 / 小组+淘汰赛
// =====================================================================

const route = useRoute()
const toast = useToast()
const { getTournament, updateTournamentTeams, updateTournamentJudges, getMatches, createMatch, updateMatch, deleteMatch, restoreMatch, submitResult, generateMatches, drawLots } = useTournament()

// ─── 基本数据 ────────────────────────────────────────────────────────
const tournament = ref<any>(null)
const matches = ref<any[]>([])
const loading = ref(true)
const tournamentId = computed(() => route.params.id as string)

// ─── 参赛队伍 / 评委 在线编辑（替代原先"创建时设置"的逻辑） ─────────────
const editingTeams = ref(false)          // 是否处于编辑状态
const editingJudges = ref(false)
const newTeamInput = ref('')             // 新增队伍的输入框
const newJudgeInput = ref('')            // 新增评委的输入框
const savingTeams = ref(false)
const savingJudges = ref(false)

// 队伍列表（从 tournament.teams 读取，支持在线添加/删除）
const teamList = computed<string[]>(() => {
  const teams = tournament.value?.teams || []
  if (Array.isArray(teams) && teams.length > 0 && typeof teams[0] === 'string') {
    return teams
  }
  // 如果 teams 是对象数组（带 name 字段）
  if (Array.isArray(teams) && teams.length > 0 && teams[0]?.name) {
    return teams.map((t: any) => t.name)
  }
  return []
})

// 评委列表
const judgeList = computed<string[]>(() => {
  const judges = tournament.value?.judges || []
  if (Array.isArray(judges) && judges.length > 0 && typeof judges[0] === 'string') {
    return judges
  }
  if (Array.isArray(judges) && judges.length > 0 && judges[0]?.name) {
    return judges.map((j: any) => j.name)
  }
  return []
})

// 添加队伍
function addTeam() {
  const name = newTeamInput.value.trim()
  if (!name) return
  if (teamList.value.includes(name)) {
    toast.add({ title: '该队伍名称已存在', color: 'warning' })
    return
  }
  if (tournament.value) {
    if (!Array.isArray(tournament.value.teams)) tournament.value.teams = []
    tournament.value.teams.push(name)
  }
  newTeamInput.value = ''
}

// 删除队伍
function removeTeam(idx: number) {
  if (!tournament.value?.teams) return
  if (Array.isArray(tournament.value.teams) && typeof tournament.value.teams[0] === 'string') {
    tournament.value.teams.splice(idx, 1)
  } else if (tournament.value.teams?.[idx]?.name !== undefined) {
    tournament.value.teams.splice(idx, 1)
  }
}

// 保存队伍列表
async function saveTeams() {
  savingTeams.value = true
  try {
    await updateTournamentTeams(tournamentId.value, teamList.value)
    toast.add({ title: '队伍已保存', color: 'success' })
    editingTeams.value = false
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    savingTeams.value = false
  }
}

// 取消编辑队伍
function cancelEditTeams() {
  editingTeams.value = false
  newTeamInput.value = ''
  loadTournament()
}

// 添加评委
function addJudge() {
  const name = newJudgeInput.value.trim()
  if (!name) return
  if (judgeList.value.includes(name)) {
    toast.add({ title: '该评委已存在', color: 'warning' })
    return
  }
  if (tournament.value) {
    if (!Array.isArray(tournament.value.judges)) tournament.value.judges = []
    tournament.value.judges.push(name)
  }
  newJudgeInput.value = ''
}

// 删除评委
function removeJudge(idx: number) {
  if (!tournament.value?.judges) return
  if (Array.isArray(tournament.value.judges) && typeof tournament.value.judges[0] === 'string') {
    tournament.value.judges.splice(idx, 1)
  } else if (tournament.value.judges?.[idx]?.name !== undefined) {
    tournament.value.judges.splice(idx, 1)
  }
}

// 保存评委列表
async function saveJudges() {
  savingJudges.value = true
  try {
    await updateTournamentJudges(tournamentId.value, judgeList.value)
    toast.add({ title: '评委已保存', color: 'success' })
    editingJudges.value = false
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    savingJudges.value = false
  }
}

function cancelEditJudges() {
  editingJudges.value = false
  newJudgeInput.value = ''
  loadTournament()
}

// ─── 前端乐观锁：单场比赛的写入操作串行化 ─────────────────────────────────
const matchLocks = ref<Set<string>>(new Set())

function isMatchLocked(matchId: string): boolean { return matchLocks.value.has(matchId) }
function lockMatch(matchId: string) { matchLocks.value.add(matchId) }
function unlockMatch(matchId: string) { matchLocks.value.delete(matchId) }

/**
 * 包裹写操作：确保同场比赛的写操作串行执行
 */
async function withMatchLock<T>(matchId: string, fn: () => Promise<T>, opName: string): Promise<T | null> {
  lockMatch(matchId)
  try {
    const result = await fn()
    return result
  } catch (e: any) {
    const msg = e?.data?.statusMessage || `${opName}失败`
    toast.add({ title: msg, color: 'error' })
    return null
  } finally {
    unlockMatch(matchId)
  }
}

// ─── 计算属性：按轮次分组显示 ──────────────────────────────────────────
const matchesByRound = computed(() => {
  const map = new Map<string, any[]>()
  const sorted = [...matches.value].sort((a, b) => {
    if (a.round !== b.round) return String(a.round).localeCompare(String(b.round))
    return (a.orderNum || 0) - (b.orderNum || 0)
  })
  for (const m of sorted) {
    const roundKey = String(m.round)
    if (!map.has(roundKey)) map.set(roundKey, [])
    map.get(roundKey)!.push(m)
  }
  return Array.from(map.entries())
})

// ─── 视图模式（根据赛制自动切换） ───────────────────────────────────────
//   - single_elimination / double_elimination / group_knockout → 对阵图（bracket）
//   - round_robin / swiss / page_playoff → 列表 + 积分榜（list）
const viewMode = computed<'bracket' | 'list'>(() => {
  const f = tournament.value?.format?.toLowerCase() || ''
  if (
    f.includes('knockout') ||
    f.includes('elimination') ||
    f.includes('single') ||
    f.includes('double')
  ) {
    return 'bracket'
  }
  return 'list'
})

// 视图切换状态（仅在淘汰赛模式下可用）
const forceListView = ref(false)

// ─── 给 BracketView 用的数据（round 字段需转为 number，支持多种格式） ────
// 支持的格式：
//   - 纯数字："1", "2" (单败淘汰赛)
//   - 中文前缀："第1轮", "第2轮" (循环赛)
//   - 淘汰赛格式："淘汰赛第1轮" (小组+淘汰赛)
//   - 小组格式："A组第1轮" (小组循环赛，过滤掉只保留淘汰赛部分)
const bracketMatches = computed(() => {
  return matches.value
    .filter((m: any) => {
      // 在小组+淘汰（group_knockout）模式下，只显示淘汰赛部分的比赛
      const f = tournament.value?.format?.toLowerCase() || ''
      if (f.includes('group') && f.includes('knockout')) {
        // 明确排除小组循环赛（如 "A组第1轮" / "A组-第1轮" / "A组"）
        const roundStr = String(m.round)
        const isGroupMatch = /^[A-H]组/.test(roundStr) || roundStr.includes('小组')
        if (isGroupMatch) return false
        // 保留明确标注"淘汰赛"或纯数字轮次（如单败淘汰赛的 1/2/3）
        return roundStr.includes('淘汰赛') || /^\d+$/.test(roundStr)
      }
      return true
    })
    .map((m: any) => {
      let roundNum = 1
      const roundStr = String(m.round)
      
      // 尝试从字符串中提取第一个数字
      const digitMatch = roundStr.match(/\d+/)
      if (digitMatch) {
        roundNum = parseInt(digitMatch[0])
      } else {
        // 如果字符串中有中文轮次标识，默认给 1
        if (roundStr.includes('轮')) roundNum = 1
        else roundNum = 1
      }
      
      return { ...m, round: roundNum }
    })
})

// ─── 创建比赛 Modal ───────────────────────────────────────────────────
const showCreateModal = ref(false)
const createForm = ref({
  round: '第1轮',
  orderNum: 1,
  teamA: '',
  teamB: '',
  scheduledAt: '',
})

function openCreateModal() {
  const existingMatches = matches.value
  const currentMaxOrder = existingMatches
    .filter((m) => String(m.round) === createForm.value.round)
    .reduce((max, m) => Math.max(max, m.orderNum || 0), 0)
  createForm.value.orderNum = currentMaxOrder + 1
  createForm.value.teamA = ''
  createForm.value.teamB = ''
  createForm.value.scheduledAt = ''
  showCreateModal.value = true
}

// 从自动生成赛程切换到手动添加比赛
function switchToManualAdd() {
  showGenerateModal.value = false
  openCreateModal()
}

async function handleCreateMatch() {
  if (!createForm.value.teamA || !createForm.value.teamB) {
    toast.add({ title: '请填写两支队伍名称', color: 'error' })
    return
  }
  // ⭐ 新增：队伍不能相同
  if (createForm.value.teamA.trim() === createForm.value.teamB.trim()) {
    toast.add({ title: '两支队伍不能相同', color: 'error' })
    return
  }
  const result = await withMatchLock(`create_${Date.now()}`, async () => {
    return await createMatch(tournamentId.value, {
      round: createForm.value.round,
      orderNum: createForm.value.orderNum,
      teamA: createForm.value.teamA,
      teamB: createForm.value.teamB,
      scheduledAt: createForm.value.scheduledAt || undefined,
    })
  }, '创建比赛')

  if (result) {
    toast.add({ title: '比赛创建成功', color: 'success' })
    showCreateModal.value = false
    await loadMatches()
  }
}

// ─── 编辑比赛 Modal ───────────────────────────────────────────────────
const showEditModal = ref(false)
const editingMatch = ref<any>(null)
const editForm = ref({ round: '', orderNum: 1, teamA: '', teamB: '', scheduledAt: '' })

function openEditModal(match: any) {
  if (isMatchLocked(match.id)) {
    toast.add({ title: '该比赛正在处理中，请稍候', color: 'warning' })
    return
  }
  editingMatch.value = match
  editForm.value = {
    round: match.round,
    orderNum: match.orderNum,
    teamA: match.teamA || '',
    teamB: match.teamB || '',
    scheduledAt: match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : '',
  }
  showEditModal.value = true
}

async function handleEditMatch() {
  // ⭐ 新增：队伍不能相同
  if (editForm.value.teamA.trim() === editForm.value.teamB.trim()) {
    toast.add({ title: '两支队伍不能相同', color: 'error' })
    return
  }
  const matchId = editingMatch.value.id
  const result = await withMatchLock(matchId, async () => {
    return await updateMatch(matchId, {
      round: editForm.value.round,
      orderNum: editForm.value.orderNum,
      teamA: editForm.value.teamA || null,
      teamB: editForm.value.teamB || null,
      scheduledAt: editForm.value.scheduledAt || undefined,
    })
  }, '更新比赛')

  if (result) {
    toast.add({ title: '比赛信息已更新', color: 'success' })
    showEditModal.value = false
    editingMatch.value = null
    await loadMatches()
  }
}

// ─── 录入比分 Modal（扩展：支持最佳辩手） ─────────────────────────────
const showResultModal = ref(false)
const resultMatch = ref<any>(null)
const resultForm = ref({
  scoreA: 0, scoreB: 0, winner: 'A',
  bestDebaterA: '', bestDebaterB: '',
  judge: '',  // 评委姓名
})

function openResultModal(match: any) {
  if (isMatchLocked(match.id)) {
    toast.add({ title: '该比赛正在处理中，请稍候', color: 'warning' })
    return
  }
  resultMatch.value = match
  resultForm.value = {
    scoreA: match.scoreA || 0,
    scoreB: match.scoreB || 0,
    winner: match.winner ? (match.winner === match.teamA ? 'A' : 'B') : 'A',
    bestDebaterA: match.bestDebaterA || '',
    bestDebaterB: match.bestDebaterB || '',
    judge: match.judge || '',  // 评委姓名
  }
  showResultModal.value = true
}

async function handleSubmitResult() {
  const matchId = resultMatch.value.id
  const { scoreA, scoreB, winner, bestDebaterA, bestDebaterB, judge } = resultForm.value

  // 自动判定获胜方
  let finalWinner = winner
  if (scoreA > scoreB) finalWinner = 'A'
  else if (scoreB > scoreA) finalWinner = 'B'

  const result = await withMatchLock(matchId, async () => {
    return await submitResult(matchId, finalWinner, scoreA, scoreB, bestDebaterA || null, bestDebaterB || null, judge || null)
  }, '录入比分')

  if (result) {
    let message = '比分录入成功'
    // 如果有晋级信息，提示用户
    if (result.advanced && result.advanced.advanced) {
      message += '，胜者已自动晋级下一轮'
    }
    toast.add({ title: message, color: 'success' })
    showResultModal.value = false
    resultMatch.value = null
    await loadMatches()
  }
}

// ─── 删除比赛 ─────────────────────────────────────────────────────────
async function handleDeleteMatch(match: any) {
  if (isMatchLocked(match.id)) {
    toast.add({ title: '该比赛正在处理中，请稍候', color: 'warning' })
    return
  }

  // 二次确认：已完赛比赛
  const firstConfirm = confirm(`确定删除比赛 "${match.teamA} vs ${match.teamB}"？`)
  if (!firstConfirm) return

  if (match.status === 'finished') {
    const secondConfirm = confirm('⚠️ 该比赛已完赛，删除后将无法恢复晋级关系。确认删除？')
    if (!secondConfirm) return
  }

  await withMatchLock(match.id, async () => {
    await deleteMatch(match.id, match.version || 1)
    return true
  }, '删除比赛')

  toast.add({ title: '比赛已删除', color: 'success' })
  await loadMatches()
}

// ─── 恢复比赛 ────────────────────────────────────────────────────────
async function handleRestoreMatch(match: any) {
  if (isMatchLocked(match.id)) {
    toast.add({ title: '该比赛正在处理中，请稍候', color: 'warning' })
    return
  }
  if (!confirm(`确定恢复比赛 "${match.teamA} vs ${match.teamB}"？`)) return

  const result = await withMatchLock(match.id, async () => {
    return await restoreMatch(match.id, match.version || 1)
  }, '恢复比赛')

  if (result) {
    toast.add({ title: '比赛已恢复', color: 'success' })
    await loadMatches()
  }
}

// ─── 撤销比赛结果（占位函数） ─────────────────────────────────────────
async function handleReopenMatch(match: any) {
  toast.add({ title: '该功能开发中', color: 'info' })
}

// ─── ⭐ 自动赛程生成 Modal（支持 6 种赛制 + 动态参数配置） ───────────────
const showGenerateModal = ref(false)

// 6 种赛制的基础信息（图标 + 中文名 + 描述）
const TOURNAMENT_FORMATS = [
  {
    value: 'single_elimination',
    name: '单败淘汰赛',
    icon: 'i-lucide-trophy',
    desc: '胜者晋级，败者淘汰，经典对阵树结构',
    minTeams: 2,
    recommend: '8/16 支队伍（2 的幂）',
  },
  {
    value: 'double_elimination',
    name: '双败淘汰赛',
    icon: 'i-lucide-swords',
    desc: '胜者组 + 败者组，队伍需失败两次才被淘汰',
    minTeams: 4,
    recommend: '8/16 支队伍',
  },
  {
    value: 'round_robin',
    name: '循环赛',
    icon: 'i-lucide-repeat',
    desc: '每队与其他所有队伍各赛一场，按积分排名',
    minTeams: 3,
    recommend: '4-12 支队伍',
  },
  {
    value: 'page_playoff',
    name: '佩寄制',
    icon: 'i-lucide-git-merge',
    desc: '4 队 5 场：R1→R2/R3→R4，双败机制的简化版',
    minTeams: 4,
    recommend: '恰好 4 支队伍',
  },
  {
    value: 'swiss',
    name: '瑞士制',
    icon: 'i-lucide-shuffle',
    desc: '每轮按积分配对，强弱渐分，无需淘汰',
    minTeams: 4,
    recommend: '6-20 支队伍',
  },
  {
    value: 'group_knockout',
    name: '小组+淘汰赛',
    icon: 'i-lucide-users',
    desc: '先分组循环赛，每组前 N 名进入单败淘汰赛',
    minTeams: 4,
    recommend: '8-32 支队伍',
  },
]

// 表单状态（参赛队伍直接共用顶部的 teamList，Modal 内只读不可编辑）
const generateForm = ref({
  format: 'single_elimination' as typeof TOURNAMENT_FORMATS[number]['value'],
  // 种子排序
  seedMethod: 'rating' as 'random' | 'rating' | 'name',
  // 循环赛
  roundRobinMode: 'single' as 'single' | 'double',
  // 双败淘汰
  enableRevivalFinal: false,
  // 瑞士制
  rounds: 4,
  pairingAlgo: 'simplified' as 'standard' | 'simplified',
  // 小组+淘汰赛
  groupSize: 4,
  promotePerGroup: 2,
  // 操作参数
  clearExisting: true,
})

function openGenerateModal() {
  // ⭐ 队伍直接共用顶部的 teamList（Modal 内不再允许编辑队伍）
  // 要添加/删除队伍，去赛程页顶部的参赛队伍编辑区操作
  showGenerateModal.value = true
}


// 赛制中文名称映射（用于头部显示）
function getFormatDisplay(): { text: string; style: string } {
  const fmt = tournament.value?.format || ''
  if (!fmt) {
    // 有比赛但无赛制 → 手动添加的比赛
    if (matches.value?.length > 0) {
      return { text: '自定义赛制（手动添加）', style: 'text-amber-600 font-medium' }
    }
    // 无赛制且无比赛 → 需要用户选择
    return { text: '未设置赛制（点击"自动生成赛程"选择）', style: 'text-amber-600 font-medium' }
  }
  const matched = TOURNAMENT_FORMATS.find((f) => f.value === fmt)
  if (matched) {
    return { text: matched.name, style: 'text-primary font-medium' }
  }
  return { text: fmt, style: 'text-primary font-medium' }
}

// 计算预估比赛数（用于 UI 预览）
function estimateMatches(format: string, teamCount: number): string {
  if (teamCount < 2) return '0'
  switch (format) {
    case 'single_elimination': {
      const bracketSize = 1 << Math.ceil(Math.log2(teamCount))
      return `${bracketSize - 1} 场`
    }
    case 'double_elimination':
      return `${Math.max(0, (teamCount - 1) * 2)} 场（胜者 + 败者组）`
    case 'round_robin': {
      const m = Math.floor((teamCount * (teamCount - 1)) / 2)
      return `${m} 场（单循环） / ${m * 2} 场（双循环）`
    }
    case 'page_playoff':
      return '5 场（R1 ×2, R2, R3, R4 决赛）'
    case 'swiss': {
      const total = Math.ceil(Math.log2(teamCount))
      return `${total} 轮，每 ${Math.floor(teamCount / 2)} 场`
    }
    case 'group_knockout': {
      const size = generateForm.value.groupSize
      const groups = Math.ceil(teamCount / size)
      const groupMatches = groups * Math.floor((size * (size - 1)) / 2)
      const koTeams = Math.max(2, groups * generateForm.value.promotePerGroup)
      const koMatches = koTeams - 1
      return `${groupMatches} 场（小组赛） + ${koMatches} 场（淘汰赛）`
    }
    default:
      return '0'
  }
}

async function handleGenerate() {
  // ⭐ 直接从顶部的 teamList 读取（共用同一份数据，保证一致）
  const rawTeams = teamList.value || []

  if (rawTeams.length < 2) {
    toast.add({ title: '至少需要 2 支队伍', color: 'error' })
    return
  }

  // 佩寄制特殊校验
  if (generateForm.value.format === 'page_playoff' && rawTeams.length !== 4) {
    toast.add({ title: '佩寄制需要恰好 4 支队伍', color: 'warning' })
    // 不拦截，让用户选择
  }

  // 调用 API 生成赛程（带认证 token）
  const generatingId = `generate_${Date.now()}`
  lockMatch(generatingId)

  try {
    const teams = rawTeams.map((name, index) => ({ name, seed: index + 1 }))
    const { generateMatches } = useTournament()
    const result: any = await generateMatches(tournamentId.value, {
      format: generateForm.value.format,
      teams,
      seedMethod: generateForm.value.seedMethod,
      roundRobinMode: generateForm.value.roundRobinMode,
      enableRevivalFinal: generateForm.value.enableRevivalFinal,
      rounds: generateForm.value.rounds,
      pairingAlgo: generateForm.value.pairingAlgo,
      groupSize: generateForm.value.groupSize,
      promotePerGroup: generateForm.value.promotePerGroup,
      clearExisting: generateForm.value.clearExisting,
    })

    toast.add({
      title: `赛程生成成功：${result.data.formatLabel}，共 ${result.data.totalMatches} 场比赛`,
      color: 'success',
    })
    showGenerateModal.value = false
    forceListView.value = false
    tournament.value = null
    await loadAll()
    // 操作后根据赛制给提示
    const fmt = generateForm.value.format
    if (fmt === 'single_elimination' || fmt === 'double_elimination') {
      toast.add({ title: '提示：录入比赛结果后，胜者将自动填入下一轮对阵', color: 'info' })
    } else if (fmt === 'round_robin') {
      toast.add({ title: '提示：循环赛按积分排名，可在积分榜查看', color: 'info' })
    } else if (fmt === 'group_knockout') {
      toast.add({ title: '提示：先进行小组循环赛，每组前 2 名进入淘汰赛', color: 'info' })
    } else if (fmt === 'swiss') {
      toast.add({ title: '提示：瑞士制每轮按积分重新配对，无需淘汰', color: 'info' })
    } else if (fmt === 'page_playoff') {
      toast.add({ title: '提示：佩寄制按 R1→R2/R3→R4 决赛顺序进行', color: 'info' })
    }
  } catch (e: any) {
    const msg = e?.data?.statusMessage || '赛程生成失败'
    toast.add({ title: msg, color: 'error' })
  } finally {
    unlockMatch(generatingId)
  }
}

// ─── 数据加载 ─────────────────────────────────────────────────────────
async function loadTournament() {
  try {
    tournament.value = await getTournament(tournamentId.value)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载赛事失败', color: 'error' })
  }
}

async function loadMatches() {
  try {
    const list = await getMatches(tournamentId.value)
    matches.value = list || []
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载赛程失败', color: 'error' })
  }
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.all([loadTournament(), loadMatches()])
  } finally {
    loading.value = false
  }
}

// ─── 导出赛程为 CSV ──────────────────────────────────────────────
function exportSchedule() {
  if (!matches.value || matches.value.length === 0) {
    toast.add({ title: '暂无赛程数据可导出', color: 'error' })
    return
  }

  // CSV 表头
  const header = ['轮次', '场次', '队伍A', '队伍B', '比分A', '比分B', '胜者', '状态', '开始时间']

  // 行数据
  const statusMap: Record<string, string> = { pending: '未开始', finished: '已完赛', canceled: '已取消' }
  const rows = matches.value
    .sort((a, b) => {
      if (String(a.round) !== String(b.round)) return String(a.round).localeCompare(String(b.round))
      return (a.orderNum || 0) - (b.orderNum || 0)
    })
    .map((m) => [
      String(m.round ?? ''),
      String(m.orderNum ?? ''),
      m.teamA ?? '',
      m.teamB ?? '',
      m.scoreA ?? '',
      m.scoreB ?? '',
      m.winner ?? '',
      statusMap[m.status as string] ?? m.status ?? '',
      m.scheduledAt ?? '',
    ])

  // 组合 CSV（简单实现，支持中文字符）
  const escape = (v: any) => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const csvLines = [header.map(escape).join(',')].concat(rows.map((r) => r.map(escape).join(',')))
  const csvContent = '\uFEFF' + csvLines.join('\n') // BOM 防止 Excel 中文乱码

  // 触发下载
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const fileName = `${(tournament.value?.name || '赛程').replace(/[\\/:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.add({ title: `已导出 ${matches.value.length} 场比赛`, color: 'success' })
}

// =====================================================================
// 抽签管理 —— 分组抽签 + 辩题抽签 + 正反方抽签
// =====================================================================
const showDrawLotsModal = ref(false)
const topicCsvInput = ref<HTMLInputElement | null>(null)
const drawLotsForm = ref({
  topicPool: [] as { pro: string, con: string }[],
  newTopicPro: '',
  newTopicCon: '',
  groupCount: 2,
})

// 赛果设置 —— 最佳辩手模式
// =====================================================================
const showResultSettingsModal = ref(false)
const resultSettingsForm = ref({
  bestDebaterMode: 'both' as 'both' | 'winner_only',
})

function openResultSettingsModal() {
  const t = tournament.value
  resultSettingsForm.value = {
    bestDebaterMode: t?.bestDebaterMode || 'both',
  }
  showResultSettingsModal.value = true
}

async function saveResultSettings() {
  try {
    await $fetch(`/api/tournaments/${tournamentId}/result-settings`, {
      method: 'POST',
      body: {
        bestDebaterMode: resultSettingsForm.value.bestDebaterMode,
      },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    // 更新本地缓存的赛事信息
    if (tournament.value) {
      tournament.value.bestDebaterMode = resultSettingsForm.value.bestDebaterMode
    }
    toast.add({ title: '赛果设置已保存', color: 'success' })
    showResultSettingsModal.value = false
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  }
}

function openDrawLotsModal() {
  // 从赛事中读取已有配置
  const t = tournament.value
  let topics: { pro: string, con: string }[] = []
  try {
    if (t?.topicPool) {
      const parsed = JSON.parse(t.topicPool)
      // 兼容旧格式：字符串数组 → 转为对象数组
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        topics = parsed.map((s: string) => ({ pro: s, con: s }))
      } else if (Array.isArray(parsed)) {
        topics = parsed
      }
    }
  } catch {}

  drawLotsForm.value = {
    topicPool: topics,
    newTopicPro: '',
    newTopicCon: '',
    groupCount: t?.groupCount || 2,
  }
  showDrawLotsModal.value = true
}

function addTopic() {
  const pro = drawLotsForm.value.newTopicPro.trim()
  const con = drawLotsForm.value.newTopicCon.trim()
  if (!pro || !con) {
    toast.add({ title: '请填写正方和反方辩题', color: 'warning' })
    return
  }
  // 去重判断（根据正方辩题）
  const exists = drawLotsForm.value.topicPool.some((t) => t.pro === pro)
  if (exists) {
    toast.add({ title: '该辩题已存在', color: 'warning' })
    return
  }
  drawLotsForm.value.topicPool.push({ pro, con })
  drawLotsForm.value.newTopicPro = ''
  drawLotsForm.value.newTopicCon = ''
}

function removeTopic(idx: number) {
  drawLotsForm.value.topicPool.splice(idx, 1)
}

// —— CSV模板下载 ——
function downloadTopicTemplate() {
  // CSV模板内容：两列（正方,反方），UTF-8 BOM 确保中文正常
  const csvLines = [
    '正方辩题,反方辩题',
    '人工智能利大于弊,人工智能弊大于利',
    '顺境更利于人的成长,逆境更利于人的成长',
    '科技使人更幸福,科技使人更焦虑',
    '读万卷书不如行万里路,行万里路不如读万卷书',
  ]
  const csvContent = csvLines.join('\n')
  // 添加 BOM 防止中文乱码
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '辩题库模板.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.add({ title: 'CSV模板已下载', color: 'success' })
}

// —— CSV导入解析 ——
function handleTopicCsvUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    try {
      const lines = text.split(/\r?\n/).filter(line => line.trim())
      if (lines.length === 0) {
        toast.add({ title: 'CSV文件为空', color: 'error' })
        return
      }
      // 跳过第一行如果是标题行（包含"正方"或"pro"）
      let startIdx = 0
      const firstLine = lines[0].toLowerCase()
      if (firstLine.includes('正方') || firstLine.includes('pro') || firstLine.includes('affirmative') || firstLine.includes('正方辩题')) {
        startIdx = 1
      }
      let addedCount = 0
      let skipCount = 0
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i]
        // 简单CSV解析：按逗号分割，支持引号包裹
        const parts = parseCsvLine(line)
        if (parts.length < 2) continue
        const pro = parts[0].trim()
        const con = parts[1].trim()
        if (!pro || !con) {
          skipCount++
          continue
        }
        // 去重
        const exists = drawLotsForm.value.topicPool.some(t => t.pro === pro)
        if (exists) {
          skipCount++
          continue
        }
        drawLotsForm.value.topicPool.push({ pro, con })
        addedCount++
      }
      toast.add({
        title: `导入完成：新增 ${addedCount} 道${skipCount > 0 ? `，跳过 ${skipCount} 道` : ''}`,
        color: addedCount > 0 ? 'success' : 'warning'
      })
    } catch (err) {
      toast.add({ title: 'CSV解析失败', color: 'error' })
    } finally {
      // 重置 input，允许再次上传同一文件
      if (topicCsvInput.value) topicCsvInput.value.value = ''
    }
  }
  reader.onerror = () => {
    toast.add({ title: '文件读取失败', color: 'error' })
  }
  reader.readAsText(file, 'UTF-8')
}

// 简单CSV行解析：支持逗号分隔、引号包裹、引号内逗号
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 双引号转义
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

async function runDrawLots(drawType: 'groups' | 'topics_sides' | 'all') {
  if (drawType !== 'groups' && drawLotsForm.value.topicPool.length === 0) {
    toast.add({ title: '请先添加至少一个辩题', color: 'warning' })
    return
  }
  if (drawType === 'groups' && drawLotsForm.value.groupCount < 2) {
    toast.add({ title: '分组数量至少为 2', color: 'warning' })
    return
  }

  const payload: any = {
    drawType,
    topicPool: drawLotsForm.value.topicPool,
    groupCount: drawLotsForm.value.groupCount,
  }

  try {
    const r = await drawLots(tournamentId.value, payload)
    toast.add({
      title: `抽签成功`,
      description: r.info || '',
      color: 'success',
    })
    await loadAll()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '抽签失败', color: 'error' })
  }
}

onMounted(() => loadAll())
</script>

<template>
  <div class="min-h-screen" style="background-color: #F5F7FA;">
    <div class="max-w-[75rem] mx-auto px-6">

      <!-- ═══════════════════════ 加载状态 ═══════════════════════ -->
      <div v-if="loading" class="flex justify-center py-24">
        <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin text-gray-400" />
      </div>

      <template v-else-if="tournament">
        <!-- ═══════════════════════ 头部区域 ═══════════════════════ -->
        <header class="flex items-end justify-between pt-10 pb-5">
          <div>
            <p class="text-xs text-gray-400 mb-1">赛事管理 / ID: {{ tournament.id }}</p>
            <h1 class="text-[1.75rem] font-bold text-gray-900 leading-tight">{{ tournament.name }}</h1>
            <p class="text-sm text-gray-500 mt-1">
              <span :class="getFormatDisplay().style">{{ getFormatDisplay().text }}</span>
              ·
              共 <span class="font-medium">{{ matches.length }}</span> 场
              ·
              已完赛 <span class="font-medium text-green-600">{{ matches.filter((m: any) => m.status === 'finished').length }}</span> 场
            </p>
            <!-- 参赛队伍 & 评委显示 -->
            <p class="text-xs text-gray-400 mt-2">
              <span v-if="teamList.length">队伍：{{ teamList.join('、') }}</span>
              <span v-else>暂无参赛队伍</span>
              <span class="mx-2">·</span>
              <span v-if="judgeList.length">评委：{{ judgeList.join('、') }}</span>
              <span v-else>暂无评委</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button
              @click="loadAll"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <UIcon name="i-lucide-refresh-cw" class="w-4 h-4" /> 刷新
            </button>
            <button
              @click="exportSchedule"
              :disabled="matches.length === 0"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UIcon name="i-lucide-download" class="w-4 h-4" /> 导出 CSV
            </button>
            <!-- 🔴 新增：抽签管理 -->
            <button
              @click="openDrawLotsModal"
              class="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
            >
              <UIcon name="i-lucide-dice-5" class="w-4 h-4" /> 抽签管理
            </button>
            <!-- 🔴 新增：赛果设置 -->
            <button
              @click="openResultSettingsModal"
              class="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-2"
            >
              <UIcon name="i-lucide-settings-2" class="w-4 h-4" /> 赛果设置
            </button>
            <button
              @click="openGenerateModal"
              class="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <UIcon name="i-lucide-sparkles" class="w-4 h-4" /> 自动生成赛程
            </button>
            <button
              @click="openCreateModal"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <UIcon name="i-lucide-plus" class="w-4 h-4" /> 新增比赛
            </button>
          </div>
        </header>

        <!-- ═══════════════════════ 表格样式双层Tab导航 ═══════════════════════ -->
        <div class="tab-table-row1">
          <span class="tab-primary">基础配置</span>
          <span class="tab-primary">视听设计</span>
          <span class="tab-primary tab-primary--active">进阶功能</span>
        </div>
        <div class="tab-table-row2">
          <NuxtLink :to="`/tournaments/${tournamentId}`" class="tab-secondary">概览</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/info`" class="tab-secondary">比赛信息</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/timing`" class="tab-secondary">计时器环节</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/skin`" class="tab-secondary">背景</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/details`" class="tab-secondary">界面</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/audio`" class="tab-secondary">提示音</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/teams`" class="tab-secondary">队徽</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/schedule`" class="tab-secondary tab-secondary--active">赛程</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/offline`" class="tab-secondary">离线版</NuxtLink>
        </div>

        <!-- ═══════════════════════ 赛程内容 ═══════════════════════ -->
        <main class="py-6 space-y-6">

          <!-- ═══════════════════════ ⭐ 参赛队伍 / 评委 设置（在线编辑） ═══════════════════════ -->
          <!-- ─── 参赛队伍 ─── -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <UIcon name="i-lucide-users" class="w-4 h-4 text-gray-400" /> 参赛队伍
                <span class="text-xs font-normal text-gray-400">({{ teamList.length }} 支，支持在线添加 / 删除)</span>
              </h3>
              <button
                v-if="!editingTeams"
                @click="editingTeams = true"
                class="px-3 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition-colors flex items-center gap-1"
              >
                <UIcon name="i-lucide-pencil" class="w-3 h-3" /> 编辑
              </button>
              <template v-else>
                <div class="flex gap-2">
                  <button
                    @click="saveTeams"
                    :disabled="savingTeams"
                    class="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <UIcon name="i-lucide-check" class="w-3 h-3" /> 保存
                  </button>
                  <button
                    @click="cancelEditTeams"
                    class="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </template>
            </div>

            <!-- 查看模式：展示队伍标签 -->
            <div v-if="!editingTeams">
              <div v-if="teamList.length === 0" class="text-sm text-gray-400 py-2">暂无队伍，点击右上角「编辑」添加参赛队伍</div>
              <div v-else class="flex flex-wrap gap-2">
                <span
                  v-for="(name, idx) in teamList"
                  :key="`${name}-${idx}`"
                  class="px-3 py-1 text-sm text-gray-700 bg-blue-50 rounded-full"
                >
                  {{ name }}
                </span>
              </div>
            </div>

            <!-- 编辑模式：添加 / 删除队伍 -->
            <div v-else class="space-y-3">
              <!-- 新增输入框 -->
              <div class="flex gap-2">
                <input
                  v-model="newTeamInput"
                  @keyup.enter="addTeam"
                  type="text"
                  placeholder="输入队伍名称，按回车添加"
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  @click="addTeam"
                  class="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                >
                  <UIcon name="i-lucide-plus" class="w-4 h-4" /> 添加
                </button>
              </div>
              <!-- 已添加队伍列表 -->
              <div v-if="teamList.length === 0" class="text-sm text-gray-400 py-2 text-center border border-dashed border-gray-200 rounded-lg">
                请在上方添加参赛队伍
              </div>
              <div v-else class="flex flex-wrap gap-2">
                <span
                  v-for="(name, idx) in teamList"
                  :key="`edit-${name}-${idx}`"
                  class="inline-flex items-center gap-1.5 px-3 py-1 text-sm text-gray-700 bg-purple-50 rounded-full"
                >
                  {{ name }}
                  <button
                    @click="removeTeam(idx)"
                    class="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
              <p class="text-xs text-gray-400">💡 提示：点击 × 删除队伍，保存后生效。建议至少 2 支队伍。</p>
            </div>
          </div>

          <!-- ─── 评委 ─── -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <UIcon name="i-lucide-gavel" class="w-4 h-4 text-gray-400" /> 评委
                <span class="text-xs font-normal text-gray-400">({{ judgeList.length }} 位，支持在线添加 / 删除)</span>
              </h3>
              <button
                v-if="!editingJudges"
                @click="editingJudges = true"
                class="px-3 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition-colors flex items-center gap-1"
              >
                <UIcon name="i-lucide-pencil" class="w-3 h-3" /> 编辑
              </button>
              <template v-else>
                <div class="flex gap-2">
                  <button
                    @click="saveJudges"
                    :disabled="savingJudges"
                    class="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <UIcon name="i-lucide-check" class="w-3 h-3" /> 保存
                  </button>
                  <button
                    @click="cancelEditJudges"
                    class="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </template>
            </div>

            <!-- 查看模式 -->
            <div v-if="!editingJudges">
              <div v-if="judgeList.length === 0" class="text-sm text-gray-400 py-2">暂无评委，点击右上角「编辑」添加</div>
              <div v-else class="flex flex-wrap gap-2">
                <span
                  v-for="(name, idx) in judgeList"
                  :key="`j-${name}-${idx}`"
                  class="px-3 py-1 text-sm text-gray-700 bg-amber-50 rounded-full"
                >
                  {{ name }}
                </span>
              </div>
            </div>

            <!-- 编辑模式 -->
            <div v-else class="space-y-3">
              <div class="flex gap-2">
                <input
                  v-model="newJudgeInput"
                  @keyup.enter="addJudge"
                  type="text"
                  placeholder="输入评委姓名，按回车添加"
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  @click="addJudge"
                  class="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1"
                >
                  <UIcon name="i-lucide-plus" class="w-4 h-4" /> 添加
                </button>
              </div>
              <div v-if="judgeList.length === 0" class="text-sm text-gray-400 py-2 text-center border border-dashed border-gray-200 rounded-lg">
                请在上方添加评委
              </div>
              <div v-else class="flex flex-wrap gap-2">
                <span
                  v-for="(name, idx) in judgeList"
                  :key="`j-edit-${name}-${idx}`"
                  class="inline-flex items-center gap-1.5 px-3 py-1 text-sm text-gray-700 bg-amber-50 rounded-full"
                >
                  {{ name }}
                  <button
                    @click="removeJudge(idx)"
                    class="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
              <p class="text-xs text-gray-400">💡 提示：保存后，录入比赛结果时可从评委列表中快速选择。</p>
            </div>
          </div>

          <!-- ─── 空状态 ─── -->
          <div v-if="matches.length === 0" class="bg-white rounded-lg shadow-sm p-12 text-center">
            <UIcon name="i-lucide-calendar-days" class="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 class="text-base font-semibold text-gray-900 mb-2">暂无赛程安排</h3>
            <p class="text-sm text-gray-500 mb-6">点击下方按钮，快速生成赛程或手动添加比赛</p>
            <div class="flex justify-center gap-3">
              <button
                @click="openGenerateModal"
                class="px-5 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
              >
                <UIcon name="i-lucide-sparkles" class="w-4 h-4" /> 自动生成赛程
              </button>
              <button
                @click="openCreateModal"
                class="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <UIcon name="i-lucide-plus" class="w-4 h-4" /> 手动添加比赛
              </button>
            </div>
          </div>

          <!-- ─── 有数据：根据 viewMode 切换视图 ─── -->
          <template v-else>

            <!-- 视图切换（仅在淘汰赛模式下显示两个选项） -->
            <div v-if="viewMode === 'bracket'" class="flex gap-2 mb-2">
              <button
                @click="forceListView = false"
                class="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                :class="!forceListView ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'"
              >
                对阵图
              </button>
              <button
                @click="forceListView = true"
                class="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                :class="forceListView ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'"
              >
                列表视图
              </button>
            </div>

            <!-- 淘汰赛对阵图 -->
            <div
              v-if="viewMode === 'bracket' && !forceListView"
              class="bg-white rounded-lg shadow-sm p-6"
            >
              <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UIcon name="i-lucide-brackets" class="w-4 h-4 text-gray-400" /> 对阵图
              </h2>
              <BracketView :matches="bracketMatches" />
            </div>

            <!-- 列表视图（所有模式通用） -->
            <div v-if="viewMode !== 'bracket' || forceListView" class="space-y-4">

              <!-- 循环赛积分榜（仅在非淘汰赛模式下显示） -->
              <div v-if="viewMode === 'list'" class="bg-white rounded-lg shadow-sm p-6">
                <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <UIcon name="i-lucide-trophy" class="w-4 h-4 text-gray-400" /> 积分榜
                </h2>
                <StandingsTable :matches="matches" />
              </div>

              <!-- 比赛列表（按轮次分组） -->
              <div class="bg-white rounded-lg shadow-sm p-6">
                <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <UIcon name="i-lucide-list" class="w-4 h-4 text-gray-400" /> 比赛详情
                </h2>

                <div v-for="[round, roundMatches] in matchesByRound" :key="round" class="mb-8 last:mb-0">
                  <div class="flex items-center gap-3 mb-3">
                    <span class="text-sm font-bold text-primary bg-blue-50 px-3 py-1 rounded">{{ round }}</span>
                    <span class="text-xs text-gray-400">{{ (roundMatches as any[]).length }} 场</span>
                  </div>

                  <div class="space-y-2">
                    <div
                      v-for="match in roundMatches"
                      :key="match.id"
                      class="match-card border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                      :class="{
                        'opacity-60': isMatchLocked(match.id),
                        'bg-green-50/40 border-green-200': match.status === 'finished',
                        'opacity-50 grayscale bg-gray-50 border-gray-300': match.deletedAt,
                      }"
                    >
                      <!-- 锁定状态指示 -->
                      <div v-if="isMatchLocked(match.id)" class="absolute top-2 right-2 z-10">
                        <UIcon name="i-lucide-loader" class="w-4 h-4 animate-spin text-blue-500" />
                      </div>

                      <!-- 已删除状态标签 -->
                      <div v-if="match.deletedAt" class="flex items-center gap-2 mb-2">
                        <span class="text-[10px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">已删除</span>
                        <span class="text-[10px] text-gray-400">{{ new Date(match.deletedAt).toLocaleString('zh-CN') }}</span>
                      </div>

                      <div class="flex items-center justify-between">
                        <!-- 比赛信息 -->
                        <div class="flex-1">
                          <!-- ⭐ 新增：辩题 + 正反方显示 -->
                          <div v-if="match.topic" class="mb-2">
                            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-100 rounded">
                              <UIcon name="i-lucide-file-text" class="w-3 h-3" />
                              {{ match.topic }}
                            </div>
                          </div>

                          <div class="flex items-center gap-4">
                            <!-- Team A -->
                            <div class="text-right min-w-[120px]">
                              <span
                                class="font-semibold text-gray-900"
                                :class="{ 'text-green-600 font-bold': match.status === 'finished' && match.winner === match.teamA }"
                              >{{ match.teamA || '待定' }}</span>
                              <div v-if="match.affirmativeSide" class="text-[10px] text-gray-400 mt-0.5">
                                {{ match.affirmativeSide === 'teamA' ? '正方' : '反方' }}
                              </div>
                            </div>

                            <!-- 比分 / VS -->
                            <div class="text-center min-w-[80px]">
                              <div v-if="match.status === 'finished'" class="text-xl font-bold text-gray-800">
                                {{ match.scoreA ?? 0 }} : {{ match.scoreB ?? 0 }}
                              </div>
                              <div v-else class="text-sm text-gray-400 font-medium">VS</div>
                            </div>

                            <!-- Team B -->
                            <div class="text-left min-w-[120px]">
                              <span
                                class="font-semibold text-gray-900"
                                :class="{ 'text-green-600 font-bold': match.status === 'finished' && match.winner === match.teamB }"
                              >{{ match.teamB || '待定' }}</span>
                              <div v-if="match.affirmativeSide" class="text-[10px] text-gray-400 mt-0.5">
                                {{ match.affirmativeSide === 'teamB' ? '正方' : '反方' }}
                              </div>
                            </div>
                          </div>

                          <!-- ⭐ 最佳辩手显示 -->
                          <div v-if="match.status === 'finished' && (match.bestDebaterA || match.bestDebaterB)" class="flex items-center gap-2 mt-2">
                            <span class="text-[10px] text-amber-700 font-medium flex items-center gap-1">
                              <UIcon name="i-lucide-trophy" class="w-3 h-3" />
                              最佳辩手：
                            </span>
                            <template v-if="match.bestDebaterA">
                              <span class="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                {{ match.teamA || 'A' }} - {{ match.bestDebaterA }}
                              </span>
                            </template>
                            <template v-if="match.bestDebaterB">
                              <span class="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                {{ match.teamB || 'B' }} - {{ match.bestDebaterB }}
                              </span>
                            </template>
                          </div>

                          <!-- 时间和状态 -->
                          <div class="flex items-center gap-3 mt-2 ml-0 pl-0">
                            <span
                              class="text-xs px-2 py-0.5 rounded-full"
                              :class="match.status === 'finished' ? 'bg-green-100 text-green-700' : match.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'"
                            >
                              {{ match.status === 'finished' ? '已完赛' : match.status === 'running' ? '进行中' : '待开始' }}
                            </span>
                            <span v-if="match.scheduledAt" class="text-xs text-gray-400 flex items-center gap-1">
                              <UIcon name="i-lucide-clock" class="w-3 h-3" />
                              {{ new Date(match.scheduledAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}
                            </span>
                            <span class="text-xs text-gray-400">#{{ match.orderNum }}</span>
                          </div>
                        </div>

                        <!-- 操作按钮 -->
                        <div class="flex items-center gap-2">
                          <!-- 已删除比赛：显示恢复按钮，隐藏其他操作 -->
                          <template v-if="match.deletedAt">
                            <button
                              @click="handleRestoreMatch(match)"
                              :disabled="isMatchLocked(match.id)"
                              class="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <UIcon name="i-lucide-rotate-ccw" class="w-3.5 h-3.5" /> 恢复
                            </button>
                          </template>

                          <!-- 未删除比赛：显示原有操作按钮 -->
                          <template v-else>
                            <button
                              v-if="match.status === 'finished'"
                              @click="handleReopenMatch(match)"
                              :disabled="isMatchLocked(match.id)"
                              class="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <UIcon name="i-lucide-undo" class="w-3.5 h-3.5" /> 撤销
                            </button>
                            <button
                              @click="openResultModal(match)"
                              :disabled="isMatchLocked(match.id)"
                              class="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <UIcon name="i-lucide-check-circle" class="w-3.5 h-3.5" /> 录分
                            </button>
                            <button
                              @click="openEditModal(match)"
                              :disabled="isMatchLocked(match.id)"
                              class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <UIcon name="i-lucide-edit" class="w-3.5 h-3.5" /> 编辑
                            </button>
                            <button
                              @click="handleDeleteMatch(match)"
                              :disabled="isMatchLocked(match.id)"
                              class="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" /> 删除
                            </button>
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </main>
      </template>
    </div>

    <!-- ═══════════════════════ 创建比赛 Modal ═══════════════════════ -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showCreateModal = false">
      <div class="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">新增比赛</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">轮次</label>
              <input v-model="createForm.round" type="text" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：第1轮" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">序号</label>
              <input v-model.number="createForm.orderNum" type="number" min="1" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <!-- ⭐ 队伍 A：从已设置的参赛队伍中选择 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              队伍 A（左方） <span class="text-red-500">*</span>
              <span v-if="teamList.length === 0" class="text-xs text-amber-600 ml-1">（请先在赛程页顶部设置参赛队伍）</span>
            </label>
            <select
              v-model="createForm.teamA"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              :class="{ 'border-red-400 bg-red-50/50': createForm.teamA && createForm.teamA === createForm.teamB }"
            >
              <option value="">请选择队伍</option>
              <option v-for="(name, idx) in teamList" :key="`ca-${name}-${idx}`" :value="name">{{ name }}</option>
            </select>
          </div>

          <!-- ⭐ 队伍 B：从已设置的参赛队伍中选择 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              队伍 B（右方） <span class="text-red-500">*</span>
            </label>
            <select
              v-model="createForm.teamB"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              :class="{ 'border-red-400 bg-red-50/50': createForm.teamB && createForm.teamA === createForm.teamB }"
            >
              <option value="">请选择队伍</option>
              <option v-for="(name, idx) in teamList" :key="`cb-${name}-${idx}`" :value="name">{{ name }}</option>
            </select>
          </div>
          <p v-if="createForm.teamA && createForm.teamB && createForm.teamA === createForm.teamB" class="text-xs text-red-600 mt-1 text-center col-span-2">
            ⚠️ 两支队伍不能相同
          </p>

          <!-- 比赛时间：必填 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              比赛时间 <span class="text-red-500">*</span>
            </label>
            <input v-model="createForm.scheduledAt" type="datetime-local" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button @click="showCreateModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
          <button
            @click="handleCreateMatch"
            :disabled="!createForm.teamA || !createForm.teamB || !createForm.scheduledAt || createForm.teamA === createForm.teamB"
            class="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认创建
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════ 编辑比赛 Modal ═══════════════════════ -->
    <div v-if="showEditModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showEditModal = false">
      <div class="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">编辑比赛</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">轮次</label>
              <input v-model="editForm.round" type="text" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">序号</label>
              <input v-model.number="editForm.orderNum" type="number" min="1" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <!-- ⭐ 队伍 A：从已设置的参赛队伍中选择 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              队伍 A <span class="text-red-500">*</span>
            </label>
            <select
              v-model="editForm.teamA"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              :class="{ 'border-red-400 bg-red-50/50': editForm.teamA && editForm.teamA === editForm.teamB }"
            >
              <option value="">请选择队伍</option>
              <option v-for="(name, idx) in teamList" :key="`ea-${name}-${idx}`" :value="name">{{ name }}</option>
            </select>
          </div>

          <!-- ⭐ 队伍 B：从已设置的参赛队伍中选择 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              队伍 B <span class="text-red-500">*</span>
            </label>
            <select
              v-model="editForm.teamB"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              :class="{ 'border-red-400 bg-red-50/50': editForm.teamB && editForm.teamA === editForm.teamB }"
            >
              <option value="">请选择队伍</option>
              <option v-for="(name, idx) in teamList" :key="`eb-${name}-${idx}`" :value="name">{{ name }}</option>
            </select>
          </div>
          <p v-if="editForm.teamA && editForm.teamB && editForm.teamA === editForm.teamB" class="text-xs text-red-600 mt-1 text-center col-span-2">
            ⚠️ 两支队伍不能相同
          </p>
          <!-- 比赛时间：必填 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              比赛时间 <span class="text-red-500">*</span>
            </label>
            <input v-model="editForm.scheduledAt" type="datetime-local" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button @click="showEditModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
          <button
            @click="handleEditMatch"
            :disabled="!editForm.teamA || !editForm.teamB || !editForm.scheduledAt || editForm.teamA === editForm.teamB"
            class="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认保存
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════ 录入比分 Modal（扩展：最佳辩手） ═══════════════════════ -->
    <div v-if="showResultModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showResultModal = false">
      <div class="bg-white rounded-xl shadow-lg w-full max-w-lg p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-1">录入比分</h3>
        <p class="text-sm text-gray-500 mb-5">{{ resultMatch?.teamA || '待定' }} vs {{ resultMatch?.teamB || '待定' }}</p>
        <div class="space-y-5">
          <div class="grid grid-cols-2 gap-6">
            <div class="text-center">
              <label class="block text-sm font-medium text-gray-700 mb-2">{{ resultMatch?.teamA || '队伍A' }}</label>
              <input v-model.number="resultForm.scoreA" type="number" min="0" class="w-full text-center text-3xl font-bold py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div class="text-center">
              <label class="block text-sm font-medium text-gray-700 mb-2">{{ resultMatch?.teamB || '队伍B' }}</label>
              <input v-model.number="resultForm.scoreB" type="number" min="0" class="w-full text-center text-3xl font-bold py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">获胜方</label>
            <div class="grid grid-cols-3 gap-2">
              <button @click="resultForm.winner = 'A'" class="px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-all" :class="resultForm.winner === 'A' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'">
                {{ resultMatch?.teamA || '队伍A' }} 胜
              </button>
              <button @click="resultForm.winner = 'draw'" class="px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-all" :class="resultForm.winner === 'draw' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'">
                平局
              </button>
              <button @click="resultForm.winner = 'B'" class="px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-all" :class="resultForm.winner === 'B' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'">
                {{ resultMatch?.teamB || '队伍B' }} 胜
              </button>
            </div>
            <p class="text-xs text-gray-400 mt-2">提示：系统将根据比分自动判定获胜方</p>
          </div>

          <!-- ⭐ 新增：最佳辩手 -->
          <div class="border-t border-gray-100 pt-4">
            <label class="block text-sm font-medium text-gray-700 mb-3">最佳辩手（选填）</label>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-500 mb-1">{{ resultMatch?.teamA || '队伍A' }} 最佳辩手</label>
                <input
                  v-model="resultForm.bestDebaterA"
                  type="text"
                  placeholder="选手姓名"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">{{ resultMatch?.teamB || '队伍B' }} 最佳辩手</label>
                <input
                  v-model="resultForm.bestDebaterB"
                  type="text"
                  placeholder="选手姓名"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">
              当前模式：{{ tournament?.bestDebaterMode === 'winner_only' ? '仅胜方可有最佳辩手' : '双方均可有最佳辩手' }}
            </p>
          </div>

          <!-- ⭐ 新增：评委姓名 -->
          <div class="border-t border-gray-100 pt-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">评委姓名</label>
            <div class="flex gap-2">
              <input
                v-model="resultForm.judge"
                type="text"
                placeholder="请输入评委姓名"
                class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <!-- 若赛事已定义评委列表，提供快速选择 -->
              <select
                v-if="tournament?.judges?.length > 0"
                @change="(e: any) => resultForm.judge = (e.target as HTMLSelectElement).value"
                class="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">从评委中选择</option>
                <option v-for="j in tournament.judges" :key="j.id" :value="j.name">{{ j.name }}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button @click="showResultModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
          <button @click="handleSubmitResult" class="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">确认比分</button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════ 🔴 抽签管理 Modal ═══════════════════════ -->
    <div v-if="showDrawLotsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showDrawLotsModal = false">
      <div class="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold text-gray-900 mb-1">抽签管理</h3>
        <p class="text-sm text-gray-500 mb-5">配置辩题库、分组数量、最佳辩手模式，然后执行抽签</p>

        <div class="space-y-6">
          <!-- 1. 辩题库 -->
          <div class="bg-amber-50/30 rounded-lg p-4 border border-amber-200/60">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <UIcon name="i-lucide-file-text" class="w-4 h-4 text-amber-600" /> 辩题库
                <span class="text-xs font-normal text-gray-500">({{ drawLotsForm.topicPool.length }} 道题)</span>
              </h4>
              <div class="flex gap-1.5">
                <button
                  @click="downloadTopicTemplate"
                  class="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors flex items-center gap-1"
                >
                  <UIcon name="i-lucide-download" class="w-3 h-3" /> CSV模板
                </button>
                <label
                  class="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <UIcon name="i-lucide-upload" class="w-3 h-3" /> 导入CSV
                  <input
                    ref="topicCsvInput"
                    type="file"
                    accept=".csv,.txt"
                    class="hidden"
                    @change="handleTopicCsvUpload"
                  />
                </label>
              </div>
            </div>
            <div class="space-y-2 mb-3">
              <div class="flex gap-2">
                <span class="inline-flex items-center justify-center px-2 text-xs font-bold bg-green-600 text-white rounded">正</span>
                <input
                  v-model="drawLotsForm.newTopicPro"
                  @keyup.enter="addTopic"
                  type="text"
                  placeholder="正方辩题，例如：人工智能利大于弊"
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div class="flex gap-2">
                <span class="inline-flex items-center justify-center px-2 text-xs font-bold bg-red-600 text-white rounded">反</span>
                <input
                  v-model="drawLotsForm.newTopicCon"
                  @keyup.enter="addTopic"
                  type="text"
                  placeholder="反方辩题，例如：人工智能弊大于利"
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div class="flex justify-end mb-3">
              <button @click="addTopic" class="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap">
                + 添加
              </button>
            </div>
            <div v-if="drawLotsForm.topicPool.length > 0" class="flex flex-wrap gap-2">
              <div
                v-for="(topic, idx) in drawLotsForm.topicPool"
                :key="topic.pro"
                class="inline-flex items-start gap-1.5 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg shadow-sm max-w-full"
              >
                <div class="flex flex-col gap-0.5 flex-1">
                  <span class="flex items-center gap-1.5"><span class="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-green-600 text-white rounded shrink-0">正方</span> <span class="text-gray-700">{{ topic.pro }}</span></span>
                  <span class="flex items-center gap-1.5"><span class="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded shrink-0">反方</span> <span class="text-gray-700">{{ topic.con }}</span></span>
                </div>
                <button @click="removeTopic(idx)" class="text-gray-400 hover:text-red-500 transition-colors ml-1 shrink-0">
                  <UIcon name="i-lucide-x" class="w-3 h-3" />
                </button>
              </div>
            </div>
            <p v-else class="text-xs text-gray-400 italic">暂无辩题，请添加或导入CSV</p>
          </div>

          <!-- 2. 分组配置 -->
          <div class="bg-gray-50 rounded-lg p-4">
            <label class="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
              <UIcon name="i-lucide-users" class="w-4 h-4 text-blue-600" /> 分组数量
            </label>
            <div class="flex items-center gap-3">
              <input
                v-model.number="drawLotsForm.groupCount"
                type="number"
                min="2"
                max="8"
                class="w-24 px-3 py-2 text-sm text-center font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-xs text-gray-500">个小组（适用于循环赛 / 小组+淘汰赛）</span>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex flex-col gap-2 mt-6 pt-4 border-t border-gray-100">
          <div class="grid grid-cols-3 gap-2">
            <button
              @click="runDrawLots('groups')"
              class="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              只分组抽签
            </button>
            <button
              @click="runDrawLots('topics_sides')"
              class="px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
            >
              辩题+正反方抽签
            </button>
            <button
              @click="runDrawLots('all')"
              class="px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              一键全部抽签
            </button>
          </div>
          <button @click="showDrawLotsModal = false" class="w-full mt-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            关闭
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════ 🔴 赛果设置 Modal ═══════════════════════ -->
    <div v-if="showResultSettingsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showResultSettingsModal = false">
      <div class="bg-white rounded-xl shadow-lg w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <!-- 头部 -->
        <div class="flex items-center gap-2 mb-2">
          <UIcon name="i-lucide-trophy" class="w-5 h-5 text-rose-600" />
          <h3 class="text-lg font-bold text-gray-900">赛果设置</h3>
        </div>
        <p class="text-sm text-gray-500 mb-6">配置赛果录入时的规则，包括最佳辩手的评选方式</p>

        <div class="space-y-6">
          <!-- 最佳辩手模式 -->
          <div class="bg-gray-50 rounded-lg p-4">
            <label class="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
              <UIcon name="i-lucide-award" class="w-4 h-4 text-amber-600" /> 最佳辩手评选方式
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                @click="resultSettingsForm.bestDebaterMode = 'both'"
                class="px-4 py-3 text-sm font-medium rounded-lg border-2 transition-all text-left"
                :class="resultSettingsForm.bestDebaterMode === 'both' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-600 hover:bg-gray-100'"
              >
                双方均可有最佳辩手
              </button>
              <button
                @click="resultSettingsForm.bestDebaterMode = 'winner_only'"
                class="px-4 py-3 text-sm font-medium rounded-lg border-2 transition-all text-left"
                :class="resultSettingsForm.bestDebaterMode === 'winner_only' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-600 hover:bg-gray-100'"
              >
                仅胜方可有最佳辩手
              </button>
            </div>
          </div>

          <!-- 说明 -->
          <div class="p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 leading-relaxed">
            <p class="mb-1"><strong>双方均可有最佳辩手：</strong>胜方和败方都可以评选最佳辩手，用于展示双方优秀选手的表现。</p>
            <p><strong>仅胜方可有最佳辩手：</strong>只有胜方可以评选最佳辩手，败方不设置最佳辩手字段。</p>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button
            @click="showResultSettingsModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >取消</button>
          <button
            @click="saveResultSettings"
            class="px-5 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-2"
          >
            <UIcon name="i-lucide-check" class="w-4 h-4" /> 保存设置
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════ ⭐ 自动赛程生成 Modal ═══════════════════════ -->
    <!-- ═══════════════════ 自动赛程生成 Modal ═══════════════════ -->
    <div v-if="showGenerateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showGenerateModal = false">
      <div class="bg-white rounded-xl shadow-lg w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
        <!-- 头部 -->
        <div class="flex items-center gap-2 mb-2">
          <UIcon name="i-lucide-sparkles" class="w-5 h-5 text-purple-600" />
          <h3 class="text-lg font-bold text-gray-900">自动生成赛程</h3>
        </div>
        <p class="text-sm text-gray-500 mb-4">选择赛制，输入参赛队伍，系统将自动生成完整对阵表并按轮次分组</p>
        <!-- 切换到手动添加入口 -->
        <div class="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm flex items-center justify-between">
          <span class="text-gray-600">想要自己逐场添加？</span>
          <button
            @click="switchToManualAdd"
            class="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <UIcon name="i-lucide-arrow-right" class="w-4 h-4" /> 切换到手动添加比赛
          </button>
        </div>

        <div class="space-y-6">
          <!-- ═══ 1. 赛制卡片选择（6 种） ═══ -->
          <div>
            <label class="block text-sm font-semibold text-gray-800 mb-3">① 选择赛制</label>
            <div class="grid grid-cols-3 gap-3">
              <button
                v-for="(fmt, idx) in TOURNAMENT_FORMATS"
                :key="fmt.value"
                @click="generateForm.format = fmt.value"
                class="p-4 text-sm rounded-lg border-2 transition-all text-left"
                :class="generateForm.format === fmt.value
                  ? 'border-purple-500 bg-purple-50 text-purple-900 shadow-sm'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'"
              >
                <div class="flex items-center gap-2 mb-2">
                  <UIcon :name="fmt.icon" class="w-4 h-4" :class="generateForm.format === fmt.value ? 'text-purple-600' : 'text-gray-400'" />
                  <span class="font-bold text-gray-900">{{ fmt.name }}</span>
                </div>
                <p class="text-xs text-gray-500 leading-relaxed mb-2">{{ fmt.desc }}</p>
                <p class="text-xs text-gray-400">推荐：{{ fmt.recommend }}</p>
              </button>
            </div>
          </div>

          <!-- ═══ 2. 参赛队伍（直接共用顶部的 teamList，Modal 内只读） ═══ -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-semibold text-gray-800">
                ② 参赛队伍（与顶部设置一致，需改队伍请先关闭本弹窗到顶部操作）
                <span v-if="teamList.length > 0" class="text-xs text-green-600 font-normal ml-1">✓ 已同步顶部设置</span>
              </label>
              <span class="text-xs font-medium text-purple-600">{{ teamList.length }} 支</span>
            </div>

            <!-- 队伍列表展示（只读，chip 标签，无删除按钮） -->
            <div v-if="teamList.length === 0" class="py-3 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
              暂未设置参赛队伍，请先关闭本弹窗，到赛程页顶部的「参赛队伍」区添加
            </div>
            <div v-else class="flex flex-wrap gap-2 py-1">
              <span
                v-for="(name, idx) in teamList"
                :key="`gen-sync-${name}-${idx}`"
                class="inline-flex items-center px-3 py-1 text-sm text-gray-700 bg-purple-50 rounded-full"
              >
                {{ name }}
              </span>
            </div>

            <!-- 预览提示（用 teamList.length 计数） -->
            <div class="flex items-center justify-between mt-3">
              <p class="text-xs text-gray-500">
                💡 提示：淘汰赛建议 2 的幂次（2/4/8/16/32）；非 2 的幂次将自动生成轮空位
              </p>
              <p class="text-xs text-purple-700 font-medium">
                预计 {{ estimateMatches(generateForm.format, teamList.length) }}
              </p>
            </div>
          </div>

          <!-- ═══ 3. 通用参数（种子排序） ═══ -->
          <div>
            <label class="block text-sm font-semibold text-gray-800 mb-3">③ 种子排序方式</label>
            <div class="grid grid-cols-3 gap-3">
              <button
                @click="generateForm.seedMethod = 'rating'"
                class="px-3 py-2 text-sm rounded-lg border transition-all"
                :class="generateForm.seedMethod === 'rating'
                  ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
              >按输入顺序（默认）</button>
              <button
                @click="generateForm.seedMethod = 'random'"
                class="px-3 py-2 text-sm rounded-lg border transition-all"
                :class="generateForm.seedMethod === 'random'
                  ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
              >随机</button>
              <button
                @click="generateForm.seedMethod = 'name'"
                class="px-3 py-2 text-sm rounded-lg border transition-all"
                :class="generateForm.seedMethod === 'name'
                  ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
              >按名称字典序</button>
            </div>
          </div>

          <!-- ═══ 4. 赛制专属参数（按选中格式动态显示） ═══ -->
          <!-- 4-1. 循环赛：单/双循环 -->
          <div v-if="generateForm.format === 'round_robin'">
            <label class="block text-sm font-semibold text-gray-800 mb-3">④ 循环赛参数</label>
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                <button
                  @click="generateForm.roundRobinMode = 'single'"
                  class="px-4 py-2 text-sm rounded-lg border transition-all"
                  :class="generateForm.roundRobinMode === 'single'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                >单循环（推荐）</button>
                <button
                  @click="generateForm.roundRobinMode = 'double'"
                  class="px-4 py-2 text-sm rounded-lg border transition-all"
                  :class="generateForm.roundRobinMode === 'double'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                >双循环（主客场）</button>
              </div>
              <p class="text-xs text-gray-500 ml-1">双循环比赛场次是单循环的 2 倍，每支队伍相遇两次（主客场各一次）</p>
            </div>
          </div>

          <!-- 4-2. 双败淘汰赛：是否启用复活赛决赛 -->
          <div v-if="generateForm.format === 'double_elimination'">
            <label class="block text-sm font-semibold text-gray-800 mb-3">④ 双败淘汰参数</label>
            <div class="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <input
                v-model="generateForm.enableRevivalFinal"
                type="checkbox"
                class="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label class="text-sm text-gray-700">启用「复活赛决赛」（败者组冠军若击败胜者组冠军，再赛一场）</label>
            </div>
          </div>

          <!-- 4-3. 瑞士制：总轮数 + 配对算法 -->
          <div v-if="generateForm.format === 'swiss'">
            <label class="block text-sm font-semibold text-gray-800 mb-3">④ 瑞士制参数</label>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-600 mb-1.5">总轮数</label>
                <input
                  type="number"
                  v-model.number="generateForm.rounds"
                  min="1"
                  max="20"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p class="text-xs text-gray-400 mt-1.5">推荐：⌈log₂(队伍数)⌉ 轮（如 8 队 → 3 轮）</p>
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1.5">配对算法</label>
                <select
                  v-model="generateForm.pairingAlgo"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="simplified">简化版（按积分直接配对）</option>
                  <option value="standard">标准版（严格避免重复对阵）</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 4-4. 小组+淘汰赛：每组队伍数 + 晋级数 -->
          <div v-if="generateForm.format === 'group_knockout'">
            <label class="block text-sm font-semibold text-gray-800 mb-3">④ 小组+淘汰赛参数</label>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-600 mb-1.5">每组队伍数</label>
                <select
                  v-model.number="generateForm.groupSize"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option :value="2">2 支</option>
                  <option :value="3">3 支</option>
                  <option :value="4">4 支（推荐）</option>
                  <option :value="5">5 支</option>
                  <option :value="6">6 支</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1.5">每组晋级数</label>
                <select
                  v-model.number="generateForm.promotePerGroup"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option :value="1">1 支</option>
                  <option :value="2">2 支（推荐）</option>
                  <option :value="3">3 支</option>
                </select>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-2">
              ① 先按蛇形分组进行循环赛；② 每组前 {{ generateForm.promotePerGroup }} 名进入单败淘汰赛，按交叉对阵规则决出冠军
            </p>
          </div>

          <!-- 4-5. 佩寄制 / 单败淘汰赛：专用提示 -->
          <div v-if="generateForm.format === 'page_playoff'">
            <label class="block text-sm font-semibold text-gray-800 mb-3">④ 佩寄制说明</label>
            <div class="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 leading-relaxed">
              <p class="font-semibold mb-1">经典 4 队 5 场流程：</p>
              <p>• R1：第 1 名 vs 第 4 名，第 2 名 vs 第 3 名</p>
              <p>• R2：R1 两位胜者对决（胜者直接进入 R4 决赛）</p>
              <p>• R3：R2 败者 vs R1 败者中获胜的队伍</p>
              <p>• R4 决赛：R2 胜者 vs R3 胜者</p>
              <p class="mt-1 text-purple-700">⚠️ 佩寄制只在恰好 4 支队伍时有效，否则将降级为单败淘汰赛</p>
            </div>
          </div>

          <div v-if="generateForm.format === 'single_elimination'">
            <label class="block text-sm font-semibold text-gray-800 mb-3">④ 单败淘汰赛提示</label>
            <div class="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 leading-relaxed">
              <p>• 当前 {{ teamList.length }} 支队伍，预计生成 {{ estimateMatches('single_elimination', teamList.length) }}</p>
              <p>• 若队伍数不是 2 的幂，首轮将自动生成轮空位（BYE），让种子高的队伍直接晋级</p>
              <p>• 录入比赛结果后，胜者将自动填入下一轮对阵位置</p>
            </div>
          </div>

          <!-- ═══ 5. 操作参数：清空已有赛程 ═══ -->
          <div class="flex items-center gap-2 pt-2">
            <input
              v-model="generateForm.clearExisting"
              type="checkbox"
              class="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <label class="text-sm text-gray-700">覆盖当前已有赛程（推荐选中，避免与旧赛程混合）</label>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          <button
            @click="showGenerateModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >取消</button>
          <button
            @click="handleGenerate"
            class="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <UIcon name="i-lucide-zap" class="w-4 h-4" /> 生成赛程
          </button>
        </div>
      </div>
    </div>
    <!-- ═══════════════════ / 自动赛程生成 Modal ═══════════════════ -->
  </div>
</template>

<style scoped>
/* ═══════════════════ 表格样式双层Tab导航 ═══════════════════ */
.tab-table-row1 {
  display: grid;
  grid-template-columns: 3fr 4fr 2fr;
  border: 1px solid #D1D5DB;
  border-bottom: none;
  background: #F9FAFB;
}

.tab-primary {
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  color: #6B7280;
  cursor: default;
  border-right: 1px solid #D1D5DB;
  pointer-events: none;
  user-select: none;
}

.tab-primary:last-child { border-right: none; }

.tab-primary--active {
  color: #1F2937;
  background: #FFFFFF;
  border-bottom: 2px solid #3B82F6;
}

.tab-table-row2 {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  border: 1px solid #D1D5DB;
  border-top: none;
  background: #FFFFFF;
}

.tab-secondary {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: center;
  color: #6B7280;
  cursor: pointer;
  border-right: 1px solid #E5E7EB;
  text-decoration: none;
  transition: background 0.2s, color 0.2s;
}

.tab-secondary:last-child { border-right: none; }
.tab-secondary:hover { color: #374151; background: #F3F4F6; }
.tab-secondary--active { color: #3B82F6; background: #EFF6FF; font-weight: 600; }

/* ═══════════════════ 比赛卡片样式 ═══════════════════ */
.match-card {
  position: relative;
}
</style>
