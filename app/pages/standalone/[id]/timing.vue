<!--
  timing.vue - 计时器环节配置页面
  功能：
  - 左侧 TimerPreview 实时预览计时器效果
  - 右侧配置计时器环节（名称、类型、时长等）
  - 支持环节的增删改、排序、上下移动
  - 配置修改实时同步到数据库（timer-config API）
  - 移除导入/导出功能，仅保留配置管理
-->
<script setup lang="ts">
definePageMeta({ layout: 'standalone' })

// ═══════════ 导入 ═══════════
import { computed, ref, onMounted, watch, watchEffect } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'
import StageForm from '~/components/StageForm.vue'
import { debateTemplates } from '~/data/debate-templates'

// ═══════════ 类型定义 ═══════════
interface Stage {
  id: number | string
  name: string
  duration: number
  type: string
  description?: string
  order?: number
  orderIndex?: number
  positiveDuration?: number
  negativeDuration?: number
  // 角色相关
  speaker?: string
  questioner?: string
  responder?: string
  firstSpeaker?: string
  protectionTime?: number
  // 对辩双方参与辩手（多选）
  positiveSpeakers?: string[]
  negativeSpeakers?: string[]
  // 单方发问拆分时长
  questionDuration?: number
  answerDuration?: number
  // 无计时器环节的可发言角色（multi-select，角色 label 列表）
  speakers?: string[]
  // 启用开关
  enabled?: boolean
  // PPT/图片展示环节的图片路径
  pptImage?: string
}

// ═══════════ 基础工具 ═══════════
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

// ═══════════ 数据模型 ═══════════
const standaloneMatch = inject<Ref<any>>('standaloneMatch')!
const loading = ref(false)
const saving = ref(false)
const matchId = computed(() => route.params.id as string)

// 预览当前环节索引
const previewStageIndex = ref(0)

// 展开的环节 ID
const expandedId = ref<number | string | null>(null)

// 模板选择弹窗
const showTemplateModal = ref(false)


// 应用选定的模板
function applyTemplate(tplId: string) {
  const tpl = debateTemplates.find(t => t.id === tplId)
  if (!tpl) return
  fullConfig.value.stages = tpl.stages.map(s => ({
    id: genTmpId(),
    ...s,
    // 模板用 1-based 的 order，真实 Stage 用 orderIndex 排序，这里做一次映射
    orderIndex: s.order,
  }))
  showTemplateModal.value = false
}

// ═══════════ 拖拽排序状态 ═══════════
// 当前被拖拽的卡片 id
const dragSourceId = ref<string | number | null>(null)
// 当前拖拽悬浮的目标卡片 id
const dragOverId = ref<string | number | null>(null)

// 完整的计时器配置
const fullConfig = ref<{
  name: string
  title: string
  positiveTopic: string
  negativeTopic: string
  teamPositiveName: string
  teamNegativeName: string
  uiConfig: Record<string, any>
  skinConfig: Record<string, any>
  audioConfig: Record<string, any>
  teamLogoConfig: Record<string, any>
  stages: Stage[]
}>({
  name: '',
  title: '',
  positiveTopic: '',
  negativeTopic: '',
  teamPositiveName: '',
  teamNegativeName: '',
  uiConfig: {},
  skinConfig: {},
  audioConfig: {},
  teamLogoConfig: {},
  stages: [],
})

// 生成临时 ID（前端新建环节用，保存后由 DB 生成真实 uuid 替换）
function genTmpId(): string {
  return 'tmp_' + (crypto?.randomUUID?.() || Date.now() + '_' + Math.random().toString(36).slice(2))
}

