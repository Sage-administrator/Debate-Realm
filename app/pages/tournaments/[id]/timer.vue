<script setup lang="ts">
// ════════════════════════════════════════════════════
// 辩论计时器全屏演示页（P2
// 按 计时器界面UI.md 规格：全屏演示 + 赛程信息配置弹窗 + 快捷键面板
// 核心数据流：
//  - 赛程信息 = 具体比赛的执行计划（时间/地点/对阵/辩题/分组/裁判等）—— 本弹窗配置
//  - 赛制规则 = 环节计时配置（各环节时长/顺序等）—— 在 /tournaments/{id}/timing 页面配置
// ════════════════════════════════════════════════════

const route = useRoute()
const toast = useToast()
const { getTournament } = useTournament()

const tournament = ref<any>(null)
const loading = ref(true)
const tournamentId = computed(() => route.params.id as string)

// ═══════════ 计时器页面状态 ═══════════
const isFullscreen = ref(false)
const showConfig = ref(true)        // 是否显示赛程信息配置弹窗
const timerRunning = ref(false)
const timerPaused = ref(false)

// ═══════════ 赛程信息（具体比赛执行计划 ═══════════
const matchDateTime = ref('')        // 比赛日期与时间（ISO格式
const matchVenue = ref('')        // 比赛地点
const teamPro = ref('正方')       // 正方队伍名
const teamCon = ref('反方')       // 反方队伍名
const topicPro = ref('')           // 正方辩题
const topicCon = ref('')           // 反方辩题

// ═══════════ 环节列表（来自赛制规则 —— 在独立页面配置） ═══════════
interface PhaseItem {
  id: string
  name: string
  type: string
  duration: number
  protectionTime?: number
  questioner?: string
  responder?: string
  firstSpeaker?: string
  isSurprise?: boolean
}
const phases = ref<PhaseItem[]>([])
const currentPhaseIdx = ref(0)
const remainingSeconds = ref(0)
const protectionSeconds = ref(0)

// ═══════════ 计时器逻辑 ═══════════
let timerInterval: ReturnType<typeof setInterval> | null = null

const currentPhase = computed(() => phases.value[currentPhaseIdx.value] || null)
const isFirstPhase = computed(() => currentPhaseIdx.value === 0)
const isLastPhase = computed(() => currentPhaseIdx.value >= phases.value.length - 1)

function startTimer() {
  if (!phases.value.length) return
  if (timerRunning.value) return

  const phase = currentPhase.value
  if (!phase) return

  if (remainingSeconds.value <= 0) {
    remainingSeconds.value = phase.duration || 0
    protectionSeconds.value = phase.protectionTime || 0
  }

  timerRunning.value = true
  timerPaused.value = false
  showConfig.value = false

  timerInterval = setInterval(() => {
    if (timerPaused.value) return

    if (remainingSeconds.value > 0) remainingSeconds.value--
    if (protectionSeconds.value > 0) protectionSeconds.value--
    if (remainingSeconds.value <= 0) nextPhase()
  }, 1000)
}

function pauseTimer() {
  timerPaused.value = !timerPaused.value
}

