<!--
  TimerPreview.vue - 计时器实时预览组件
  功能：
  - 复刻正式计时器页面的核心视觉效果（横幅、队伍名、赛事标题、环节名、计时器显示）
  - 不包含：左下角快捷键区域、右下角控制模块及初始进入弹窗（正式环境元素）
  - 支持实时预览：计时器环节、背景样式、界面元素、提示音效果及队徽显示
-->
<template>
  <!-- 外层：占满父容器的定位容器（position: relative） -->
  <!-- ref 用于获取容器实际尺寸，动态计算 1920x1080 画布的缩放比例 -->
  <div ref="containerRef" class="h-full w-full timer-preview-container" :style="containerStyle">
    <!-- 内层：固定 1920x1080px 的基准画布，用 transform scale 等比例缩放填满容器 -->
    <!-- 内部所有尺寸基于 1920x1080 基准用 px 定义，确保与正式计时器页面 100% 一致 -->
    <div class="scale-wrapper text-white overflow-hidden" :style="scaleWrapperStyle">
    <!-- 顶部辩题展示区（横幅） -->
    <!-- bannerVisible/showBanner 任一为 true 即显示（默认显示）-->
    <div class="debate-header" v-if="(uiConfig.bannerVisible !== false && uiConfig.showBanner !== false)">
      <div class="flex w-full" :style="{ marginTop: `${(uiConfig.bannerPos ?? 0) * 7.2}px` }">
        <!-- 正方横幅（红色） -->
        <div
          class="flex-1 debate-side-positive flex items-center"
          :style="{ backgroundColor: uiConfig.bannerColorPos || 'rgb(169, 35, 35)' }"
        >
          <div class="debate-label-white">
            <span class="font-bold" :style="{ color: uiConfig.bannerFontColorPos || 'white' }">
              {{ positiveLabel }}
            </span>
          </div>
          <div class="text-white font-bold debate-topic-text">{{ positiveTopic || '' }}</div>
        </div>
        <!-- 反方横幅（蓝色） -->
        <div
          class="flex-1 debate-side-negative flex items-center justify-end"
          :style="{ backgroundColor: uiConfig.bannerColorNeg || 'rgb(3, 105, 161)' }"
        >
          <div class="text-white font-bold text-right debate-topic-text debate-topic-right">
            {{ negativeTopic || '' }}
          </div>
          <div class="debate-label-white">
            <span class="font-bold" :style="{ color: uiConfig.bannerFontColorNeg || 'white' }">
              {{ negativeLabel }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 队伍名（横幅下方，空值不显示） + 队徽显示 -->
    <div class="flex w-full items-start justify-between px-4 mt-2">
      <div class="flex items-center gap-2" v-if="teamPositiveName || positiveLogoUrl">
        <!-- 正方队徽 -->
        <div v-if="positiveLogoUrl && showTeamLogo" class="team-logo-wrapper">
          <img :src="positiveLogoUrl" class="team-logo-img" alt="正方队徽" />
        </div>
        <div v-if="teamPositiveName" class="debate-topic-text" :style="{ color: uiConfig.teamNameColor || 'white' }">
          {{ teamPositiveName }}
        </div>
      </div>
      <div class="flex items-center gap-2" v-if="teamNegativeName || negativeLogoUrl">
        <div v-if="teamNegativeName" class="debate-topic-text debate-topic-right" :style="{ color: uiConfig.teamNameColor || 'white', textAlign: 'right' }">
          {{ teamNegativeName }}
        </div>
        <!-- 反方队徽 -->
        <div v-if="negativeLogoUrl && showTeamLogo" class="team-logo-wrapper">
          <img :src="negativeLogoUrl" class="team-logo-img" alt="反方队徽" />
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 赛事名称（eventNameVisible/showTitle 任一为 true 即显示，默认显示）-->
      <div class="text-center contest-title" v-if="(uiConfig.eventNameVisible !== false && uiConfig.showTitle !== false)">
        <h1
          class="font-bold contest-title-text contest-title-color"
          :style="{
            color: (uiConfig.titleColor || uiConfig.eventColor) || 'rgb(3, 105, 161)',
            fontSize: uiConfig.eventFontSize ? `${(uiConfig.eventFontSize / 16).toFixed(4)}rem` : ''
          }"
        >
          {{ contestTitle }}
        </h1>
      </div>

      <!-- 计时器区域 -->
      <div class="stage-timer-container">
        <!-- 当前环节名称 -->
        <div class="text-center stage-title">
          <h2 class="font-bold text-white" :class="isSpecialStage ? 'special-stage-text' : 'stage-title-text'">
            {{ currentStageFullTitle }}
          </h2>
        </div>

        <!-- 双计时器显示 -->
        <div v-if="isDualTimerStage" class="dual-timer-container">
          <div class="dual-timer-display">
            <div class="timer-side positive-side">
              <div class="digital-display">
                <span
                  v-for="(char, index) in formatTime(dualTimer.positiveTime)"
                  :key="`pos-${index}`"
                  class="digital-char"
                  :style="{ color: uiConfig.bannerFontColorPos || 'rgb(169, 35, 35)' }"
                >{{ char }}</span>
              </div>
              <div class="timer-label positive-label">{{ positiveLabel }}</div>
            </div>
            <div class="timer-side negative-side">
              <div class="digital-display">
                <span
                  v-for="(char, index) in formatTime(dualTimer.negativeTime)"
                  :key="`neg-${index}`"
                  class="digital-char"
                  :style="{ color: uiConfig.bannerFontColorNeg || 'rgb(3, 105, 161)' }"
                >{{ char }}</span>
              </div>
              <div class="timer-label negative-label">{{ negativeLabel }}</div>
            </div>
          </div>
        </div>

        <!-- 单计时器显示 -->
        <div v-else-if="!isSpecialStage" class="text-center timer-display-section">
          <div class="digital-display">
            <span
              v-for="(char, index) in displayTime"
              :key="index"
              class="digital-char"
              :class="{
                'text-orange-400': isTimeWarning,
                'text-red-400': isTimeCritical,
                'text-white': !isTimeWarning && !isTimeCritical
              }"
            >{{ char }}</span>
          </div>
        </div>
      </div>
    </div>

    </div>
  </div>
