<script setup lang="ts">
// 计时器环节配置页面 — 按 计时器环节UI.md 双栏布局：左侧预览 + 右侧配置
const route = useRoute()
const toast = useToast()
const { getTournament } = useTournament()

const tournament = ref<any>(null)
const loading = ref(true)
const tournamentId = computed(() => route.params.id as string)

// 左侧预览用的环节数据（简单模拟，实际取自 TimerConfig 的 phases）
const phases = ref<any[]>([])

async function loadTournament() {
  loading.value = true
  try {
    tournament.value = await getTournament(tournamentId.value)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// 从 API 加载环节列表用于预览
async function loadPhasesForPreview() {
  try {
    const res = await $fetch<any>(`/api/tournaments/${tournamentId.value}/timer-template`, {
      headers: { Authorization: `Bearer ${useAuthStore().token}` },
    })
    if (res?.phases) {
      phases.value = typeof res.phases === 'string' ? JSON.parse(res.phases) : res.phases
    }
  } catch { phases.value = [] }
}

// 预览当前环节索引
const previewPhaseIdx = ref(0)
const previewPhase = computed(() => phases.value[previewPhaseIdx.value] || null)

function prevPreview() {
  if (previewPhaseIdx.value > 0) previewPhaseIdx.value--
}
function nextPreview() {
  if (previewPhaseIdx.value < phases.value.length - 1) previewPhaseIdx.value++
}

// 监听 TimerConfig 保存后刷新预览
function onPhaseSaved() {
  loadPhasesForPreview()
}

onMounted(() => {
  loadTournament()
  loadPhasesForPreview()
})
</script>

<template>
  <div class="min-h-screen" style="background-color: #F5F7FA;">
    <div class="max-w-[1200px] mx-auto px-6">

      <!-- ═══ 加载状态 ═══ -->
      <div v-if="loading" class="flex justify-center py-24">
        <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin text-gray-400" />
      </div>

      <template v-else-if="tournament">
        <!-- ═══ 头部 ═══ -->
        <header class="flex items-end justify-between pt-10 pb-5">
          <div>
            <p class="text-xs text-gray-400 mb-1">
              赛事管理 / ID: {{ tournament.id }}
            </p>
            <h1 class="text-[28px] font-bold text-gray-900 leading-tight">
              {{ tournament.name }}
            </h1>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="h-9 px-4 text-sm border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              离线版下载
            </button>
            <button
              class="h-9 px-4 text-sm rounded-md text-white transition-colors"
              style="background-color: #1F2937;"
              @click="navigateTo(`/tournaments/${tournamentId}/timer`)"
            >
              打开在线版计时器
            </button>
          </div>
        </header>

        <!-- ═══ 双层Tab导航 ═══ -->
        <!-- 一级导航：功能大类 -->
        <div class="primary-tabs">
          <span class="primary-tab primary-tab--active">基础配置</span>
          <span class="primary-tab">
            视听设计
            <span class="pro-badge">Pro</span>
          </span>
          <span class="primary-tab">
            进阶功能
            <span class="pro-badge">Pro</span>
          </span>
        </div>
        <!-- 二级导航：细分功能（胶囊式激活态） -->
        <nav class="secondary-tabs">
          <NuxtLink :to="`/tournaments/${tournamentId}`" class="sub-tab">概览</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/info`" class="sub-tab">比赛信息</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/timing`" class="sub-tab sub-tab--active">计时器环节</NuxtLink>
        </nav>

        <!-- ═══════ 双栏主体内容 ═══════ -->
        <main class="config-container">
          <!-- ═══ 左侧面板：预览 + 控制 + 信息卡 ═══ -->
          <aside class="left-panel">
            <!-- 预览窗口：16:9 黑色背景模拟大屏 -->
            <div class="preview-card">
              <div class="preview-window">
                <div class="preview-inner">
                  <!-- 顶部队名条 -->
                  <div class="preview-header">
                    <div class="preview-team preview-team--pro">
                      <span class="preview-team-name">{{ tournament.teams?.[0]?.name || '正方' }}</span>
                    </div>
                    <div class="preview-team preview-team--con">
                      <span class="preview-team-name">{{ tournament.teams?.[1]?.name || '反方' }}</span>
                    </div>
                  </div>
                  <!-- 中心倒计时 -->
                  <div class="preview-center">
                    <p class="preview-countdown" v-if="previewPhase">
                      {{ Math.floor((previewPhase.duration || 0) / 60).toString().padStart(2, '0') }}:{{ ((previewPhase.duration || 0) % 60).toString().padStart(2, '0') }}
                    </p>
                    <p class="preview-countdown" v-else>00:00</p>
                    <p class="preview-phase-name">{{ previewPhase?.name || '未配置环节' }}</p>
                  </div>
                </div>
              </div>
              <!-- 导航控制按钮 -->
              <div class="preview-controls">
                <button class="preview-btn" :disabled="previewPhaseIdx <= 0" @click="prevPreview">← 上一环节</button>
                <NuxtLink :to="`/tournaments/${tournamentId}/timer`" class="preview-btn preview-btn--primary">跳转计时页面</NuxtLink>
                <button class="preview-btn" :disabled="previewPhaseIdx >= phases.length - 1" @click="nextPreview">下一环节 →</button>
              </div>
            </div>

            <!-- 帮助信息卡 -->
            <div class="info-card">
              <div class="info-card-row">
                <UIcon name="i-lucide-download" class="w-5 h-5 text-green-500" />
                <div>
                  <p class="info-card-title">下载离线版</p>
                  <a href="#" class="info-card-link">点击查看介绍 →</a>
                </div>
              </div>
            </div>
            <div class="info-card">
              <div class="info-card-row">
                <UIcon name="i-lucide-zap" class="w-5 h-5 text-amber-500" />
                <div>
                  <p class="info-card-title">快速上手</p>
                  <a href="#" class="info-card-link">查看使用教程 →</a>
                </div>
              </div>
            </div>
          </aside>

          <!-- ═══ 右侧面板：配置表单 ═══ -->
          <section class="right-panel">
            <TimerConfig :tournament-id="tournament.id" @saved="onPhaseSaved" />
          </section>
        </main>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════ 一级导航 ═══════════ */
.primary-tabs {
  display: flex;
  border-bottom: 1px solid #E5E7EB;
  background: #FFFFFF;
}

.primary-tab {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #6B7280;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.primary-tab:hover {
  color: #374151;
}

.primary-tab--active {
  color: #1F2329;
  border-bottom: 2px solid #3B82F6;
}

.pro-badge {
  display: inline-block;
  background-color: #10B981;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 9px;
  margin-left: 6px;
  vertical-align: middle;
  line-height: 1.4;
}

/* ═══════════ 二级导航 ═══════════ */
.secondary-tabs {
  display: flex;
  gap: 8px;
  padding: 8px 20px;
  background: #FFFFFF;
  border-bottom: 1px solid #E5E7EB;
}

.sub-tab {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #6B7280;
  border-radius: 4px;
  text-decoration: none;
  transition: all 0.2s;
}

.sub-tab:hover {
  color: #374151;
  background: #F3F4F6;
}

.sub-tab--active {
  color: #3B82F6;
  background: #EFF6FF;
}

/* ═══════════ 双栏布局 ═══════════ */
.config-container {
  display: flex;
  gap: 24px;
  padding: 24px 0;
}

/* ═══════════ 左侧面板 ═══════════ */
.left-panel {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 预览卡片 */
.preview-card {
  background: #FFFFFF;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
  overflow: hidden;
}

.preview-window {
  background: #1E2226;
  padding: 16px;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.preview-header {
  display: flex;
  width: 100%;
  margin-bottom: 8px;
}

.preview-team {
  flex: 1;
  padding: 4px 12px;
  display: flex;
  justify-content: center;
}

.preview-team--pro {
  background: #C43535;
  justify-content: flex-start;
}

.preview-team--con {
  background: #0077B6;
  justify-content: flex-end;
}

.preview-team-name {
  font-size: 12px;
  font-weight: 700;
  color: #FFFFFF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-center {
  text-align: center;
}

.preview-countdown {
  font-size: 40px;
  font-weight: 900;
  color: #FFFFFF;
  font-family: 'Courier New', monospace;
  letter-spacing: 4px;
}

.preview-phase-name {
  font-size: 18px;
  font-weight: 700;
  color: #FFFFFF;
  margin-top: 4px;
}

/* 控制按钮组 */
.preview-controls {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: #FFFFFF;
  border-top: 1px solid #F3F4F6;
}

.preview-btn {
  flex: 1;
  height: 36px;
  padding: 0 8px;
  font-size: 13px;
  color: #4B5563;
  background: #FFFFFF;
  border: 1px solid #DEE0E3;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.preview-btn:hover:not(:disabled) {
  background: #F2F3F5;
}

.preview-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.preview-btn--primary {
  color: #3B82F6;
  border-color: #3B82F6;
}

/* 帮助信息卡 */
.info-card {
  background: #FFFFFF;
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
}

.info-card-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1F2937;
  margin-bottom: 2px;
}

.info-card-link {
  font-size: 13px;
  color: #3B82F6;
  text-decoration: none;
}

.info-card-link:hover {
  text-decoration: underline;
}

/* ═══════════ 右侧面板 ═══════════ */
.right-panel {
  flex: 1;
  min-width: 0;
}
</style>
