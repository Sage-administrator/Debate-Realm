<!--
  TimerDisplay.vue - 计时器视觉显示组件（预览与正式页共用）
  功能：
  - 唯一视觉来源：横幅、队伍名+队徽、赛事标题、环节名（含辩方辩位）、单/双计时器
  - 固定 1280x720 设计基准，所有尺寸用 px 定义；外层由调用方用 transform scale 等比缩放
  - 调用方：TimerPreview（预览卡片）、tournaments/standalone 的 timer.vue（正式计时）
  这样预览与正式效果 100% 一致，且后续不会再次漂移
-->
<template>
  <!-- 根容器：填满外层 1280x720 缩放画布；背景由 rootStyle 计算 -->
  <div class="timer-display-root text-white overflow-hidden" :style="rootStyleWithFont">

    <!-- 顶部辩题展示区（横幅）：抽成独立 TimerBanner 组件，供预览/正式页复用 -->
    <!-- bannerShouldShow=false 时不渲染；hideBanner=true 时渲染但 visibility:hidden 以保留画布内布局占位 -->
    <TimerBanner
      v-if="bannerShouldShow"
      :invisible="hideBanner"
      :ui-config="uiConfig"
      :positive-label="positiveLabel"
      :negative-label="negativeLabel"
      :positive-topic="positiveTopic"
      :negative-topic="negativeTopic"
    />

    <!-- 队伍名（横幅下方，空值不显示） + 队徽显示 -->
    <div class="flex w-full items-start justify-between px-4 mt-2">
      <div class="flex items-center gap-2" v-if="teamPositiveName || positiveLogoUrl">
        <!-- 正方队徽 -->
        <div v-if="positiveLogoUrl && showTeamLogo" class="team-logo-wrapper" :style="logoStyle">
          <!-- 队徽图片：懒加载 + 异步解码，避免阻塞主渲染线程 -->
          <img :src="positiveLogoUrl" class="team-logo-img" alt="正方队徽" loading="lazy" decoding="async" />
        </div>
        <div v-if="teamPositiveName" class="debate-topic-text" :style="{ color: uiConfig.teamNameColor || 'white', fontSize: uiConfig.teamNameFontSize ? `${uiConfig.teamNameFontSize}px` : '', fontFamily: uiConfig.teamNameFontFamily || uiConfig.fontFamily || '' }">
          {{ teamPositiveName }}
        </div>
      </div>
      <div class="flex items-center gap-2" v-if="teamNegativeName || negativeLogoUrl">
        <div v-if="teamNegativeName" class="debate-topic-text debate-topic-right" :style="{ color: uiConfig.teamNameColor || 'white', fontSize: uiConfig.teamNameFontSize ? `${uiConfig.teamNameFontSize}px` : '', textAlign: 'right', fontFamily: uiConfig.teamNameFontFamily || uiConfig.fontFamily || '' }">
          {{ teamNegativeName }}
        </div>
        <!-- 反方队徽 -->
        <div v-if="negativeLogoUrl && showTeamLogo" class="team-logo-wrapper" :style="logoStyle">
          <!-- 队徽图片：懒加载 + 异步解码，避免阻塞主渲染线程 -->
          <img :src="negativeLogoUrl" class="team-logo-img" alt="反方队徽" loading="lazy" decoding="async" />
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content" :style="{ paddingTop: typeof uiConfig.contentPaddingTop === 'number' ? `${uiConfig.contentPaddingTop}px` : '' }">
      <!-- 赛事名称（eventNameVisible/showTitle 任一为 true 即显示，默认显示）-->
      <div class="text-center contest-title" v-if="(uiConfig.eventNameVisible !== false && uiConfig.showTitle !== false)" :style="{ marginBottom: typeof uiConfig.titleMarginBottom === 'number' ? `${uiConfig.titleMarginBottom}px` : '' }">
        <h1
          class="font-bold contest-title-text contest-title-color"
          :style="{
            color: (uiConfig.titleColor || uiConfig.eventColor) || 'rgb(3, 105, 161)',
            fontSize: uiConfig.eventFontSize ? `${uiConfig.eventFontSize}px` : '',
            fontFamily: uiConfig.titleFontFamily || uiConfig.fontFamily || ''
          }"
        >
          {{ contestTitle }}
        </h1>
      </div>

      <!-- 计时器区域 -->
      <!-- v-memo: 只在环节信息/时间变化时才重渲染，避免每250ms整个区域重绘 -->
      <div class="stage-timer-container" :style="{ gap: typeof uiConfig.stageTimerGap === 'number' ? `${uiConfig.stageTimerGap}px` : '' }">
        <!-- 当前环节名称（v-memo：只在环节类型/标题/UI配置变化时重渲染） -->
        <div v-memo="[isSpecialStage, currentStageFullTitle, uiConfig.stageTitleColor, uiConfig.stageTitleFontSize, uiConfig.stageTitleFontFamily, uiConfig.fontFamily]" class="text-center stage-title">
          <h2 class="font-bold" :class="isSpecialStage ? 'special-stage-text' : 'stage-title-text'" :style="{ color: uiConfig.stageTitleColor || 'white', fontSize: isSpecialStage ? '' : (typeof uiConfig.stageTitleFontSize === 'number' ? `${uiConfig.stageTitleFontSize}px` : ''), fontFamily: uiConfig.stageTitleFontFamily || uiConfig.fontFamily || '' }">
            {{ currentStageFullTitle }}
          </h2>
        </div>

        <!-- PPT 图片展示（纯播报，不计时） -->
        <div v-if="isPptStage && pptImage" class="ppt-image-area">
          <!-- PPT 图片：异步解码，避免大图加载阻塞计时器渲染 -->
          <img :src="pptImage" class="ppt-image" alt="PPT展示" decoding="async" />
        </div>

        <!-- 双计时器显示（v-memo：只在时间/颜色/字号/字体变化时重渲染，约从4次/秒降到1次/秒） -->
        <div v-memo="[dualPositiveTime, dualNegativeTime, positiveLabel, negativeLabel, uiConfig.dualTimerColorPos, uiConfig.dualTimerColorNeg, uiConfig.bannerFontColorPos, uiConfig.bannerFontColorNeg, uiConfig.timerFontSize, uiConfig.timerFontFamily]" v-else-if="isDualTimerStage" class="dual-timer-container">
          <div class="dual-timer-display">
            <div class="timer-side positive-side">
              <div
                class="digital-display digital-text"
                :style="{ color: uiConfig.dualTimerColorPos || uiConfig.bannerFontColorPos || 'rgb(169, 35, 35)', fontSize: uiConfig.timerFontSize ? `${uiConfig.timerFontSize}px` : '', fontFamily: uiConfig.timerFontFamily || 'Digiface, monospace' }"
              >{{ dualPositiveTime }}</div>
              <div class="timer-label positive-label" :style="{ fontFamily: uiConfig.timerFontFamily || '' }">{{ positiveLabel }}</div>
            </div>
            <div class="timer-side negative-side">
              <div
                class="digital-display digital-text"
                :style="{ color: uiConfig.dualTimerColorNeg || uiConfig.bannerFontColorNeg || 'rgb(3, 105, 161)', fontSize: uiConfig.timerFontSize ? `${uiConfig.timerFontSize}px` : '', fontFamily: uiConfig.timerFontFamily || 'Digiface, monospace' }"
              >{{ dualNegativeTime }}</div>
              <div class="timer-label negative-label" :style="{ fontFamily: uiConfig.timerFontFamily || '' }">{{ negativeLabel }}</div>
            </div>
          </div>
        </div>

        <!-- 单计时器显示（v-memo：只在时间/警告状态/颜色/字号/字体变化时重渲染） -->
        <div v-memo="[displayTime, isTimeWarning, isTimeCritical, uiConfig.timerColor, uiConfig.timerFontSize, uiConfig.timerFontFamily]" v-else-if="!isSpecialStage && !isPptStage" class="text-center timer-display-section">
          <div
            class="digital-display digital-text"
            :class="{
              'text-orange-400': isTimeWarning,
              'text-red-400': isTimeCritical,
            }"
            :style="{ color: (!isTimeWarning && !isTimeCritical) ? (uiConfig.timerColor || 'white') : '', fontSize: uiConfig.timerFontSize ? `${uiConfig.timerFontSize}px` : '', fontFamily: uiConfig.timerFontFamily || 'Digiface, monospace' }"
          >{{ displayTime }}</div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TimerBanner from './TimerBanner.vue'

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

  // 横幅：为 true 时画布内横幅改为 visibility:hidden 占位（横幅已被计时页全屏覆盖层接管）
  hideBanner?: boolean

  // 当前环节信息（用于计算含辩方辩位的完整标题）
  currentStageInfo?: {
    id?: number | string
    name?: string
    type?: string
    speaker?: string
    questioner?: string
    responder?: string
    firstSpeaker?: string
    [key: string]: any
  } | null

  // UI 配置
  uiConfig?: Record<string, any>
  // 皮肤/背景配置
  skinConfig?: Record<string, any>
  // 队徽配置
  teamLogoConfig?: {
    positiveLogoUrl?: string
    negativeLogoUrl?: string
    showTeamLogo?: boolean
    logoSize?: number          // 队徽大小（px），默认 57.6
    logoOffsetX?: number       // 水平位置（px），正=右 负=左
    logoOffsetY?: number       // 垂直位置（px），正=下 负=上
    [key: string]: any
  }

  // 计时器状态
  isDualTimerStage?: boolean
  isSpecialStage?: boolean
  displayTime?: string                 // 单计时器文本（已格式化，如 "03:00"）
  isTimeWarning?: boolean
  isTimeCritical?: boolean
  dualPositiveTime?: string           // 双计时器正方文本
  dualNegativeTime?: string           // 双计时器反方文本
}>()

