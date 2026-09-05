<script setup lang="ts">
/**
 * 评分问卷填写页（按场）
 * 组织者在赛果统计设计的 match_score 问卷，观众/评委在此对单场比赛打分。
 */
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const { submitResult } = useTournament()
const tournamentId = computed(() => route.params.id as string)
const matchId = computed(() => route.params.matchId as string)

const loading = ref(true)
const loadError = ref('')
const questionnaire = ref<any>(null)
const match = ref<any>(null)
const tournamentDetail = ref<any>(null)
const scoreStats = ref<any>(null)

// 组织者写权限（同 result.vue 的 canDesign）：system_admin 或 该赛事 team.adminId 对应用户
const canWriteResult = computed(() => {
  const role = authStore.user?.role
  if (role === 'system_admin') return true
  // UserInfo 中主键字段是 id 而非 userId
  if (role === 'admin') return tournamentDetail.value?.team?.adminId === authStore.user?.id
  return false
})

// 组织者登记赛果表单（评分收集完成后由组织者确认写入）
const resultForm = reactive({ winner: 'A', scoreA: 0, scoreB: 0 })
const submittingResult = ref(false)

async function loadMatch() {
  try {
    const res = await fetch(`/api/tournaments/${tournamentId.value}/matches`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    const list = await res.json()
    match.value = (list || []).find((m: any) => m.id === matchId.value) || null
    // 若已登记过赛果，预填表单
    if (match.value?.status === 'finished') {
      resultForm.winner =
        match.value.winner === 'B' ? 'B' : match.value.winner === 'draw' ? 'draw' : 'A'
      resultForm.scoreA = match.value.scoreA ?? 0
      resultForm.scoreB = match.value.scoreB ?? 0
    }
  } catch {
    match.value = null
  }
}

// 赛事详情（用于判定组织者身份）
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

// 评分聚合统计（辅助组织者判定胜负）
async function loadScoreStats() {
  try {
    const res = await fetch(`/api/tournaments/${tournamentId.value}/match-score-stats`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    const data = await res.json()
    scoreStats.value = data?.success ? data : null
  } catch {
    scoreStats.value = null
  }
}

// 本场评分聚合
const matchScoreStat = computed(() => {
  return (scoreStats.value?.matches || []).find((m: any) => m.matchId === matchId.value) || null
})

// 组织者写入赛果：评分收集完成后由组织者确认胜负/比分并标记比赛完成
async function submitMatchResult() {
  if (!canWriteResult.value) return
  submittingResult.value = true
  try {
    await submitResult(
      matchId.value,
      resultForm.winner,
      Number(resultForm.scoreA),
      Number(resultForm.scoreB),
    )
    toast.add({ title: '赛果已登记', color: 'success' })
    if (match.value) match.value.status = 'finished'
    await navigateTo(`/tournaments/${tournamentId.value}/result`)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '登记失败', color: 'error' })
  } finally {
    submittingResult.value = false
  }
}

async function loadQuestionnaire() {
  try {
    loading.value = true
    // 1. 取赛事下的评分问卷模板
    const listRes = await fetch(
      `/api/tournaments/${tournamentId.value}/questionnaires?sourceType=match_score`,
      {
        headers: { Authorization: `Bearer ${authStore.token}` },
      },
    )
    const list = await listRes.json()
    const template = Array.isArray(list) ? list[0] : null
    if (!template) {
      loadError.value = '组织者尚未设计评分问卷'
      return
    }
    // 2. 取详情（题目定义）
    const detailRes = await fetch(
      `/api/tournaments/${tournamentId.value}/questionnaires/${template.id}`,
      {
        headers: { Authorization: `Bearer ${authStore.token}` },
      },
    )
    const detail = await detailRes.json()
    if (detail?.id) {
      questionnaire.value = detail
    } else {
      loadError.value = '问卷加载失败'
    }
  } catch (e: any) {
    loadError.value = e?.data?.message || '加载评分问卷失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadMatch()
  loadQuestionnaire()
  loadTournamentDetail()
  loadScoreStats()
})
</script>

