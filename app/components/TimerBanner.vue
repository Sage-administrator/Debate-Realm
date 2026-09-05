<!--
  TimerBanner.vue - 顶部红蓝横幅（辩题展示区），从 TimerDisplay 抽出为独立组件
  用途：
  1. 被 TimerDisplay 内部复用（预览卡片 / 计时页缩放画布内）
  2. 被计时页以「全屏宽覆盖层」方式复用：外层用 100% 宽 + transform:scale 把 1280 设计宽
     拉伸到屏幕宽，使红蓝条左右贴屏幕边缘，同时内部字号/间距随画布等比缩放
  尺寸基于 1280x720 设计基准（px），由调用方决定缩放方式
-->
<template>
  <div v-if="shouldShow" class="debate-header" :style="headerStyle">
    <div
      class="flex w-full banner-row"
      :style="{ marginTop: `${(uiConfig.bannerPos ?? 0) * 7.2}px` }"
    >
      <!-- 正方横幅（红色） -->
      <div class="flex-1 debate-side-positive flex items-center" :style="sideStylePos">
        <div class="debate-label-white" :style="{ fontSize: `${labelFontSize}px` }">
          <span
            class="font-bold"
            :style="{ color: bannerFontColorPos, fontFamily: bannerFontFamily }"
          >
            {{ positiveLabel }}
          </span>
        </div>
        <div
          ref="positiveTopicRef"
          class="font-bold debate-topic-text"
          :style="{
            color: bannerFontColorPos,
            fontSize: `${bannerFontSize}px`,
            fontFamily: bannerFontFamily,
          }"
        >
          {{ positiveTopic || '' }}
        </div>
      </div>
      <!-- 反方横幅（蓝色） -->
      <div class="flex-1 debate-side-negative flex items-center justify-end" :style="sideStyleNeg">
        <div
          ref="negativeTopicRef"
          class="font-bold text-right debate-topic-text debate-topic-right"
          :style="{
            color: bannerFontColorNeg,
            fontSize: `${bannerFontSize}px`,
            fontFamily: bannerFontFamily,
          }"
        >
          {{ negativeTopic || '' }}
        </div>
        <div class="debate-label-white" :style="{ fontSize: `${labelFontSize}px` }">
          <span
            class="font-bold"
            :style="{ color: bannerFontColorNeg, fontFamily: bannerFontFamily }"
          >
            {{ negativeLabel }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'

const props = defineProps<{
  // UI 配置（颜色、标签、显隐、bannerPos 等）
  uiConfig?: Record<string, any>
  positiveLabel?: string
  negativeLabel?: string
  positiveTopic?: string
  negativeTopic?: string
  // 为 true 时渲染但 visibility:hidden，用于占位（计时页把横幅移到全屏覆盖层时保留画布内布局）
  invisible?: boolean
}>()

const uiConfig = computed(() => props.uiConfig || {})
const positiveLabel = computed(() => props.positiveLabel || props.uiConfig?.positiveLabel || '正方')
const negativeLabel = computed(() => props.negativeLabel || props.uiConfig?.negativeLabel || '反方')

// ═══════════ 可配置视觉项（字体 / 颜色 / 厚度 / 字号） ═══════════
// 横幅字体：优先 bannerFontFamily，其次全局 fontFamily，空 = 默认宋体
const bannerFontFamily = computed(
  () => props.uiConfig?.bannerFontFamily || props.uiConfig?.fontFamily || '',
)
// 横幅厚度（红蓝条垂直内边距，即"宽窄"），默认 5px 与历史外观一致
const bannerHeight = computed(() => {
  const v = props.uiConfig?.bannerHeight
  return typeof v === 'number' && !Number.isNaN(v) ? v : 5
})
// 辩题文字字号
const bannerFontSize = computed(() => {
  const v = props.uiConfig?.bannerFontSize
  return typeof v === 'number' && !Number.isNaN(v) ? v : 21
})
// 正方/反方标签框字号
const labelFontSize = computed(() => {
  const v = props.uiConfig?.labelFontSize
  return typeof v === 'number' && !Number.isNaN(v) ? v : 38
})
const bannerColorPos = computed(() => props.uiConfig?.bannerColorPos || 'rgb(169, 35, 35)')
const bannerColorNeg = computed(() => props.uiConfig?.bannerColorNeg || 'rgb(3, 105, 161)')
// 横幅文字颜色：同时作用于标签与辩题文字，保证整条横幅文字统一
const bannerFontColorPos = computed(() => props.uiConfig?.bannerFontColorPos || 'white')
const bannerFontColorNeg = computed(() => props.uiConfig?.bannerFontColorNeg || 'white')

// 横幅两侧色块样式（颜色 + 厚度）
const sideStylePos = computed(() => ({
  backgroundColor: bannerColorPos.value,
  paddingTop: `${bannerHeight.value}px`,
  paddingBottom: `${bannerHeight.value}px`,
  paddingLeft: '15.36px',
  paddingRight: '15.36px',
}))
const sideStyleNeg = computed(() => ({
  backgroundColor: bannerColorNeg.value,
  paddingTop: `${bannerHeight.value}px`,
  paddingBottom: `${bannerHeight.value}px`,
  paddingLeft: '15.36px',
  paddingRight: '15.36px',
}))

const shouldShow = computed(() => {
  const ui = props.uiConfig || {}
  return ui.bannerVisible !== false && ui.showBanner !== false
})

// 占位模式：渲染但不可见，保留画布内布局高度
const headerStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {}
  if (props.invisible) style.visibility = 'hidden'
  return style
})

// ═══════════ 辩题文字溢出检测：过长则换行并缩小字体 ═══════════
const positiveTopicRef = ref<HTMLElement | null>(null)
const negativeTopicRef = ref<HTMLElement | null>(null)
function checkTopicOverflow() {
  const check = (el: HTMLElement | null) => {
    if (!el || !el.textContent) return
    el.classList.remove('topic-overflow')
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add('topic-overflow')
  }
  check(positiveTopicRef.value)
  check(negativeTopicRef.value)
}
watch(
  () => [props.positiveTopic, props.negativeTopic],
  () => nextTick(checkTopicOverflow),
)
onMounted(() => nextTick(checkTopicOverflow))
</script>

<style scoped>
/* 字体：默认宋体；各元素字体通过各自 :style 的 fontFamily 控制（bannerFontFamily / fontFamily 回退） */
.debate-header * {
  font-family: 'SourceHanSerifCN-Heavy', 'SimSun', '宋体', serif;
  user-select: none !important;
  -webkit-user-select: none !important;
}
.debate-header {
  padding-top: 30px; /* 顶部间距：不贴顶，比原 6vh(43.2px) 略小，整体上移 */
  flex-shrink: 0;
  width: 100%;
}
/* 横幅行：强制占满父级宽度，左右贴边（抵消任何潜在的收缩/边距） */
.banner-row {
  width: 100%;
  margin-left: 0;
  margin-right: 0;
}
.debate-side-positive {
  background-color: rgb(169, 35, 35);
  padding: 5px 15.36px;
  margin: 0;
}
.debate-side-negative {
  background-color: rgb(3, 105, 161);
  padding: 5px 15.36px;
  margin: 0;
}
.debate-label-white {
  border: 1px solid white;
  border-radius: 4px;
  padding: 0;
  font-size: 38px;
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
  margin-left: 0;
  margin-right: 28.8px;
}
.debate-side-negative .debate-label-white {
  margin-right: 0;
  margin-left: 28.8px;
}
</style>
