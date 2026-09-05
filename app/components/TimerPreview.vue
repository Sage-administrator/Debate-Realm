<!--
  TimerPreview.vue - 计时器实时预览组件
  功能：
  - 复刻正式计时器页面的核心视觉效果（横幅、队伍名、赛事标题、环节名、计时器显示）
  - 视觉渲染全部委托给 TimerDisplay（与正式计时页共用同一组件，保证 100% 一致）
  - 本组件只负责：固定 1280x720 基准画布 + transform scale 等比例缩放填满容器
  - 预览仅展示静态初始时长，不实际倒计时、不含控制面板/设置弹窗
-->
<template>
  <!-- 外层：占满父容器的定位容器（position: relative） -->
  <!-- ref 用于获取容器实际尺寸，动态计算 1280x720 画布的缩放比例 -->
  <div ref="containerRef" class="h-full w-full timer-preview-container" :style="containerStyle">
    <!-- 内层：固定 1280x720px 的基准画布，用 transform scale 等比例缩放填满容器 -->
    <div class="scale-wrapper" :style="scaleWrapperStyle">
      <TimerDisplay
        :contest-title="contestTitle"
        :positive-topic="positiveTopic"
        :negative-topic="negativeTopic"
        :team-positive-name="teamPositiveName"
        :team-negative-name="teamNegativeName"
        :positive-label="positiveLabel"
        :negative-label="negativeLabel"
        :ui-config="uiConfig"
        :skin-config="skinConfig"
        :team-logo-config="teamLogoConfig"
        :current-stage-info="currentStageInfo"
        :is-dual-timer-stage="isDualTimerStage"
        :is-special-stage="isSpecialStage"
        :display-time="displayTime"
        :is-time-warning="false"
        :is-time-critical="false"
        :dual-positive-time="dualPositiveTime"
        :dual-negative-time="dualNegativeTime"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// ═══════════ 导入 ═══════════
import { computed, onMounted, onUnmounted, ref } from 'vue'
import TimerDisplay from '~/components/TimerDisplay.vue'


// ═══════════ 类型定义 ═══════════
interface StageInfo {
  id: number | string
  name: string
  duration: number
  type: 'speech' | 'question' | 'summary' | 'special' | 'dual-timer'
        | 'single_speech' | 'single_question' | 'bilateral_debate' | 'free_debate'
        | 'no_timer' | 'single_timer' | 'double_timer' | 'ppt_replace' | string
  description?: string
  order?: number
  positiveDuration?: number
  negativeDuration?: number
  allowedRoles?: string[]
  // 环节扩展字段（展示用）
  speaker?: string
  questioner?: string
  responder?: string
  responders?: string[] // 单方发问接受人（多选）
  firstSpeaker?: string
  [key: string]: any
}

interface UIConfig {
  bannerVisible?: boolean
  eventNameVisible?: boolean
  showBanner?: boolean
  showTitle?: boolean
  bannerPos?: number
  bannerFontSize?: number
  bannerColorPos?: string
  bannerColorNeg?: string
  bannerFontColorPos?: string
  bannerFontColorNeg?: string
  eventColor?: string
  titleColor?: string
  teamNameColor?: string
  eventFontSize?: number
  backgroundType?: 'default' | 'image' | 'custom' | 'gradient' | 'solid'
  imageFileName?: string
  backgroundGradient?: string
  positiveLabel?: string
  negativeLabel?: string
  [key: string]: any
}

interface SkinConfig {
  backgroundType?: 'default' | 'gradient' | 'image' | 'solid'
  gradientStart?: string
  gradientEnd?: string
  solidColor?: string
  imageUrl?: string
  [key: string]: any
}

interface AudioConfig {
  enabled?: boolean
  /** 剩余 30 秒提示音 */
  warningSound?: string
  /** 剩余 5 秒提示音 */
  finalWarningSound?: string
  /** 时间到（0 秒）提示音 */
  timeUpSound?: string
  [key: string]: any
}

interface TeamLogoConfig {
  positiveLogoUrl?: string
  negativeLogoUrl?: string
  showTeamLogo?: boolean
  [key: string]: any
}

// ═══════════ Props 定义 ═══════════
const props = defineProps<{
  // 赛事基本信息
  contestTitle?: string
  positiveTopic?: string
  negativeTopic?: string
  teamPositiveName?: string
  teamNegativeName?: string
  positiveLabel?: string
  negativeLabel?: string

  // 环节配置
  stages?: StageInfo[]
  currentStageIndex?: number

  // UI 配置
  uiConfig?: UIConfig

  // 皮肤/背景配置
  skinConfig?: SkinConfig

  // 提示音配置
  audioConfig?: AudioConfig

  // 队徽配置
  teamLogoConfig?: TeamLogoConfig

  // UI 缩放
  scale?: number
}>()