<template>
  <div class="min-h-screen">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 返回 -->
      <button
        class="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
        @click="() => navigateTo(`/tournaments/${tournamentId}/result`)"
      >
        <UIcon name="i-lucide-arrow-left" class="w-3.5 h-3.5" />
        返回赛果统计
      </button>

      <!-- 加载 -->
      <div v-if="loading" class="glass-card p-10 text-center">
        <div
          class="w-8 h-8 border-2 border-[var(--color-border)] border-t-indigo-400 rounded-full animate-spin mx-auto mb-3"
        ></div>
        <p class="text-sm text-[var(--color-text-muted)]">加载中...</p>
      </div>

      <!-- 未设计问卷 -->
      <div v-else-if="loadError || !questionnaire" class="glass-card p-10 text-center">
        <UIcon
          name="i-lucide-clipboard-x"
          class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3"
        />
        <h2 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">暂无评分问卷</h2>
        <p class="text-sm text-[var(--color-text-muted)]">
          {{ loadError || '组织者尚未设计评分问卷' }}
        </p>
        <UButton
          class="mt-4"
          color="neutral"
          variant="outline"
          @click="void navigateTo(`/tournaments/${tournamentId}/result`)"
        >
          返回赛果统计
        </UButton>
      </div>

      <!-- 填写 -->
      <div v-else>
        <!-- 比赛上下文 -->
        <header class="mb-5">
          <p class="text-xs text-[var(--color-text-muted)] mb-1">比赛评分</p>
          <div v-if="match" class="flex items-center gap-3 text-sm">
            <span class="font-semibold text-[var(--color-text-primary)]">{{
              match.teamA || '待定'
            }}</span>
            <span class="text-[var(--color-text-muted)]">VS</span>
            <span class="font-semibold text-[var(--color-text-primary)]">{{
              match.teamB || '待定'
            }}</span>
          </div>
          <p v-if="match?.topic" class="text-xs text-[var(--color-text-muted)] mt-1 truncate">
            辩题：{{ match.topic }}
          </p>
        </header>

        <!-- 问卷标题 -->
        <div class="mb-4">
          <h1 class="text-xl font-bold text-[var(--color-text-primary)]">
            {{ questionnaire.title }}
          </h1>
          <p v-if="questionnaire.description" class="text-sm text-[var(--color-text-muted)] mt-1">
            {{ questionnaire.description }}
          </p>
        </div>

        <QuestionnaireFill :questionnaire="questionnaire" :match-id="matchId" />

        <!-- 组织者登记赛果（评分决定胜负，组织者确认写入） -->
        <div v-if="canWriteResult" class="mt-6 glass-card p-5">
          <h3
            class="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3"
          >
            <UIcon name="i-lucide-gavel" class="w-4 h-4 text-[var(--color-accent-primary)]" />
            登记赛果（组织者确认）
          </h3>
          <p class="text-xs text-[var(--color-text-muted)] mb-4">
            评分由评委/观众填写并作为胜负依据，最终赛果由组织者在此确认写入。
          </p>

          <!-- 评分聚合提示 -->
          <div v-if="matchScoreStat?.scales?.length" class="mb-4 space-y-1">
            <div
              v-for="s in matchScoreStat.scales"
              :key="s.fieldKey"
              class="flex items-center justify-between text-xs"
            >
              <span class="text-[var(--color-text-secondary)]">{{ s.title }}</span>
              <span class="font-semibold text-[var(--color-accent-primary)]"
                >均值 {{ s.avg }} / {{ s.max }}</span
              >
            </div>
            <p class="text-xs text-[var(--color-text-muted)] pt-1">
              共 {{ matchScoreStat.submissionCount }} 份评分
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <UFormField label="获胜方" class="sm:col-span-1">
              <USelect
                v-model="resultForm.winner"
                :items="[
                  { label: '正方胜', value: 'A' },
                  { label: '反方胜', value: 'B' },
                  { label: '平局', value: 'draw' },
                ]"
              />
            </UFormField>
            <UFormField label="正方得分" class="sm:col-span-1">
              <UInput v-model.number="resultForm.scoreA" type="number" />
            </UFormField>
            <UFormField label="反方得分" class="sm:col-span-1">
              <UInput v-model.number="resultForm.scoreB" type="number" />
            </UFormField>
          </div>

          <div class="flex justify-end mt-4">
            <UButton color="primary" :loading="submittingResult" @click="submitMatchResult">
              {{ match?.status === 'finished' ? '更新赛果' : '确认并登记赛果' }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