// ═══════════ 分类栏数据 ═══════════
const timerCountTypes = [
  { type: 'single_speech', name: '单计时器环节', label: '单计时器' },
  { type: 'bilateral_debate', name: '双计时器环节', label: '双计时器' },
  { type: 'no_timer', name: '无计时器环节', label: '无计时器' },
]
const speechTypes = [
  { name: '立论' },
  { name: '驳论' },
  { name: '小结' },
  { name: '总结陈词' },
]
const questionTypes = [
  { name: '质询' },
  { name: '盘问' },
]
const dualTypes = [
  { name: '对辩' },
  { name: '自由辩论' },
]

// typeLabel / hasTimer / isDualTimer 统一使用 app/utils/stageType.ts 的实现（Nuxt 4 自动导入）

// 获取环节对应的角色信息（用于卡片头标题显示）
function getStageSpeaker(stage: any): string {
  const t = stage.type
  const speaker = stage.speaker
  const questioner = stage.questioner
  const responder = stage.responder
  const first = stage.firstSpeaker

  // 单方发言：正方一辩·开篇陈词
  if (t === 'single_speech' || t === 'speech' || t === 'question' || t === 'summary') {
    return (speaker || '正方·一辩').replace(/[·\/\s\-]/g, '')
  }
  // 单方发问：反方二辩·质询·正方一辩
  if (t === 'single_question') {
    return `${(questioner || '反方·二辩').replace(/[·\/\s\-]/g, '')}·${stage.name || ''}·${(responder || '正方·一辩').replace(/[·\/\s\-]/g, '')}`
  }
  // 双边对辩/自由辩论：正方一辩·自由辩论
  if (isDualTimer(t)) {
    return (first || '正方·一辩').replace(/[·\/\s\-]/g, '')
  }
  return ''
}