// ═══════════ 默认值 ═══════════
const positiveLabel = computed(() => props.positiveLabel || props.uiConfig?.positiveLabel || '正方')
const negativeLabel = computed(() => props.negativeLabel || props.uiConfig?.negativeLabel || '反方')
const uiConfig = computed(() => props.uiConfig || {})
const positiveLogoUrl = computed(() => props.teamLogoConfig?.positiveLogoUrl || '')
const negativeLogoUrl = computed(() => props.teamLogoConfig?.negativeLogoUrl || '')
const showTeamLogo = computed(() => props.teamLogoConfig?.showTeamLogo !== false)

// 队徽大小与位置（上下左右偏移）：大小控制圆形容器宽高，偏移以 translate 相对原位置微调
const DEFAULT_LOGO_SIZE = 57.6
const logoSize = computed<number>(() => {
  const s = props.teamLogoConfig?.logoSize
  return (typeof s === 'number' && !Number.isNaN(s) && s > 0) ? s : DEFAULT_LOGO_SIZE
})
const logoOffsetX = computed<number>(() => {
  const v = props.teamLogoConfig?.logoOffsetX
  return (typeof v === 'number' && !Number.isNaN(v)) ? v : 0
})
const logoOffsetY = computed<number>(() => {
  const v = props.teamLogoConfig?.logoOffsetY
  return (typeof v === 'number' && !Number.isNaN(v)) ? v : 0
})
const logoStyle = computed<Record<string, string>>(() => ({
  width: `${logoSize.value}px`,
  height: `${logoSize.value}px`,
  transform: `translate(${logoOffsetX.value}px, ${logoOffsetY.value}px)`,
}))