</template>

<script setup lang="ts">
// ═══════════ 导入 ═══════════
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'


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
  // ponytail: 以下为环节扩展字段（展示用），可选兼容
  speaker?: string
  questioner?: string
  responder?: string
  firstSpeaker?: string
}

interface UIConfig {
  bannerVisible?: boolean        /* 显示横幅/辩题（timer.vue 原生字段）*/
  eventNameVisible?: boolean     /* 显示比赛标题（timer.vue 原生字段）*/
  showBanner?: boolean           /* 显示横幅/辩题（details.vue 表单字段）*/
  showTitle?: boolean            /* 显示比赛标题（details.vue 表单字段）*/
  bannerPos?: number
  bannerFontSize?: number
  bannerColorPos?: string
  bannerColorNeg?: string
  bannerFontColorPos?: string
  bannerFontColorNeg?: string
  eventColor?: string            /* 标题颜色（timer.vue 原生字段）*/
  titleColor?: string            /* 标题颜色（details.vue 表单字段）*/
  teamNameColor?: string         /* 队伍名称颜色（details.vue 表单字段）*/
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
  startSound?: string
  endSound?: string
  warningSound?: string
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

// 队徽相关
const positiveLogoUrl = computed(() => props.teamLogoConfig?.positiveLogoUrl || '')
const negativeLogoUrl = computed(() => props.teamLogoConfig?.negativeLogoUrl || '')
const showTeamLogo = computed(() => props.teamLogoConfig?.showTeamLogo !== false)

// 提示音指示器（仅视觉反馈，不实际播放声音）
const audioIndicator = computed(() => props.audioConfig?.enabled === true)

// 合并 uiConfig：将用户传入的 uiConfig 与默认值合并
const uiConfig = computed<UIConfig>(() => {
  const defaults: UIConfig = {
    bannerVisible: true,
    eventNameVisible: true,
    backgroundType: 'default',
    imageFileName: '',
    bannerPos: 0,
    bannerFontSize: 20,
    bannerColorPos: '',
    bannerColorNeg: '',
    bannerFontColorPos: '',
    bannerFontColorNeg: '',
    eventColor: '',
    eventFontSize: 0,
    positiveLabel: '正方',
    negativeLabel: '反方'
  }
  return { ...defaults, ...(props.uiConfig || {}) }
})

// ═══════════ 环节相关计算 ═══════════
const currentStageIndex = computed(() => props.currentStageIndex ?? 0)
const stages = computed(() => props.stages || [])
const currentStageInfo = computed(() => stages.value[currentStageIndex.value] || null)
const isDualTimerStage = computed(() => currentStageInfo.value?.type === 'dual-timer')
const isSpecialStage = computed(() => currentStageInfo.value?.type === 'special')

// ═══════════ 环节完整标题（辩方辩位 · 环节名称）═══════════
// 与卡片头 stage-header-title 保持一致的显示格式
const currentStageFullTitle = computed(() => {
  const info = currentStageInfo.value
  if (!info) return '彩排 · 试音'
  const name = info.name || '未命名'
  const type = info.type
  // 去除辩方辩位中的分隔符，用 " · " 重新拼接
  const stripSep = (s: string) => (s || '').replace(/[·\/\s\-]/g, '')
  if (type === 'single_speech' || type === 'speech' || type === 'summary') {
    return `${stripSep(info.speaker || '正方·一辩')} · ${name}`
  }
  if (type === 'single_question') {
    return `${stripSep(info.questioner || '反方·二辩')} · ${name} · ${stripSep(info.responder || '正方·一辩')}`
  }
  if (type === 'dual-timer' || type === 'bilateral_debate' || type === 'free_debate') {
    return `${stripSep(info.firstSpeaker || '正方·一辩')} · ${name}`
  }
  return name
})

// ═══════════ 计时器状态（预览用，不实际倒计时） ═══════════
// 使用环节的初始时长作为预览的时间显示
const timeRemaining = computed(() => {
  const info = currentStageInfo.value
  if (!info || info.type === 'dual-timer' || info.type === 'special') return 0
  return info.duration || 0
})

const dualTimer = computed(() => {
  const info = currentStageInfo.value
  if (!info || info.type !== 'dual-timer') {
    return { positiveTime: 0, negativeTime: 0, activeTimer: 'positive' as const, isRunning: false, isPaused: false }
  }
  return {
    positiveTime: info.positiveDuration ?? info.duration ?? 0,
    negativeTime: info.negativeDuration ?? info.duration ?? 0,
    activeTimer: 'positive' as const,
    isRunning: false,
    isPaused: false
  }
})

const isTimeWarning = ref(false)
const isTimeCritical = ref(false)

// ═══════════ 格式化函数 ═══════════
// 将秒数格式化为 mm:ss 字符串（不足两位补零）
function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ponytail: 双计时器直接复用 formatTime，无需额外包装函数

// 单计时器展示文本：补齐为 5 位（00:00）
const displayTime = computed(() => formatTime(timeRemaining.value).padStart(5, '0'))

// ═══════════ 1920x1080 基准画布 + 动态缩放计算 ═══════════
// 核心思路：scale-wrapper 固定为 1920x1080px（模拟真实屏幕基准）
// 内部所有尺寸都用 px（基于 1920/1080 基准）
// 用 transform: scale() 把 1920x1080 的画布等比例缩放到预览容器中
// 这样预览效果与正式 1920x1080 计时器页面 100% 一致，不会有溢出或比例问题

const containerRef = ref<HTMLElement | null>(null) // 容器 DOM 引用
const previewScale = ref(1) // 动态计算的缩放比例（填满容器所需的 scale）

function updatePreviewScale() {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  // 容器是 16:9 的，宽高任取其一计算即可，这里取宽度计算更稳妥
  const scale = rect.width / 1280
  previewScale.value = scale > 0 ? scale : 1
}

// 窗口尺寸变化时重新计算
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  // 下一帧再计算（确保 DOM 已渲染完成）
  requestAnimationFrame(() => {
    updatePreviewScale()
  })
  // 使用 ResizeObserver 监听容器尺寸变化（比 window resize 更精准）
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

// scale-wrapper 样式：固定 1920x1080px 基准画布 + transform scale 等比例缩放
// 再乘以 props.scale（用户传入的额外缩放因子，默认 1）
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

// ═══════════ 容器样式（背景） ═══════════
const containerStyle = computed(() => {
  let background = ''

  // 优先级：skinConfig > uiConfig.backgroundType
  if (props.skinConfig) {
    const skin = props.skinConfig
    if (skin.backgroundType === 'gradient' && skin.gradientStart && skin.gradientEnd) {
      background = `radial-gradient(ellipse at center bottom, ${skin.gradientStart} 0%, ${skin.gradientEnd} 100%)`
    } else if (skin.backgroundType === 'solid' && skin.solidColor) {
      background = skin.solidColor
    } else if (skin.backgroundType === 'image' && skin.imageUrl) {
      background = `url(${skin.imageUrl}) center/cover no-repeat`
    }
  }

  // 如果 skinConfig 没有配置，回退到 uiConfig 的背景配置
  if (!background) {
    const ui = uiConfig.value
    if (ui.backgroundType === 'image' && ui.imageFileName) {
      background = `url(${ui.imageFileName}) center/cover no-repeat`
    } else if (ui.backgroundType === 'custom' && ui.backgroundGradient) {
      background = ui.backgroundGradient
    } else if (ui.backgroundType === 'gradient' && ui.gradientStart && ui.gradientEnd) {
      background = `radial-gradient(ellipse at center bottom, ${ui.gradientStart} 0%, ${ui.gradientEnd} 100%)`
    } else if (ui.backgroundType === 'solid' && ui.solidColor) {
      background = ui.solidColor
    }
  }

  const style: Record<string, string> = {}
  if (background) style.background = background
  return style
})
</script>

<style scoped>
/* ═══════════ 字体定义（全局main.css已定义，此处仅作引用）═══════════ */
/* ponytail: 删除重复的@font-face定义，使用全局定义 */

/* 字体设置：仅作用于缩放容器内部的元素，避免影响配置页面 */
.scale-wrapper *:not(.digital-char) {
  font-family: 'SourceHanSerifCN-Heavy', 'SimSun', '宋体', serif !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}

/* ═══════════ 预览容器（16:9 比例） ═══════════ */
/* timer-preview-container 占满父容器（16:9 比例），负责背景色 */
/* position: relative 用于定位内部的 scale-wrapper */
.timer-preview-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center bottom, rgb(57, 76, 86) 0%, rgb(14, 17, 17) 100%);
  overflow: hidden;
}