// ═══════════ 默认值处理 ═══════════
const contestTitle = computed(() => props.contestTitle || '辩论赛')
const positiveTopic = computed(() => props.positiveTopic || '')
const negativeTopic = computed(() => props.negativeTopic || '')
const teamPositiveName = computed(() => props.teamPositiveName || '')
const teamNegativeName = computed(() => props.teamNegativeName || '')
const positiveLabel = computed(() => props.positiveLabel || props.uiConfig?.positiveLabel || '正方')
const negativeLabel = computed(() => props.negativeLabel || props.uiConfig?.negativeLabel || '反方')

// 合并 uiConfig：将用户传入的 uiConfig 与默认值合并
const uiConfig = computed<UIConfig>(() => {
  const defaults: UIConfig = {
    bannerVisible: true,
    eventNameVisible: true,
    backgroundType: 'default',
    imageFileName: '',
    fontFamily: '',
    titleFontFamily: '',
    stageTitleFontFamily: '',
    bannerFontFamily: '',
    teamNameFontFamily: '',
    timerFontFamily: '',
    bannerPos: 0,
    bannerHeight: 5,
    bannerFontSize: 21,
    labelFontSize: 38,
    bannerColorPos: 'rgb(169, 35, 35)',
    bannerColorNeg: 'rgb(3, 105, 161)',
    bannerFontColorPos: 'white',
    bannerFontColorNeg: 'white',
    eventColor: 'rgb(3, 105, 161)',
    titleColor: 'rgb(3, 105, 161)',
    teamNameColor: 'white',
    stageTitleColor: 'white',
    timerColor: 'white',
    dualTimerColorPos: 'rgb(169, 35, 35)',
    dualTimerColorNeg: 'rgb(3, 105, 161)',
    eventFontSize: 50,
    stageTitleFontSize: 64,
    teamNameFontSize: 21,
    timerFontSize: 200,
    contentPaddingTop: 56,
    titleMarginBottom: 12,
    stageTimerGap: 10,
    positiveLabel: '正方',
    negativeLabel: '反方'
  }
  return { ...defaults, ...(props.uiConfig || {}) }
})

// ═══════════ 环节相关计算 ═══════════
const currentStageIndex = computed(() => props.currentStageIndex ?? 0)
const stages = computed(() => props.stages || [])
const currentStageInfo = computed(() => stages.value[currentStageIndex.value] || null)
const isDualTimerStage = computed(() => isDualTimer(currentStageInfo.value?.type))
const isSpecialStage = computed(() => isNoTimer(currentStageInfo.value?.type))

// ═══════════ 预览用计时器状态（不实际倒计时） ═══════════
// 使用环节的初始时长作为预览的时间显示
const timeRemaining = computed(() => {
  const info = currentStageInfo.value
  if (!info || isDualTimer(info.type) || isNoTimer(info.type)) return 0
  return info.duration || 0
})

function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 单计时器展示文本：补齐为 5 位（00:00）
const displayTime = computed(() => formatTime(timeRemaining.value).padStart(5, '0'))

// 双计时器展示文本
const dualPositiveTime = computed(() => {
  const info = currentStageInfo.value
  if (!info) return '00:00'
  return formatTime(info.positiveDuration ?? info.duration ?? 0)
})
const dualNegativeTime = computed(() => {
  const info = currentStageInfo.value
  if (!info) return '00:00'
  return formatTime(info.negativeDuration ?? info.duration ?? 0)
})

// ═══════════ 1280x720 基准画布 + 动态缩放计算 ═══════════
const containerRef = ref<HTMLElement | null>(null)
const previewScale = ref(1)

function updatePreviewScale() {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  // 容器是 16:9 的，取宽度计算等比例缩放
  const scale = rect.width / 1280
  previewScale.value = scale > 0 ? scale : 1
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  requestAnimationFrame(() => {
    updatePreviewScale()
  })
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      updatePreviewScale()
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

// scale-wrapper 样式：固定 1280x720px 基准画布 + transform scale 等比例缩放
const scaleWrapperStyle = computed(() => {
  const userScale = props.scale ?? 1
  const finalScale = previewScale.value * userScale
  return {
    width: '1280px',
    height: '720px',
    transform: `translate(-50%, -50%) scale(${finalScale})`,
    transformOrigin: 'center center',
  }
})

// 外层兜底背景（画布内 TimerDisplay 也会绘制相同背景）
const containerStyle = computed(() => ({
  background: 'radial-gradient(ellipse at center bottom, rgb(57, 76, 86) 0%, rgb(14, 17, 17) 100%)'
}))
</script>

<style scoped>
/* 预览容器（16:9 比例），负责背景色与定位 */
.timer-preview-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center bottom, rgb(57, 76, 86) 0%, rgb(14, 17, 17) 100%);
  overflow: hidden;
}

/* 缩放包装：固定 1280x720px（模拟真实屏幕的基准画布）
   transform scale 等比例缩放到预览容器大小 */
.scale-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
}
</style>