// 横幅是否应当显示（bannerVisible/showBanner 任一为 false 即不渲染）
const bannerShouldShow = computed(() => {
  const ui = props.uiConfig || {}
  return ui.bannerVisible !== false && ui.showBanner !== false
})

// ═══════════ 环节完整标题（辩方辩位 · 环节名称）═══════════
// 与预览卡片保持一致的显示格式
const currentStageFullTitle = computed(() => {
  const info = props.currentStageInfo
  if (!info) return '彩排 · 试音'
  const name = info.name || '未命名'
  const type = info.type
  const stripSep = (s: string) => (s || '').replace(/[·\/\s\-]/g, '')
  if (isSpeech(type)) {
    return `${stripSep(info.speaker || '正方·一辩')} · ${name}`
  }
  if (isQuestion(type)) {
    const rList = (info.responders && info.responders.length)
      ? info.responders.map((r: string) => stripSep(r))
      : [stripSep(info.responder || '正方·一辩')]
    return `${stripSep(info.questioner || '反方·二辩')} · ${name} · ${rList.join('、')}`
  }
  // 自由辩论 / 对辩：无需发言方在前，仅保留环节名称
  if (normalizeStageType(type) === 'free_debate') {
    return name
  }
  return name
})

// ═══════════ PPT/图片展示环节（纯播报不计时）═══════════
const isPptStage = computed(() => isPpt(props.currentStageInfo?.type))
// 上传到 /uploads/images/ 的相对路径；为空则不展示图片
const pptImage = computed(() => props.currentStageInfo?.pptImage || '')

