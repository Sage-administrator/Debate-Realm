<!--
  评委评分页面
  功能：
  - 评委输入姓名后查看分配的比赛
  - 对每场比赛进行多维评分
  - 查看已提交的评分
-->
<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const toast = useToast()

const tournamentId = computed(() => route.params.id as string)

// ── 状态 ──
const judgeName = ref('')
const judgeNameInput = ref('')
const step = ref<'login' | 'list' | 'scoring'>('login')
const loading = ref(false)
const submitting = ref(false)
const tournament = ref<any>(null)
const matches = ref<any[]>([])
const stats = ref({ total: 0, scored: 0, pending: 0 })
const selectedMatch = ref<any>(null)

// ── 评分表单 ──
const scoreForm = reactive({
  dimensions: [] as any[],
  scoreTeamA: 0,
  scoreTeamB: 0,
  winner: 'teamA' as 'teamA' | 'teamB' | 'draw',
  bestDebaterA: '',
  bestDebaterB: '',
  reason: '',
})

// ── 默认评分维度 ──
const defaultDimensions = [
  { name: '逻辑论证', score: 0 },
  { name: '语言表达', score: 0 },
  { name: '临场反应', score: 0 },
  { name: '团队配合', score: 0 },
  { name: '风度仪态', score: 0 },
]

// ── 计算总分 ──
function calcTotalA() {
  return scoreForm.dimensions.reduce((sum, d) => sum + (d.scoreA || 0), 0)
}
function calcTotalB() {
  return scoreForm.dimensions.reduce((sum, d) => sum + (d.scoreB || 0), 0)
}

// ── 赛制中文名 ──
const formatLabels: Record<string, string> = {
  single_elimination: '单败淘汰赛',
  double_elimination: '双败淘汰赛',
  round_robin: '循环赛',
  page_playoff: '佩寄制',
  swiss: '瑞士制',
  group_knockout: '小组+淘汰赛',
}

// ── 状态中文标签 ──
const statusLabels: Record<string, string> = {
  pending: '未开始',
  ongoing: '进行中',
  finished: '已结束',
}

// ── 评委登录 ──
async function judgeLogin() {
  if (!judgeNameInput.value.trim()) {
    toast.add({ title: '请输入您的姓名', color: 'warning' })
    return
  }
  judgeName.value = judgeNameInput.value.trim()
  await loadMatches()
}