// ═══════════ 数据加载 ═══════════
async function loadConfig() {
  loading.value = true
  try {
    // 从 inject 的 tournament 中获取赛事基本信息
    if (standaloneMatch.value) {
      fullConfig.value.name = standaloneMatch.value.name
      fullConfig.value.title = standaloneMatch.value.name
    }

    // 加载计时器配置
    const configRes = await $fetch<any>(`/api/standalone-matches/${matchId.value}/timer-config`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })

    if (configRes?.data) {
      const cfg = configRes.data
      fullConfig.value.name = cfg.name || fullConfig.value.name
      fullConfig.value.title = cfg.title || fullConfig.value.title
      fullConfig.value.positiveTopic = cfg.positiveTopic || ''
      fullConfig.value.negativeTopic = cfg.negativeTopic || ''
      fullConfig.value.teamPositiveName = cfg.teamPositiveName || ''
      fullConfig.value.teamNegativeName = cfg.teamNegativeName || ''
      fullConfig.value.uiConfig = cfg.uiConfig || {}
      fullConfig.value.skinConfig = cfg.skinConfig || {}
      fullConfig.value.audioConfig = cfg.audioConfig || {}
      fullConfig.value.teamLogoConfig = cfg.teamLogoConfig || {}
      fullConfig.value.stages = (cfg.stages || []).map((s: any) => ({ ...s, type: normalizeStageType(s.type) })) as Stage[]

      // 如果 stages 为空，使用默认环节
      if (fullConfig.value.stages.length === 0) {
        fullConfig.value.stages = getDefaultStages()
      }
    } else {
      // 新配置，使用默认环节
      fullConfig.value.stages = getDefaultStages()
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// 获取默认环节
function getDefaultStages(): Stage[] {
  return [
    { id: 1, name: '开篇立论', duration: 180, type: 'single_speech', order: 1 },
    { id: 2, name: '攻辩', duration: 120, type: 'single_speech', order: 2 },
    { id: 3, name: '自由辩论', duration: 240, type: 'free_debate', order: 3, positiveDuration: 120, negativeDuration: 120 },
    { id: 4, name: '总结陈词', duration: 180, type: 'single_speech', order: 4 },
  ]
}

// ═══════════ 数据保存 ═══════════
async function saveConfig() {
  if (saving.value) return // 防重复
  saving.value = true
  const expandedIdx = expandedId.value
    ? fullConfig.value.stages.findIndex(s => s.id === expandedId.value)
    : -1
  try {
    const res = await $fetch<any>(`/api/standalone-matches/${matchId.value}/timer-config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: {
        title: fullConfig.value.title,
        positiveTopic: fullConfig.value.positiveTopic,
        negativeTopic: fullConfig.value.negativeTopic,
        teamPositiveName: fullConfig.value.teamPositiveName,
        teamNegativeName: fullConfig.value.teamNegativeName,
        uiConfig: fullConfig.value.uiConfig,
        skinConfig: fullConfig.value.skinConfig,
        audioConfig: fullConfig.value.audioConfig,
        teamLogoConfig: fullConfig.value.teamLogoConfig,
        stages: fullConfig.value.stages,
      },
    })
    if (res?.data?.stages && Array.isArray(res.data.stages)) {
      fullConfig.value.stages = res.data.stages
      if (expandedIdx >= 0 && expandedIdx < res.data.stages.length) {
        expandedId.value = res.data.stages[expandedIdx].id
      }
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    saving.value = false
  }
}

// ═══════════ 环节操作 ═══════════
function addStageByType(type: string, name: string) {
  const newStage: Stage = {
    id: genTmpId(),
    name,
    duration: type === 'special' ? 0 : 180,
    type: type as Stage['type'],
    orderIndex: fullConfig.value.stages.length + 1,
    description: '',
  }
  if (type === 'dual-timer') {
    newStage.positiveDuration = 120
    newStage.negativeDuration = 120
  }
  fullConfig.value.stages.push(newStage)
  expandedId.value = newStage.id
}

function removeStage(idx: number) {
  if (fullConfig.value.stages.length <= 1) {
    toast.add({ title: '至少保留一个环节', color: 'info' })
    return
  }
  const removed = fullConfig.value.stages[idx]
  fullConfig.value.stages.splice(idx, 1)
  if (expandedId.value === removed?.id) expandedId.value = null
}

function duplicateStage(idx: number) {
  const original = fullConfig.value.stages[idx]
  if (!original) return
  const copy: Stage = {
    ...JSON.parse(JSON.stringify(original)),
    id: genTmpId(),
    name: original.name + ' (副本)',
    orderIndex: fullConfig.value.stages.length + 1,
  }
  fullConfig.value.stages.splice(idx + 1, 0, copy)
  expandedId.value = copy.id
}

// ═══════════ 拖拽排序（替代按钮移动）═══════════
// 记录被拖拽的源卡片 id
function onDragStart(e: DragEvent, id: string | number) {
  dragSourceId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }
}

// 标记当前悬浮目标
function onDragOver(e: DragEvent, id: string | number) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  if (dragOverId.value !== id) dragOverId.value = id
}

// 离开目标时清除标记
function onDragLeave(id: string | number) {
  if (dragOverId.value === id) dragOverId.value = null
}

// 放置时重排序
function onDrop(targetId: string | number) {
  if (dragSourceId.value === null || dragSourceId.value === targetId) return
  const sourceIdx = fullConfig.value.stages.findIndex(s => s.id === dragSourceId.value)
  const targetIdx = fullConfig.value.stages.findIndex(s => s.id === targetId)
  if (sourceIdx < 0 || targetIdx < 0) return
  const [item] = fullConfig.value.stages.splice(sourceIdx, 1)
  if (item) fullConfig.value.stages.splice(targetIdx, 0, item)
  dragOverId.value = null
}

// 拖拽结束清理
function onDragEnd() {
  dragSourceId.value = null
  dragOverId.value = null
}

function toggleExpand(id: number | string) {
  expandedId.value = expandedId.value === id ? null : id
}

// ═══════════ StageForm 数据回写 ═══════════
// 处理 StageForm 返回的表单数据，同步到 stage 对象
function onStageFormUpdate(stage: Stage, formData: {
  type: string
  name: string
  duration: number
  protectionTime: number
  speaker?: string
  questioner?: string
  responder?: string
  firstSpeaker?: string
  positiveSpeakers?: string[]
  negativeSpeakers?: string[]
  speakers?: string[]
  questionDuration?: number
  answerDuration?: number
  pptImage?: string
}) {
  stage.type = formData.type
  stage.name = formData.name
  stage.protectionTime = formData.protectionTime
  stage.speaker = formData.speaker
  stage.questioner = formData.questioner
  stage.responder = formData.responder
  stage.firstSpeaker = formData.firstSpeaker
  stage.positiveSpeakers = formData.positiveSpeakers
  stage.negativeSpeakers = formData.negativeSpeakers
  stage.speakers = formData.speakers
  stage.questionDuration = formData.questionDuration
  stage.answerDuration = formData.answerDuration
  stage.pptImage = formData.pptImage || ''

  // 根据类型设置 duration
  const t = formData.type
  if (isDualTimer(t)) {
    stage.positiveDuration = formData.duration
    stage.negativeDuration = formData.duration
  } else if (isNoTimer(t) || isPpt(t)) {
    stage.duration = 0
  } else if (isQuestion(t)) {
    // 单方发问：环节总时长 = 提问时长（已去除回答时长）
    stage.duration = formData.questionDuration || 0
  } else {
    stage.duration = formData.duration
  }
}

// ═══════════ 生命周期 ═══════════
onMounted(() => loadConfig())

// 配置变化时自动保存（防抖）
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => fullConfig.value.stages,
  () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      if (!loading.value) saveConfig()
    }, 1500)
  },
  { deep: true }
)

// 卸载时 flush 未保存的修改，避免切页丢失
onBeforeUnmount(() => {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveConfig()
  }
})
</script>

<template>
  <template v-if="standaloneMatch">
  <!-- ═══ 主内容：左侧实时预览 + 右侧环节配置（左右并排，左1/3 + 右2/3） ═══ -->
  <div class="py-6 grid grid-cols-12 gap-6">

    <!-- ═══ 左侧：实时预览（左4列，约1/3宽度） ═══ -->
    <div class="col-span-4">
      <TimerPreviewCard
        :full-config="fullConfig"
        :tournament-id="matchId"
        type="standalone"
        v-model:stage-index="previewStageIndex"
      />
    </div>

    <!-- ═══ 右侧：环节配置（右8列，约2/3宽度） ═══ -->
    <div class="col-span-8 space-y-4">
      <div class="stages-config-card">
        <div class="flex gap-4 stages-flex-container">
          <!-- 左侧分类栏 -->
          <div class="category-sidebar stages-sidebar-scroll">
            <!-- 计时器数量 -->
            <div class="category-group">
              <h4 class="category-title">
                <UIcon name="i-lucide-timer" class="w-4 h-4 mr-1" />
                计时器数量
              </h4>
              <button
                v-for="item in timerCountTypes"
                :key="item.type"
                class="category-btn"
                @click="addStageByType(item.type, item.name)"
              >
                <span>{{ item.label }}</span>
                <span class="text-lg">+</span>
              </button>
            </div>
            <!-- 单方发言 -->
            <div class="category-group">
              <h4 class="category-title">
                <UIcon name="i-lucide-message-circle" class="w-4 h-4 mr-1" />
                单方发言
              </h4>
              <button
                v-for="item in speechTypes"
                :key="item.name"
                class="category-btn"
                @click="addStageByType('single_speech', item.name)"
              >
                <span>{{ item.name }}</span>
                <span class="text-lg">+</span>
              </button>
            </div>
            <!-- 单方发问 -->
            <div class="category-group">
              <h4 class="category-title">
                <UIcon name="i-lucide-help-circle" class="w-4 h-4 mr-1" />
                单方发问
              </h4>
              <button
                v-for="item in questionTypes"
                :key="item.name"
                class="category-btn"
                @click="addStageByType('single_question', item.name)"
              >
                <span>{{ item.name }}</span>
                <span class="text-lg">+</span>
              </button>
            </div>
            <!-- 双边对辩 -->
            <div class="category-group">
              <h4 class="category-title">
                <UIcon name="i-lucide-check-circle" class="w-4 h-4 mr-1" />
                双边对辩
              </h4>
              <button
                v-for="item in dualTypes"
                :key="item.name"
                class="category-btn"
                @click="addStageByType('bilateral_debate', item.name)"
              >
                <span>{{ item.name }}</span>
                <span class="text-lg">+</span>
              </button>
            </div>
          </div>

          <!-- 右侧环节列表 -->
          <div class="flex-1 stages-right-container">
            <!-- 空状态 -->
            <div v-if="fullConfig.stages.length === 0" class="empty-state">
              <UIcon name="i-lucide-clock" class="w-10 h-10 mx-auto mb-2 text-white/30" />
              <p>从左侧分类栏添加计时环节</p>
            </div>

            <!-- 环节卡片列表 -->
            <!-- 环节卡片列表（可拖拽排序）-->
            <div class="stages-scroll">
              <!-- 顶部：使用模板按钮（随列表滚动） -->
              <button class="template-btn" @click="() => { showTemplateModal = true }">
                <UIcon name="i-lucide-download" class="template-btn-icon" />
                <span>使用模板</span>
              </button>
              <div
                v-for="(stage, idx) in fullConfig.stages"
                :key="stage.id"
                class="stage-card"
                :class="{
                  'stage-card--dragging': dragSourceId === stage.id,
                  'stage-card--over': dragOverId === stage.id
                }"
                draggable="true"
                @dragstart="onDragStart($event, stage.id)"
                @dragover.prevent="onDragOver($event, stage.id)"
                @dragleave="onDragLeave(stage.id)"
                @drop.prevent="onDrop(stage.id)"
                @dragend="onDragEnd"
              >
                <!-- 卡片头（新状态栏风格，可拖拽排序）-->
                <div class="stage-card-header" @click="toggleExpand(stage.id)">
                  <!-- 拖拽把手 + 序号：用户按住此处拖动 -->
                  <div class="stage-order stage-order--handle" title="拖动调整顺序">
                    <span>{{ idx + 1 }}</span>
                  </div>

                  <!-- 左侧标签组：类/类型/时/时间 -->
                  <div class="stage-header-tags">
                    <span class="status-tag status-tag--green">类</span>
                    <span class="status-tag status-tag--white status-tag--type">{{ typeLabel(stage.type) }}</span>
                    <span class="status-tag status-tag--green">时</span>
                    <span v-if="hasTimer(stage.type)" class="status-tag status-tag--white status-tag--time">
                      {{ isDualTimer(stage.type)
                          ? `${stage.positiveDuration ?? stage.duration}/${stage.negativeDuration ?? stage.duration}`
                          : stage.duration
                      }}
                    </span>
                  </div>

                  <!-- 右侧标题：动态文本 -->
                  <div class="stage-header-title">
                    <template v-if="hasTimer(stage.type)">
                      <template v-if="stage.type === 'single_speech' || stage.type === 'speech' || stage.type === 'summary'">
                        {{ (stage.speaker || '正方·一辩').replace(/[·\/\s\-]/g, '') }}·{{ stage.name }}
                      </template>
                      <template v-else-if="stage.type === 'single_question'">
                        {{ (stage.questioner || '反方·二辩').replace(/[·\/\s\-]/g, '') }}·{{ stage.name }}·{{ (stage.responder || '正方·一辩').replace(/[·\/\s\-]/g, '') }}
                      </template>
                      <template v-else-if="isDualTimer(stage.type)">
                        <template v-if="normalizeStageType(stage.type) === 'free_debate'">{{ stage.name }}</template>
                        <template v-else>{{ (stage.firstSpeaker || '正方·一辩').replace(/[·\/\s\-]/g, '') }}·{{ stage.name }}</template>
                      </template>
                      <template v-else>
                        {{ stage.name }}
                      </template>
                    </template>
                    <template v-else>
                      {{ stage.name }}
                    </template>
                  </div>
                </div>
                <!-- 展开的详情（使用新的 StageForm 组件）-->
                <div v-if="expandedId === stage.id" class="stage-card-body">
                  <!-- 动态表单：根据环节类型展示不同字段 -->
                  <StageForm
                    :model-value="{
                      type: stage.type,
                      name: stage.name,
                      duration: isDualTimer(stage.type) ? (stage.positiveDuration ?? 120) : (stage.duration ?? 180),
                      protectionTime: stage.protectionTime ?? 0,
                      speaker: stage.speaker || '正方 · 一辩',
                      questioner: stage.questioner || '反方 · 二辩',
                      responder: stage.responder || '正方 · 一辩',
                      firstSpeaker: stage.firstSpeaker || '正方 · 一辩',
                      positiveSpeakers: stage.positiveSpeakers || [],
                      negativeSpeakers: stage.negativeSpeakers || [],
                      speakers: stage.speakers || [],
                      questionDuration: stage.questionDuration ?? 0,
                      answerDuration: stage.answerDuration ?? 0,
                      pptImage: stage.pptImage || '',
                    }"
                    @update:model-value="(val) => onStageFormUpdate(stage, val)"
                  />

                  <!-- 底部操作按钮 -->
                  <div class="stage-card-actions">
                    <button class="action-btn action-btn--copy" @click.stop="duplicateStage(idx)">
                      <UIcon name="i-lucide-copy" class="w-4 h-4" />
                      复制
                    </button>
                    <button class="action-btn action-btn--delete" @click.stop="removeStage(idx)">
                      <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                      删除
                    </button>
                  </div>
                </div>
              </div>

              <!-- 底部：添加一个环节（随列表滚动） -->
              <button class="add-stage-btn" @click="addStageByType('single_speech', '新环节')">
                <span class="add-stage-plus">＋</span>
                <span>添加一个环节</span>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 模板选择弹窗 ═══ -->
    <div v-if="showTemplateModal" class="template-modal-mask" @click.self="showTemplateModal = false">
      <div class="template-modal">
        <div class="template-modal-header">
          <h3 class="text-lg font-bold text-[var(--color-text-primary)]/90">选择计时器模板</h3>
          <button class="template-modal-close" @click="() => { showTemplateModal = false }">×</button>
        </div>
        <div class="template-modal-body">
          <div
            v-for="tpl in debateTemplates"
            :key="tpl.id"
            class="template-item"
          >
            <div class="template-item-info">
              <div class="template-item-name">{{ tpl.name }}</div>
              <div class="template-item-desc">{{ tpl.description }}</div>
              <div class="template-item-count">共 {{ tpl.stages.length }} 个环节</div>
            </div>
            <button class="template-item-btn" @click="applyTemplate(tpl.id)">
              使用该模板
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </template>
</template>

<style scoped>
/* 深色玻璃拟态样式已由全局 main.css 中的 .tab-dark-* 类提供，此处无需额外 scoped 样式 */

/* ═══════════ 分类栏与环节配置 ═══════════ */
.category-sidebar {
  width: 11.25rem;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  padding: 0.75rem;
}

.category-group {
  margin-bottom: 1rem;
}

.category-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
}

.category-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 0.25rem;
}

.category-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

.empty-state {
  text-align: center;
  padding: 3.75rem 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

/* 环节卡片 —— 可拖拽排序 */
.stage-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  overflow: hidden;
  cursor: grab;
  transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s, opacity 0.2s;
  user-select: none;
}

.stage-card:active {
  cursor: grabbing;
}

.stage-card--dragging {
  opacity: 0.5;
  transform: scale(0.98);
  box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.2);
  border-style: dashed;
  border-color: var(--color-accent-primary);
}

.stage-card--over {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.stage-card-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 0.75rem;
  cursor: pointer;
  gap: 0.75rem;
  background-color: rgba(99, 102, 241, 0.08);
  transition: background-color 0.2s;
}

.stage-card-header:hover {
  background-color: rgba(99, 102, 241, 0.15);
}

.stage-order {
  min-width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  background: var(--color-accent-primary);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 700;
  flex-shrink: 0;
  cursor: grab;
}

.stage-order:active {
  cursor: grabbing;
}

.stage-header-tags {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.1875rem 0.5rem;
  font-size: 0.75rem;
  border-radius: 0.25rem;
  flex-shrink: 0;
  line-height: 1.4;
  white-space: nowrap;
}

.status-tag--green {
  color: #FFFFFF;
  background-color: var(--color-accent-primary);
  font-weight: 500;
}

.status-tag--white {
  color: var(--color-text-secondary);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  font-weight: 500;
}

.status-tag--type {
  font-size: 0.875rem;
  padding: 0.1875rem 0.625rem;
}

.status-tag--time {
  font-variant-numeric: tabular-nums;
  min-width: 2rem;
}

.stage-header-title {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ═══════════ 卡片展开表单 ═══════════ */
.stage-card-body {
  padding: 1rem 0.75rem 0.75rem;
  border-top: 1px solid var(--color-border);
}

.stage-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
  margin-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--color-bg-secondary);
}

.action-btn--copy:hover {
  color: #60A5FA;
  border-color: #60A5FA;
}

.action-btn--delete:hover {
  color: #F87171;
  border-color: #F87171;
}

/* ═══════════ 使用模板按钮 ═══════════ */
.template-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.3rem 0.75rem;
  border-radius: 0.5rem;
  border: 1.5px dashed var(--color-accent-primary);
  background: transparent;
  color: var(--color-accent-primary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: 0.5rem;
}

.template-btn:hover {
  background: rgba(99, 102, 241, 0.06);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

.template-btn-icon {
  width: 0.85rem;
  height: 0.85rem;
}

/* ═══════════ 模板选择弹窗样式 ═══════════ */
.template-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-modal {
  background: var(--color-bg-secondary);
  backdrop-filter: blur(16px);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  width: 32rem;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.template-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
}

.template-modal-close {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.template-modal-close:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.template-modal-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.template-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
  transition: all 0.15s ease;
}

.template-item:hover {
  border-color: var(--color-accent-primary);
  background: rgba(99, 102, 241, 0.04);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

.template-item:last-child {
  margin-bottom: 0;
}

.template-item-info {
  flex: 1;
  min-width: 0;
}

.template-item-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 0.25rem;
}

.template-item-desc {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
}

.template-item-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.template-item-btn {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-accent-primary);
  background: transparent;
  border: 1.5px solid var(--color-accent-primary);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.template-item-btn:hover {
  background: var(--color-accent-primary);
  color: #FFFFFF;
}

/* ═══════════ 添加环节按钮 ═══════════ */
.add-stage-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1.5px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-top: 0.5rem;
}

.add-stage-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.add-stage-plus {
  font-size: 1.1rem;
  line-height: 1;
}

/* ═══════════ 高度与溢出控制 ═══════════ */
.stages-config-card {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stages-flex-container {
  position: relative;
  min-height: 0;
}

.category-sidebar {
  position: absolute;
  left: 0;
  top: 0;
  width: 11.25rem;
  height: 100%;
  border-right: 1px solid var(--color-border);
  padding: 0.75rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.stages-right-container {
  margin-left: calc(11.25rem + 1rem);
  min-width: 0;
}

.stages-scroll {
  overflow-y: auto;
  max-height: 72vh;
  padding-bottom: 0.25rem;
}
</style>