function resetTimer() {
  stopTimer()
  const phase = currentPhase.value
  if (phase) {
    remainingSeconds.value = phase.duration || 0
    protectionSeconds.value = phase.protectionTime || 0
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  timerRunning.value = false
  timerPaused.value = false
}

function nextPhase() {
  if (isLastPhase.value) { stopTimer(); return }
  currentPhaseIdx.value++
  const phase = currentPhase.value
  if (phase) {
    remainingSeconds.value = phase.duration || 0
    protectionSeconds.value = phase.protectionTime || 0
  }
}

function prevPhase() {
  if (isFirstPhase.value) return
  currentPhaseIdx.value--
  const phase = currentPhase.value
  if (phase) {
    remainingSeconds.value = phase.duration || 0
    protectionSeconds.value = phase.protectionTime || 0
  }
}

function toggleFullscreen() {
  if (!isFullscreen.value) { document.documentElement.requestFullscreen(); isFullscreen.value = true }
  else { document.exitFullscreen(); isFullscreen.value = false }
}

function onKeydown(e: KeyboardEvent) {
  if (showConfig.value) return
  switch (e.key) {
    case ' ': e.preventDefault(); startTimer(); break
    case 'p': case 'P': pauseTimer(); break
    case 'r': case 'R': resetTimer(); break
    case 'n': case 'N': nextPhase(); break
    case 'ArrowRight': nextPhase(); break
    case 'ArrowLeft': prevPhase(); break
    case 'q': case 'Q': remainingSeconds.value = 30; break
    case 'w': case 'W': remainingSeconds.value = 5; break
    case 'e': case 'E': remainingSeconds.value = 0; break
    case 'f': case 'F': toggleFullscreen(); break
    case 'b': case 'B': showConfig.value = true; break
    case 'Escape': showConfig.value = true; stopTimer(); break
  }
}

function startSurprise() {
  const surpriseIndex = phases.value.findIndex(p => p.isSurprise)
  if (surpriseIndex >= 0) {
    currentPhaseIdx.value = surpriseIndex
    const phase = phases.value[surpriseIndex]
    if (phase) {
      remainingSeconds.value = phase.duration || 0
      protectionSeconds.value = phase.protectionTime || 0
      startTimer()
    }
  } else {
    phases.value.push({ id: '__surprise__', name: '奇袭', type: 'surprise', duration: 120, isSurprise: true })
    currentPhaseIdx.value = phases.value.length - 1
    remainingSeconds.value = 120
    protectionSeconds.value = 0
    startTimer()
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ═══════════ 默认赛程模板（用户未配置环节时的兜底） ═══════════
function getDefaultPhases(): PhaseItem[] {
  return [
    { id: 'default_1', name: '开篇立论', type: 'single_speech', duration: 180, protectionTime: 0 },
    { id: 'default_2', name: '攻辩', type: 'single_question', duration: 120, protectionTime: 0 },
    { id: 'default_3', name: '自由辩论', type: 'free_debate', duration: 240, protectionTime: 0 },
    { id: 'default_4', name: '总结陈词', type: 'single_speech', duration: 180, protectionTime: 0 },
    { id: 'default_5', name: '环节5', type: 'single_speech', duration: 60, protectionTime: 0 },
  ]
}

// ═══════════ 数据加载 ═══════════
async function loadData() {
  loading.value = true
  try {
    tournament.value = await getTournament(tournamentId.value)

    // 从参赛队伍中取前两队作为正反方
    const teams: string[] = tournament.value?.teams || []
    if (teams.length >= 1) teamPro.value = teams[0]!
    if (teams.length >= 2) teamCon.value = teams[1]!

    // 从赛事信息中预填充赛程信息
    if (tournament.value?.scheduledAt) {
      const dt = new Date(tournament.value.scheduledAt)
      matchDateTime.value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
    }
    if (tournament.value?.venue) matchVenue.value = tournament.value.venue

    // 加载赛制规则（环节配置）
    const template = await $fetch<any>(`/api/tournaments/${tournamentId.value}/timer-template`, {
      headers: { Authorization: `Bearer ${useAuthStore().token}` },
    })
    if (template?.phases) {
      const parsed = typeof template.phases === 'string' ? JSON.parse(template.phases) : template.phases
      phases.value = Array.isArray(parsed) ? parsed : []
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ═══════════ 开始计时（从配置弹窗） ═══════════
function handleStartFromConfig() {
  if (!topicPro.value.trim()) { toast.add({ title: '请填写正方辩题', color: 'warning' }); return }
  if (!topicCon.value.trim()) { toast.add({ title: '请填写反方辩题', color: 'warning' }); return }
  if (!teamPro.value.trim()) { toast.add({ title: '请填写正方队伍名', color: 'warning' }); return }
  if (!teamCon.value.trim()) { toast.add({ title: '请填写反方队伍名', color: 'warning' }); return }

  // 赛制规则环节为空时，使用默认模板
  if (!phases.value.length) {
    phases.value = getDefaultPhases()
    toast.add({ title: '使用默认 5 环节模板启动', color: 'info' })
  }

  currentPhaseIdx.value = 0
  const phase = phases.value[0]
  if (phase) {
    remainingSeconds.value = phase.duration || 0
    protectionSeconds.value = phase.protectionTime || 0
  }
  startTimer()
}

onMounted(() => {
  loadData()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  stopTimer()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <!-- 加载状态 -->
  <div v-if="loading" class="flex justify-center items-center h-screen bg-gray-100">
    <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin text-gray-400" />
  </div>

  <!-- 主容器 -->
  <div v-else class="timer-page">
    <!-- 配置模态框：赛程信息配置 -->
    <div v-if="showConfig" class="config-backdrop">
      <div class="config-modal">
        <header class="config-header">
          <h2 class="config-title">赛程信息配置</h2>
          <p class="config-subtitle">配置单场比赛的具体执行计划，包括日期、地点、对阵队伍与辩题</p>
        </header>

        <div class="config-body">
          <!-- 左侧：赛程信息录入 -->
          <div class="config-left">
            <h3 class="config-heading">赛程信息</h3>
            <p class="config-heading-desc">本页内容仅用于记录具体比赛的执行计划。赛程仅针对特定比赛。</p>

            <label class="config-label">比赛日期与时间</label>
            <input v-model="matchDateTime" type="datetime-local" class="config-input" placeholder="YYYY-MM-DD HH:MM">

            <label class="config-label">比赛地点</label>
            <input v-model="matchVenue" type="text" class="config-input" placeholder="例如：主赛场 / 线上会议室">

            <label class="config-label">正方队伍名</label>
            <input v-model="teamPro" type="text" class="config-input" placeholder="例如：第一辩手队">

            <label class="config-label">反方队伍名</label>
            <input v-model="teamCon" type="text" class="config-input" placeholder="例如：第二辩手队">

            <label class="config-label">正方辩题</label>
            <input v-model="topicPro" type="text" class="config-input" placeholder="请输入正方辩题">

            <label class="config-label">反方辩题</label>
            <input v-model="topicCon" type="text" class="config-input" placeholder="请输入反方辩题">

          </div>

          <!-- 右侧：赛制规则提示 -->
          <div class="config-right">
            <h3 class="config-heading config-heading--sep">赛制规则</h3>
            <p class="config-heading-desc">本部分记录比赛的规则体系框架，用于规范比赛过程。</p>

            <p class="config-section-title">当前环节设置：</p>
            <div class="schedule-preview">
              <template v-if="phases.length">
                <div v-for="(p, i) in phases" :key="p.id" class="schedule-row">
                  <span class="schedule-index">{{ i + 1 }}</span>
                  <span class="schedule-name">{{ p.name }}</span>
                  <span class="schedule-time">{{ p.duration }}秒</span>
                </div>
              </template>
              <div v-else class="schedule-empty">
                <UIcon name="i-lucide-clock" class="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>您未配置环节设置</p>
                <NuxtLink :to="`/tournaments/${tournamentId}/timing`" class="config-link">前往配置 →</NuxtLink>
                <p class="text-xs text-gray-500 mt-2">点击「使用以上配置开始计时」可直接使用默认 5 环节模板</p>
              </div>
            </div>

            <p class="config-section-title config-section-title--hint">赛程信息与赛制规则分离存储</p>
            <div class="config-help">
              <p>• <strong>赛程</strong>：具体比赛执行计划（时间、地点、对阵队伍、辩题）</p>
              <p>• <strong>赛制规则</strong>：环节规则体系（各环节时长/顺序/规则）</p>
            </div>

          </div>
        </div>

        <!-- 底部操作栏 -->
        <footer class="config-footer">
          <button class="btn-start" @click="handleStartFromConfig">
            <UIcon name="i-lucide-play" class="w-4 h-4 mr-1.5" />
            使用以上配置开始计时
          </button>
        </footer>
      </div>
    </div>

    <!-- 全屏演示页 -->
    <div v-if="!showConfig" class="display-page">
      <header class="display-header">
        <div class="header-left-side">
          <span class="team-badge team-badge--pro">{{ teamPro }}</span>
          <span class="header-topic-text">{{ topicPro }}</span>
        </div>
        <div class="header-right-side">
          <span class="header-topic-text">{{ topicCon }}</span>
          <span class="team-badge team-badge--con">{{ teamCon }}</span>
        </div>
      </header>

      <div class="aux-info aux-left">
        <span>计时器 · 辩论赛</span>
      </div>
      <div class="aux-info aux-right">
        <span>{{ currentPhase?.type || '' }}</span>
      </div>

      <main class="display-center">
        <p class="tournament-title">{{ tournament?.name || '辩论赛' }}</p>
        <p class="countdown-text">{{ formatTime(remainingSeconds) }}</p>
        <p class="phase-text">{{ currentPhase?.name || '--' }}</p>
        <div class="phase-meta">
          <span v-if="currentPhase?.questioner" class="meta-tag">{{ currentPhase.questioner }} 问 {{ currentPhase.responder }}</span>
          <span v-if="currentPhase?.firstSpeaker" class="meta-tag">率先发言: {{ currentPhase.firstSpeaker }}</span>
          <span v-if="protectionSeconds > 0" class="meta-tag meta-tag--warn">保护: {{ formatTime(protectionSeconds) }}</span>
        </div>
        <div class="phase-progress">
          <span v-for="(p, i) in phases" :key="p.id" class="progress-dot" :class="{ 'progress-dot--active': i === currentPhaseIdx, 'progress-dot--done': i < currentPhaseIdx }"></span>
        </div>
      </main>

      <div class="control-panel">
        <div class="ctrl-group">
          <span class="ctrl-label">计时控制:</span>
          <button class="ctrl-btn" @click="startTimer">启动计时 (空格)</button>
          <button class="ctrl-btn" @click="pauseTimer">{{ timerPaused ? '继续 (P)' : '中断 (P)' }}</button>
          <button class="ctrl-btn" @click="resetTimer">重置 (R)</button>
        </div>
        <div class="ctrl-group">
          <span class="ctrl-label">环节切换:</span>
          <button class="ctrl-btn" :disabled="isFirstPhase" @click="prevPhase">← 上一环节</button>
          <button class="ctrl-btn" :disabled="isLastPhase" @click="nextPhase">下一环节 →</button>
        </div>
        <div class="ctrl-group">
          <span class="ctrl-label">快捷时间:</span>
          <button class="ctrl-btn" @click="remainingSeconds += 30">+30秒</button>
          <button class="ctrl-btn" @click="remainingSeconds = Math.max(0, remainingSeconds - 30)">-30秒</button>
          <button class="ctrl-btn" @click="remainingSeconds += 60">+1分钟</button>
          <button class="ctrl-btn" @click="remainingSeconds = Math.max(0, remainingSeconds - 60)">-1分钟</button>
        </div>
        <div class="ctrl-group">
          <span class="ctrl-label">试音环节:</span>
          <button class="ctrl-btn" @click="remainingSeconds = 30">30秒 (Q)</button>
          <button class="ctrl-btn" @click="remainingSeconds = 5">5秒 (W)</button>
          <button class="ctrl-btn" @click="remainingSeconds = 0">时间到 (E)</button>
        </div>
        <div class="ctrl-group">
          <span class="ctrl-label">特殊功能:</span>
          <button class="ctrl-btn ctrl-btn--accent" @click="startSurprise">奇袭发起</button>
          <button class="ctrl-btn" @click="toggleFullscreen">{{ isFullscreen ? '退出全屏 (F)' : '进入全屏 (F)' }}</button>
          <button class="ctrl-btn" @click="showConfig = true; stopTimer()">返回主页 (B)</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全局容器 */
.timer-page {
  position: fixed;
  inset: 0;
  background-color: #1E2226;
  color: #FFFFFF;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 配置模态框 */
.config-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.config-modal {
  width: 960px;
  max-width: 90vw;
  max-height: 90vh;
  background: #FFFFFF;
  border-radius: 8px;
  color: #1D2129;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.config-header {
  padding: 24px 32px;
  border-bottom: 1px solid #E5E6EB;
}

.config-title {
  font-size: 20px;
  font-weight: 700;
  color: #1D2129;
  margin: 0 0 4px 0;
}

.config-subtitle {
  font-size: 13px;
  font-weight: 400;
  color: #86909C;
  margin: 0;
}

/* 双栏内容区 */
.config-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.config-left {
  width: 55%;
  padding: 20px 32px;
  overflow-y: auto;
  border-right: 1px solid #E5E6EB;
}

.config-right {
  width: 45%;
  padding: 20px 32px;
  overflow-y: auto;
}

/* 标题和描述 */
.config-heading {
  font-size: 14px;
  font-weight: 600;
  color: #1D2129;
  margin: 0 0 4px 0;
}

.config-heading-desc {
  font-size: 12px;
  color: #86909C;
  margin: 0 0 16px 0;
}

.config-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #4E5969;
  margin-bottom: 6px;
  margin-top: 10px;
}

.config-input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  font-size: 13px;
  border: 1px solid #E5E6EB;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: #FFFFFF;
  color: #1D2129;
}

.config-input:focus {
  border-color: #1D2129;
  border-width: 2px;
}

/* 赛程预览 */
.config-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #4E5969;
  margin: 20px 0 8px 0;
}

.config-section-title--hint {
  margin-top: 24px;
  color: #1D2129;
  font-size: 12px;
  font-weight: 700;
}

.config-help {
  font-size: 12px;
  color: #4E5969;
  padding: 8px 0;
  line-height: 1.8;
}

.config-help p {
  margin: 0;
  line-height: 1.8;
}

.schedule-preview {
  background: #F7F8FA;
  border-radius: 4px;
  min-height: 180px;
  padding: 12px;
  margin-top: 8px;
}

.schedule-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: 13px;
  color: #1D2129;
  border-radius: 4px;
  background: white;
  margin-bottom: 4px;
}

.schedule-index {
  width: 24px;
  height: 24px;
  background: #E5E6EB;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #86909C;
  flex-shrink: 0;
}

.schedule-name { flex: 1; }

.schedule-time {
  color: #86909C;
  font-size: 12px;
}

.schedule-empty {
  text-align: center;
  padding: 32px 0;
  color: #86909C;
  font-size: 13px;
}

.config-link {
  display: inline-block;
  margin-top: 12px;
  color: #2563EB;
  font-size: 13px;
  text-decoration: none;
  font-weight: 500;
}

.config-link:hover { text-decoration: underline; }

/* 底部操作栏 */
.config-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 32px;
  border-top: 1px solid #E5E6EB;
  background: #FFFFFF;
}

.btn-start {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 24px;
  font-size: 14px;
  font-weight: 500;
  color: #FFFFFF;
  background-color: #2B2F36;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s, transform 0.1s;
}

.btn-start:hover {
  background-color: #16181D;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.btn-start:active { transform: scale(0.98); }

/* 全屏演示页 */
.display-page {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
}

.display-header {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  pointer-events: none;
}

.header-left-side {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-right-side {
  display: flex;
  align-items: center;
  gap: 16px;
}

.team-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 40px;
  padding: 0;
  border: 2px solid #FFFFFF;
  border-radius: 4px;
  font-size: 20px;
  font-weight: 700;
  color: #FFFFFF;
  white-space: nowrap;
  flex-shrink: 0;
  overflow: hidden;
}

.team-badge--pro { background-color: #C43535; }
.team-badge--con { background-color: #0077B6; }

.header-topic-text {
  font-size: 18px;
  font-weight: 500;
  color: #FFFFFF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

.aux-info {
  position: absolute;
  font-size: 14px;
  font-weight: 400;
  color: #FFFFFF;
  opacity: 0.6;
}

.aux-left { bottom: 20px; left: 40px; }
.aux-right { bottom: 20px; right: 40px; }

.display-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  text-align: center;
}

.tournament-title {
  font-size: 48px;
  font-weight: 700;
  color: #0077B6;
  margin: 0 0 12px;
  letter-spacing: 2px;
}

.countdown-text {
  font-size: 120px;
  font-weight: 900;
  color: #FFFFFF;
  font-family: 'Courier New', monospace;
  margin: 0 0 8px;
  letter-spacing: 8px;
  text-shadow: 0 0 40px rgba(255,255,255,0.3);
}

.phase-text {
  font-size: 100px;
  font-weight: 800;
  color: #FFFFFF;
  margin: 0 0 16px;
  letter-spacing: 4px;
}

.phase-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.meta-tag {
  padding: 4px 12px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  font-size: 14px;
  color: rgba(255,255,255,0.8);
}

.meta-tag--warn {
  border-color: rgba(250,204,21,0.5);
  color: #FACC15;
}

.phase-progress {
  display: flex;
  gap: 8px;
}

.progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  transition: all 0.3s;
}

.progress-dot--active {
  background: #FFFFFF;
  transform: scale(1.4);
}

.progress-dot--done {
  background: rgba(255,255,255,0.5);
}

/* 控制浮层 */
.control-panel {
  position: absolute;
  bottom: 40px;
  right: 40px;
  background: rgba(30,34,38,0.85);
  border-radius: 8px;
  padding: 16px 20px;
  z-index: 10;
  backdrop-filter: blur(8px);
}

.ctrl-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.ctrl-group:last-child { margin-bottom: 0; }

.ctrl-label {
  font-size: 12px;
  color: #A9AEB8;
  white-space: nowrap;
  min-width: 80px;
  text-align: right;
}

.ctrl-btn {
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
  color: #FFFFFF;
  background: transparent;
  border: 1px solid #FFFFFF;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.ctrl-btn:hover { background: rgba(255,255,255,0.1); }
.ctrl-btn:active {
  background: rgba(255,255,255,0.2);
  transform: scale(0.97);
}
.ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ctrl-btn--accent {
  border-color: #FACC15;
  color: #FACC15;
}

.ctrl-btn--accent:hover { background: rgba(250,204,21,0.15); }
.ctrl-btn--accent:active { background: rgba(250,204,21,0.25); }
</style>
