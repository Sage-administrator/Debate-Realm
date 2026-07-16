<!--
  TimerPreviewCard.vue - 统一的预览卡片组件
  功能：
  - 封装左侧预览卡片的完整结构（标题、16:9 预览区、底部三按钮）
  - 内部调用 TimerPreview 组件（内容渲染由 TimerPreview 负责）
  - 使用 v-model:stageIndex 双向绑定环节索引切换
  - 好处：5 个配置页面共用同一套预览卡片逻辑，修改样式/结构只需改一处
-->
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import TimerPreview from '~/components/TimerPreview.vue'

// 配置对象类型定义（与 5 个配置页面的 fullConfig 结构一致）
// 单个环节信息
interface StageInfo {
  id: number | string       // 环节唯一标识
  name: string              // 环节名称
  duration: number          // 环节时长（秒）
  type: 'speech' | 'question' | 'summary' | 'special' | 'dual-timer'
        | 'single_speech' | 'single_question' | 'bilateral_debate' | 'free_debate'
        | 'no_timer' | 'single_timer' | 'double_timer' | 'ppt_replace' | string
  [key: string]: any
}
// UI 配置（横幅/标题/背景等显示项）
interface UIConfig {
  bannerVisible?: boolean           // 是否显示横幅
  eventNameVisible?: boolean        // 是否显示赛事标题
  bannerPos?: number                // 横幅垂直位置偏移
  positiveLabel?: string            // 正方标签
  negativeLabel?: string            // 反方标签
  backgroundType?: 'default' | 'image' | 'custom' | 'gradient' | 'solid'
  solidColor?: string               // 纯色背景色
  gradientStart?: string            // 渐变起始色
  gradientEnd?: string              // 渐变结束色
  imageFileName?: string            // 背景图地址
  [key: string]: any
}
// 皮肤/背景配置
interface SkinConfig {
  backgroundType?: 'default' | 'gradient' | 'image' | 'solid'
  solidColor?: string
  gradientStart?: string
  gradientEnd?: string
  imageUrl?: string                 // 背景图 URL
  [key: string]: any
}
// 提示音配置
interface AudioConfig { [key: string]: any }
// 队徽配置
interface TeamLogoConfig {
  positiveLogoUrl?: string          // 正方队徽 URL
  negativeLogoUrl?: string          // 反方队徽 URL
  showTeamLogo?: boolean            // 是否显示队徽
  [key: string]: any
}
// 完整计时器配置（聚合以上所有子配置）
interface FullConfig {
  title: string                     // 赛事标题
  positiveTopic: string             // 正方辩题
  negativeTopic: string             // 反方辩题
  teamPositiveName: string          // 正方队名
  teamNegativeName: string          // 反方队名
  stages: StageInfo[]               // 环节列表
  uiConfig: UIConfig
  skinConfig?: SkinConfig
  audioConfig?: AudioConfig
  teamLogoConfig?: TeamLogoConfig
  [key: string]: any
}

// Props
const props = defineProps<{
  // 完整计时器配置对象
  fullConfig: FullConfig
  // 赛事ID（用于"进入计时"链接）
  tournamentId: string
  // 当前预览环节索引（v-model:stageIndex 双向绑定）
  stageIndex?: number
  // 赛事类型：tournament（团队赛事）或 standalone（独立赛事）
  type?: 'tournament' | 'standalone'
}>()

// Emits
const emit = defineEmits<{
  'update:stageIndex': [value: number]
}>()

// 进入计时页面的链接路径
const timerPageUrl = computed(() => {
  if (props.type === 'standalone') {
    return `/standalone/${props.tournamentId}/timer`
  }
  return `/tournaments/${props.tournamentId}/timer`
})

// 环节索引
const currentIndex = computed({
  get: () => props.stageIndex ?? 0,
  set: (val: number) => emit('update:stageIndex', val),
})

// 环节列表长度（用于按钮 disabled 判断）
const stagesLength = computed(() => props.fullConfig.stages?.length ?? 0)

// ═══════════ 底部按钮栏响应式：窄时只显示图标 ═══════════
const bottomBarRef = ref<HTMLElement | null>(null)
const isNarrow = ref(false) // 是否为窄模式（只显示图标）
// 窄模式阈值：小于此宽度时隐藏按钮文字，只显示图标
const NARROW_THRESHOLD = 260

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (bottomBarRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        isNarrow.value = width < NARROW_THRESHOLD
      }
    })
    resizeObserver.observe(bottomBarRef.value)
    // 确保首次渲染后也能正确计算（DOM 布局完成后）
    requestAnimationFrame(() => {
      if (bottomBarRef.value) {
        const width = bottomBarRef.value.getBoundingClientRect().width
        isNarrow.value = width < NARROW_THRESHOLD
      }
    })
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<template>
  <!-- ═══ 左侧：实时预览卡片 ═══ -->
  <div class="bg-white/8 rounded-lg overflow-hidden border border-[var(--color-border)]">

    <!-- 16:9 黑色预览区域 -->
    <div class="bg-black" style="aspect-ratio: 16/9;">
      <TimerPreview
        :contest-title="fullConfig.title"
        :positive-topic="fullConfig.positiveTopic"
        :negative-topic="fullConfig.negativeTopic"
        :team-positive-name="fullConfig.teamPositiveName"
        :team-negative-name="fullConfig.teamNegativeName"
        :positive-label="fullConfig.uiConfig.positiveLabel"
        :negative-label="fullConfig.uiConfig.negativeLabel"
        :stages="fullConfig.stages"
        :current-stage-index="currentIndex"
        :ui-config="fullConfig.uiConfig"
        :skin-config="fullConfig.skinConfig"
        :audio-config="fullConfig.audioConfig"
        :team-logo-config="fullConfig.teamLogoConfig"
        :scale="1"
      />
    </div>

    <!-- 底部：三按钮控制栏（上一环节 / 跳转计时 / 下一环节） -->
    <div
      ref="bottomBarRef"
      class="px-3 py-2.5 border-t border-[var(--color-border)] flex items-center justify-between gap-2"
    >
      <button
        class="text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)] transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed justify-center"
        :class="isNarrow ? 'w-9 h-9 px-0 py-0' : 'px-2.5 py-1.5 text-xs'"
        :disabled="currentIndex <= 0"
        @click="currentIndex--"
      >
        <UIcon name="i-lucide-arrow-left" class="w-3.5 h-3.5 shrink-0" />
        <span v-if="!isNarrow">上一环节</span>
      </button>

      <button
        class="bg-blue-500 border border-blue-500 rounded hover:bg-blue-600 transition text-white flex items-center gap-1 justify-center"
        :class="isNarrow ? 'w-9 h-9 px-0 py-0' : 'px-2.5 py-1.5 text-xs'"
        @click="navigateTo(timerPageUrl)"
      >
        <UIcon name="i-lucide-play" class="w-3.5 h-3.5 shrink-0" />
        <span v-if="!isNarrow">进入计时</span>
      </button>

      <button
        class="text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)] transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed justify-center"
        :class="isNarrow ? 'w-9 h-9 px-0 py-0' : 'px-2.5 py-1.5 text-xs'"
        :disabled="stagesLength === 0 || currentIndex >= stagesLength - 1"
        @click="currentIndex++"
      >
        <span v-if="!isNarrow">下一环节</span>
        <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5 shrink-0" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 预览卡片不需要额外样式，所有布局由 Tailwind 工具类提供 */
</style>
