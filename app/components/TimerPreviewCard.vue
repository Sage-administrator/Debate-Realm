<!--
  TimerPreviewCard.vue - 统一的预览卡片组件
  功能：
  - 封装左侧预览卡片的完整结构（标题、16:9 预览区、底部三按钮）
  - 内部调用 TimerPreview 组件（内容渲染由 TimerPreview 负责）
  - 使用 v-model:stageIndex 双向绑定环节索引切换
  - 好处：5 个配置页面共用同一套预览卡片逻辑，修改样式/结构只需改一处
-->
<script setup lang="ts">
import { computed } from 'vue'
import TimerPreview from '~/components/TimerPreview.vue'

// 配置对象类型定义（与 5 个配置页面的 fullConfig 结构一致）
interface StageInfo {
  id: number | string
  name: string
  duration: number
  type: 'speech' | 'question' | 'summary' | 'special' | 'dual-timer'
        | 'single_speech' | 'single_question' | 'bilateral_debate' | 'free_debate'
        | 'no_timer' | 'single_timer' | 'double_timer' | 'ppt_replace' | string
  [key: string]: any
}
interface UIConfig {
  bannerVisible?: boolean
  eventNameVisible?: boolean
  bannerPos?: number
  positiveLabel?: string
  negativeLabel?: string
  backgroundType?: 'default' | 'image' | 'custom' | 'gradient' | 'solid'
  solidColor?: string
  gradientStart?: string
  gradientEnd?: string
  imageFileName?: string
  [key: string]: any
}
interface SkinConfig {
  backgroundType?: 'default' | 'gradient' | 'image' | 'solid'
  solidColor?: string
  gradientStart?: string
  gradientEnd?: string
  imageUrl?: string
  [key: string]: any
}
interface AudioConfig { [key: string]: any }
interface TeamLogoConfig {
  positiveLogoUrl?: string
  negativeLogoUrl?: string
  showTeamLogo?: boolean
  [key: string]: any
}
interface FullConfig {
  title: string
  positiveTopic: string
  negativeTopic: string
  teamPositiveName: string
  teamNegativeName: string
  stages: StageInfo[]
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
}>()

// Emits
const emit = defineEmits<{
  'update:stageIndex': [value: number]
}>()

// 环节索引
const currentIndex = computed({
  get: () => props.stageIndex ?? 0,
  set: (val: number) => emit('update:stageIndex', val),
})

// 环节列表长度（用于按钮 disabled 判断）
const stagesLength = computed(() => props.fullConfig.stages?.length ?? 0)
</script>

<template>
  <!-- ═══ 左侧：实时预览卡片 ═══ -->
  <div class="bg-white rounded-lg shadow-sm overflow-hidden">

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
    <div class="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
      <button
        class="px-4 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="currentIndex <= 0"
        @click="currentIndex--"
      >
        <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
        上一环节
      </button>

      <NuxtLink
        :to="`/tournaments/${tournamentId}/timer`"
        target="_blank"
        class="px-4 py-1.5 text-sm text-white bg-blue-500 border border-blue-500 rounded hover:bg-blue-600 transition flex items-center gap-1.5"
      >
        <UIcon name="i-lucide-play" class="w-4 h-4" />
        进入计时
      </NuxtLink>

      <button
        class="px-4 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="stagesLength === 0 || currentIndex >= stagesLength - 1"
        @click="currentIndex++"
      >
        下一环节
        <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 预览卡片不需要额外样式，所有布局由 Tailwind 工具类提供 */
</style>