// ═══════════ 动态背景样式（与预览/正式页一致的优先级） ═══════════
const rootStyle = computed<Record<string, string>>(() => {
  let background = ''
  const skin = props.skinConfig
  const ui = uiConfig.value

  if (skin) {
    if (skin.backgroundType === 'gradient' && skin.gradientStart && skin.gradientEnd) {
      background = `radial-gradient(ellipse at center bottom, ${skin.gradientStart} 0%, ${skin.gradientEnd} 100%)`
    } else if (skin.backgroundType === 'solid' && skin.solidColor) {
      background = skin.solidColor
    } else if (skin.backgroundType === 'image' && skin.imageUrl) {
      background = `url(${skin.imageUrl}) center/cover no-repeat`
    }
  }

  if (!background) {
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

  if (!background) {
    background = 'radial-gradient(ellipse at center bottom, rgb(57, 76, 86) 0%, rgb(14, 17, 17) 100%)'
  }

  return { background }
})

// 根容器样式：仅背景（各元素字体通过各自 :style 的 fontFamily 控制）
const rootStyleWithFont = computed(() => ({ ...rootStyle.value }))
</script>

<style scoped>
/* 字体：默认宋体；各元素字体通过各自 :style 的 fontFamily 控制（数码时钟除外，见 .digital-char） */
.timer-display-root *:not(.digital-char) {
  font-family: 'SourceHanSerifCN-Heavy', 'SimSun', '宋体', serif;
  user-select: none !important;
  -webkit-user-select: none !important;
}
.timer-display-root {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
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
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 56px;  /* 整体上移：原为 12vh(86.4px)，现约 7.8vh */
  padding-bottom: 270px;  /* 对应 37.5vh（37.5 * 7.2 = 270px） */
}
.contest-title {
  margin-bottom: 12px;  /* h1 到 h2 间距缩小，h2 上靠 */
}
.contest-title-text {
  font-size: 50px;
}
.contest-title-color {
  color: rgb(3, 105, 161);
}

/* ═══════════ 计时器区域 ═══════════ */
.stage-timer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;  /* h2 到计时器间距缩小 */
  min-height: 432px;  /* 对应 60vh（60 * 7.2 = 432px） */
}
.stage-title-text {
  font-size: 64px;
}
.special-stage-text {
  font-size: 170px;
  line-height: 1.2;
}

/* ═══════════ PPT 展示环节 ═══════════ */
.ppt-image-area {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
  margin-top: 12px;
  min-height: 200px;
  overflow: hidden;
  border-radius: 8px;
}
.ppt-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
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
  font-size: 28px;
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
}
/* 直接字符串渲染的计时器文本（性能优化：避免 v-for 逐个字符） */
.digital-text {
  font-family: 'Digiface', monospace;
  font-size: 200px;
  font-weight: normal;
  line-height: 1;
  /* 使用等宽字体配合 letter-spacing 控制字符间距，替代 v-for 的 gap */
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
}
/* 兼容旧版逐个字符样式（保留以避免引用破坏） */
.digital-display .digital-char {
  font-family: 'Digiface', monospace;
  font-size: 200px;
  font-weight: normal;
  line-height: 1;
}
</style>