// ── 加载比赛列表 ──
async function loadMatches() {
  loading.value = true
  try {
    const res: any = await $fetch(`/api/tournaments/${tournamentId.value}/judge/matches`, {
      query: { judgeName: judgeName.value },
    })
    if (res.success) {
      tournament.value = res.data.tournament
      matches.value = res.data.matches
      stats.value = res.data.stats
      step.value = 'list'
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ── 开始评分 ──
function startScoring(match: any) {
  if (match.scored) {
    // 已评分，显示已填的数据
    const s = match.myScore
    scoreForm.dimensions = s.dimensions ? JSON.parse(s.dimensions) : defaultDimensions.map(d => ({ ...d }))
    scoreForm.winner = s.winner
    scoreForm.bestDebaterA = s.bestDebaterA || ''
    scoreForm.bestDebaterB = s.bestDebaterB || ''
    scoreForm.reason = s.reason || ''
  } else {
    // 新评分，初始化维度
    scoreForm.dimensions = defaultDimensions.map(d => ({ name: d.name, scoreA: 0, scoreB: 0 }))
    scoreForm.winner = 'teamA'
    scoreForm.bestDebaterA = ''
    scoreForm.bestDebaterB = ''
    scoreForm.reason = ''
  }
  selectedMatch.value = match
  step.value = 'scoring'
}

// ── 返回列表 ──
function backToList() {
  selectedMatch.value = null
  step.value = 'list'
}

// ── 提交评分 ──
async function submitScore() {
  // 校验
  for (const d of scoreForm.dimensions) {
    if (d.scoreA === undefined || d.scoreA === null || d.scoreB === undefined || d.scoreB === null) {
      toast.add({ title: `请填写 ${d.name} 的完整评分`, color: 'warning' })
      return
    }
  }

  submitting.value = true
  try {
    const res: any = await $fetch(`/api/tournaments/${tournamentId.value}/scores`, {
      method: 'POST',
      body: {
        matchId: selectedMatch.value.id,
        judgeName: judgeName.value,
        dimensions: JSON.stringify(scoreForm.dimensions),
        reason: scoreForm.reason,
        scoreTeamA: calcTotalA(),
        scoreTeamB: calcTotalB(),
        winner: scoreForm.winner,
        bestDebaterA: scoreForm.bestDebaterA || null,
        bestDebaterB: scoreForm.bestDebaterB || null,
      },
    })
    if (res.success) {
      toast.add({ title: '评分提交成功', color: 'success' })
      await loadMatches()
      step.value = 'list'
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '提交失败', color: 'error' })
  } finally {
    submitting.value = false
  }
}

// ── 自动根据比分变更胜方 ──
watch([() => calcTotalA(), () => calcTotalB()], () => {
  const a = calcTotalA()
  const b = calcTotalB()
  if (a > b) scoreForm.winner = 'teamA'
  else if (b > a) scoreForm.winner = 'teamB'
  else scoreForm.winner = 'draw'
}, { deep: true })
</script>

<template>
  <div class="min-h-screen bg-[var(--color-bg-primary)]">
    <!-- 顶部导航 -->
    <header class="sticky top-0 z-50 backdrop-blur-xl bg-[var(--color-bg-secondary)]/80 border-b border-[var(--color-border)]">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3 cursor-pointer" @click="() => { step = 'login' }">
          <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center">
            <UIcon name="i-lucide-gavel" class="w-5 h-5 text-white" />
          </div>
          <span class="text-lg font-bold text-[var(--color-text-primary)]">评委评分系统</span>
        </div>
        <div v-if="step !== 'login'" class="flex items-center gap-3 text-sm">
          <span class="text-[var(--color-text-muted)]">评委：</span>
          <span class="text-[var(--color-text-primary)] font-medium">{{ judgeName }}</span>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <!-- ═════ Step 1: 评委登录 ═════ -->
      <div v-if="step === 'login'" class="max-w-md mx-auto">
        <div class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-8">
          <div class="text-center mb-8">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-lucide-gavel" class="w-8 h-8 text-white" />
          </div>
          <h2 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">评委评分入口</h2>
          <p class="text-[var(--color-text-muted)] text-sm">请输入您的姓名进入评分系统</p>
        </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm text-[var(--color-text-secondary)] mb-2">评委姓名</label>
              <input
                v-model="judgeNameInput"
                type="text"
                placeholder="请输入您的姓名"
                class="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-amber-500/50 transition-colors"
                @keyup.enter="judgeLogin"
              />
            </div>
            <button
              class="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-400 text-[var(--color-text-primary)] rounded-xl font-medium hover:from-amber-600 hover:to-orange-500 transition-all"
              :disabled="loading"
              @click="judgeLogin"
            >
              {{ loading ? '加载中...' : '进入评分' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ═════ Step 2: 比赛列表 ═════ -->
      <div v-else-if="step === 'list'">
        <!-- 赛事信息 -->
        <div class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-6 mb-6">
          <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">{{ tournament?.name }}</h1>
          <p class="text-[var(--color-text-muted)]">{{ formatLabels[tournament?.format] || tournament?.format }}</p>
          <!-- 统计 -->
          <div class="grid grid-cols-3 gap-4 mt-6">
            <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
              <div class="text-2xl font-bold text-[var(--color-text-primary)]">{{ stats.total }}</div>
              <div class="text-xs text-[var(--color-text-muted)] mt-1">总场次</div>
            </div>
            <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
              <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ stats.scored }}</div>
              <div class="text-xs text-[var(--color-text-muted)] mt-1">已评分</div>
            </div>
            <div class="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center">
              <div class="text-2xl font-bold text-amber-600 dark:text-amber-400">{{ stats.pending }}</div>
              <div class="text-xs text-[var(--color-text-muted)] mt-1">待评分</div>
            </div>
          </div>
        </div>

        <!-- 比赛列表 -->
        <div class="space-y-3">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">比赛列表</h3>
          <div
            v-for="match in matches"
            :key="match.id"
            class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-xl border border-[var(--color-border)] p-5 hover:border-amber-500/30 transition-all cursor-pointer"
            @click="startScoring(match)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <!-- 轮次标签 -->
                <span class="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                  {{ match.round }} · 第{{ match.orderNum }}场
                </span>
                <span class="text-[var(--color-text-muted)] text-sm">{{ statusLabels[match.status] || match.status }}</span>
              </div>
              <!-- 状态徽章 -->
              <span :class="[
                'px-3 py-1 rounded-full text-xs font-medium',
                match.scored
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
              ]">
                {{ match.scored ? '已评分' : '待评分' }}
              </span>
            </div>

            <!-- 对阵双方 -->
            <div class="flex items-center justify-center gap-6 mt-4">
              <div class="text-center flex-1">
                <div class="text-lg font-semibold text-[var(--color-text-primary)]">{{ match.teamA || '待定' }}</div>
                <div v-if="match.scored" class="text-sm text-[var(--color-text-muted)] mt-1">
                  {{ match.myScore.scoreTeamA }} 分
                </div>
              </div>
              <div class="text-[var(--color-text-muted)] font-bold text-xl">VS</div>
              <div class="text-center flex-1">
                <div class="text-lg font-semibold text-[var(--color-text-primary)]">{{ match.teamB || '待定' }}</div>
                <div v-if="match.scored" class="text-sm text-[var(--color-text-muted)] mt-1">
                  {{ match.myScore.scoreTeamB }} 分
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═════ Step 3: 评分页面 ═════ -->
      <div v-else-if="step === 'scoring' && selectedMatch" class="space-y-6">
        <!-- 返回按钮 -->
        <button
          class="flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          @click="backToList"
        >
          <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
          返回比赛列表
        </button>

        <!-- 比赛信息 -->
        <div class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-6">
          <div class="flex items-center justify-between mb-4">
            <span class="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
              {{ selectedMatch.round }} · 第{{ selectedMatch.orderNum }}场
            </span>
            <span class="text-[var(--color-text-muted)] text-sm">{{ statusLabels[selectedMatch.status] || selectedMatch.status }}</span>
          </div>
          <div class="flex items-center justify-center gap-8">
            <div class="text-center">
              <div class="text-xl font-bold text-[var(--color-text-primary)]">{{ selectedMatch.teamA || '待定' }}</div>
              <div class="text-sm text-blue-600 dark:text-blue-400 mt-1">总分：{{ calcTotalA() }}</div>
            </div>
            <div class="text-[var(--color-text-muted)] font-bold text-2xl">VS</div>
            <div class="text-center">
              <div class="text-xl font-bold text-[var(--color-text-primary)]">{{ selectedMatch.teamB || '待定' }}</div>
              <div class="text-sm text-blue-600 dark:text-blue-400 mt-1">总分：{{ calcTotalB() }}</div>
            </div>
          </div>
        </div>

        <!-- 评分维度 -->
        <div class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-6">多维评分</h3>
          <div class="space-y-5">
            <div v-for="(dim, idx) in scoreForm.dimensions" :key="idx" class="space-y-2">
              <div class="flex items-center justify-between">
              <span class="text-[var(--color-text-primary)] font-medium">{{ dim.name }}</span>
              <span class="text-sm text-[var(--color-text-muted)]">10 分制</span>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <!-- A队 -->
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">{{ selectedMatch.teamA || 'A队' }}</label>
                <input
                  v-model.number="dim.scoreA"
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  class="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <!-- B队 -->
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">{{ selectedMatch.teamB || 'B队' }}</label>
                <input
                  v-model.number="dim.scoreB"
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  class="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>
          </div>
          </div>
        </div>

        <!-- 胜负结果 -->
        <div class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">胜负判定</h3>
          <div class="grid grid-cols-3 gap-3">
            <button
              :class="[
                'py-3 rounded-xl font-medium transition-all',
                scoreForm.winner === 'teamA'
                  ? 'bg-blue-600 border-blue-500 text-white dark:bg-blue-500/30 dark:text-blue-300 border'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]',
              ]"
              @click="() => { scoreForm.winner = 'teamA' }"
            >
              {{ selectedMatch.teamA || 'A队' }}胜
            </button>
            <button
              :class="[
                'py-3 rounded-xl font-medium transition-all',
                scoreForm.winner === 'draw'
                  ? 'bg-gray-600 border-gray-500 text-white dark:bg-gray-500/30 dark:text-gray-300 border'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]',
              ]"
              @click="() => { scoreForm.winner = 'draw' }"
            >
              平局
            </button>
            <button
              :class="[
                'py-3 rounded-xl font-medium transition-all',
                scoreForm.winner === 'teamB'
                  ? 'bg-emerald-600 border-emerald-500 text-white dark:bg-emerald-500/30 dark:text-emerald-300 border'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]',
              ]"
              @click="() => { scoreForm.winner = 'teamB' }"
            >
              {{ selectedMatch.teamB || 'B队' }}胜
            </button>
          </div>
        </div>

        <!-- 最佳辩手 -->
        <div class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">最佳辩手</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-[var(--color-text-secondary)] mb-2">{{ selectedMatch.teamA || 'A队' }} 最佳辩手</label>
              <input
                v-model="scoreForm.bestDebaterA"
                type="text"
                placeholder="请输入辩手姓名"
                class="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>
            <div>
              <label class="block text-sm text-[var(--color-text-secondary)] mb-2">{{ selectedMatch.teamB || 'B队' }} 最佳辩手</label>
              <input
                v-model="scoreForm.bestDebaterB"
                type="text"
                placeholder="请输入辩手姓名"
                class="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>
          </div>
        </div>

        <!-- 评分理由 -->
        <div class="bg-[var(--color-bg-secondary)] backdrop-blur rounded-2xl border border-[var(--color-border)] p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">评分理由（选填）</h3>
          <textarea
            v-model="scoreForm.reason"
            rows="4"
            placeholder="请简要说明评分理由..."
            class="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-amber-500/50 transition-colors resize-none"
          ></textarea>
        </div>

        <!-- 提交按钮 -->
        <div class="flex gap-4">
          <button
            class="flex-1 py-3 bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] rounded-xl font-medium hover:bg-[var(--color-bg-tertiary)] transition-all"
            @click="backToList"
          >
            返回
          </button>
          <button
            class="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-400 text-[var(--color-text-primary)] rounded-xl font-medium hover:from-amber-600 hover:to-orange-500 transition-all disabled:opacity-50"
            :disabled="submitting"
            @click="submitScore"
          >
            {{ submitting ? '提交中...' : '提交评分' }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