/* ═══════════ 缩放包装：固定 1920x1080px 基准画布 ═══════════ */
/* scale-wrapper 固定为 1920x1080px（模拟真实屏幕的基准画布）
   transform scale 等比例缩放到预览容器大小（通过 :style 动态计算）
   内部所有尺寸都基于 1920/1080 基准用 px 定义，确保与正式计时器页面 100% 一致 */
.scale-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  /* 宽高和 transform 由 scaleWrapperStyle computed 动态计算 */
  display: flex;
  flex-direction: column;
}

/* ═══════════ 横幅（顶部红蓝条） ═══════════ */
/* 尺寸基于 1920x1080 基准，画布固定 1280x720，内容等比例缩放 */
.debate-header {
  padding-top: 43.2px;
  flex-shrink: 0;
}
.debate-side-positive {
  background-color: rgb(169, 35, 35);
  padding: 6.48px 15.36px;
}
.debate-side-negative {
  background-color: rgb(3, 105, 161);
  padding: 6.48px 15.36px;
}
.debate-label-white {
  border: 1px solid white;
  border-radius: 2px;
  padding: 0;
  font-size: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.3em;
  line-height: 1.3;
}
.debate-label-white span {
  padding: 0.54px 1.92px;
  line-height: 1;
}
.debate-topic-text {
  font-size: 21px;
  line-height: 1.3;
  max-width: 672px;
  word-wrap: break-word;
}
.debate-topic-right {
  text-align: right;
}
.debate-side-positive .debate-label-white {
  margin-left: 9.6px;
  margin-right: 28.8px;
}
.debate-side-negative .debate-label-white {
  margin-right: 9.6px;
  margin-left: 28.8px;
}

/* ═══════════ 队徽样式 ═══════════ */
.team-logo-wrapper {
  width: 57.6px;
  height: 57.6px;
  border-radius: 50%;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.team-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ═══════════ 主内容区 ═══════════ */
/* 使用从顶部固定偏移的布局，确保单/双计时器模式下 h1 和计时器位置一致 */
/* 基准换算：1vw = 12.8px (1280px宽度基准)，1vh = 10.8px (1080px高度基准) */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 86.4px;  /* 对应 8vh 从顶部偏移（8 * 10.8 = 86.4px） */
  padding-bottom: 270px;  /* 对应 25vh（25 * 10.8 = 270px） */
}
.contest-title {
  margin-bottom: 35px;  /* 预览专用：缩短 h1 到计时器 div 的间距（原 54px） */
}
.contest-title-text {
  font-size: 72px;  /* 放大一倍：从 36px 增大到 72px */
}
.contest-title-color {
  color: rgb(3, 105, 161);
}

/* ═══════════ 计时器区域 ═══════════ */
/* 固定最小高度容器，确保单/双计时器模式下环节标题位置一致 */
.stage-timer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 21.6px;  /* 对应 2vh（2 * 10.8 = 21.6px） */
  min-height: 432px;  /* 对应 40vh 最小高度（40 * 10.8 = 432px） */
}
.stage-title-text {
  font-size: 56px;
}
.special-stage-text {
  font-size: 170px;
  line-height: 1.2;
}

/* ═══════════ 双计时器 ═══════════ */
.dual-timer-display {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 153.6px;
}
.timer-side {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.timer-label {
  font-size: 24px;
  font-weight: bold;
  margin-top: 21.6px;
}
.positive-label {
  color: rgb(179, 37, 37);
}
.negative-label {
  color: rgb(3, 105, 161);
}

/* ═══════════ 单计时器显示容器 ═══════════ */
/* 给单计时器区域设置最小高度，使单/双计时器模式下计时器上方位置对齐 */
.timer-display-section {
  min-height: 176px;  /* 对应 13.75vw 数字高度（1280px基准） */
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

/* ═══════════ 数码时钟 ═══════════ */
.digital-display {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.1em;
}
.digital-display .digital-char {
  font-family: 'Digiface', monospace !important;
  font-size: 176px;
  font-weight: normal;
  line-height: 1;
}

</style>
