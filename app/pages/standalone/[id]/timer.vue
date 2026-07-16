<!--
  计时器全屏演示页面 - 复刻自 reference/往期项目代码/debate-timer/pages/index.vue
  视觉设计：径向渐变背景、红蓝横幅、Digiface 数码字体、控制面板悬停可见
  适配：使用项目 debateStore 管理计时状态，移除 QQ Bot/WS 相关功能
  不包含"快捷时间"div
-->
<template>
  <div class="h-screen text-white overflow-hidden responsive-container scale-wrapper" :style="[{ '--ui-scale': uiScale }, backgroundStyle]">

    <!-- 顶部辩题展示区（横幅）- 显示横幅/辩题时显示完整横幅 -->
    <div class="debate-header" v-if="(uiConfig.bannerVisible !== false && uiConfig.showBanner !== false)">
      <div class="flex w-full" :style="{ marginTop: `${uiConfig.bannerPos ?? 0}vh` }">
        <!-- 正方横幅（红色） -->
        <div class="flex-1 debate-side-positive flex items-center" :style="{ backgroundColor: uiConfig.bannerColorPos || 'rgb(169, 35, 35)' }">
          <div class="debate-label-white">
            <span class="font-bold" :style="{ color: uiConfig.bannerFontColorPos || 'white' }">{{ positiveLabel }}</span>
          </div>
          <div ref="positiveTopicRef" class="text-white font-bold debate-topic-text">{{ positiveTopic || '' }}</div>
        </div>
        <!-- 反方横幅（蓝色） -->
        <div class="flex-1 debate-side-negative flex items-center justify-end" :style="{ backgroundColor: uiConfig.bannerColorNeg || 'rgb(3, 105, 161)' }">
          <div ref="negativeTopicRef" class="text-white font-bold text-right debate-topic-text debate-topic-right">{{ negativeTopic || '' }}</div>
          <div class="debate-label-white">
            <span class="font-bold" :style="{ color: uiConfig.bannerFontColorNeg || 'white' }">{{ negativeLabel }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 不显示横幅/辩题时，仍显示正方/反方标签 -->
    <div v-else class="flex w-full justify-between px-8 mt-2">
      <div class="debate-label-white">
        <span class="font-bold" :style="{ color: uiConfig.bannerFontColorPos || 'white' }">{{ positiveLabel }}</span>
      </div>
      <div class="debate-label-white">
        <span class="font-bold" :style="{ color: uiConfig.bannerFontColorNeg || 'white' }">{{ negativeLabel }}</span>
      </div>
    </div>

    <!-- 队伍名（横幅下方，空值不显示） -->
    <div class="flex w-full items-start justify-between px-4 mt-2">
      <div v-if="teamPositiveName" class="debate-topic-text" :style="{ color: uiConfig.teamNameColor || 'white' }">{{ teamPositiveName }}</div>
      <div v-if="teamNegativeName" class="debate-topic-text debate-topic-right" :style="{ color: uiConfig.teamNameColor || 'white', textAlign: 'right' }">{{ teamNegativeName }}</div>
    </div>

    <!-- 进入前设置面板（独立赛事模式下不显示，数据在创建赛事时已收集） -->


    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 赛事名称 -->
      <div class="text-center contest-title" v-if="(uiConfig.eventNameVisible !== false && uiConfig.showTitle !== false)">
        <h1 class="font-bold contest-title-text contest-title-color" :style="{ color: (uiConfig.titleColor || uiConfig.eventColor) || 'rgb(3, 105, 161)', fontSize: uiConfig.eventFontSize ? `${(uiConfig.eventFontSize / 16).toFixed(4)}rem` : '' }">{{ contestTitle }}</h1>
      </div>

      <!-- 计时器区域 -->
      <div class="stage-timer-container">
        <!-- 当前环节名称 -->
        <div class="text-center stage-title">
          <h2 class="font-bold text-white" :class="isSpecialStage ? 'special-stage-text' : 'stage-title-text'">
            {{ currentStageInfo?.name || '彩排·试音' }}
          </h2>
        </div>

        <!-- 双计时器显示 -->
        <div v-if="isDualTimerStage" class="dual-timer-container">
          <div class="dual-timer-display">
            <div class="timer-side positive-side">
              <div class="digital-display">
                <span v-for="(char, index) in formatDualTime(dualTimer.positiveTime)" :key="`pos-${index}`" class="digital-char" :style="{ color: uiConfig.bannerFontColorPos || 'rgb(169, 35, 35)' }">{{ char }}</span>
              </div>
              <div class="timer-label positive-label">{{ positiveLabel }}</div>
            </div>
            <div class="timer-side negative-side">
              <div class="digital-display">
                <span v-for="(char, index) in formatDualTime(dualTimer.negativeTime)" :key="`neg-${index}`" class="digital-char" :style="{ color: uiConfig.bannerFontColorNeg || 'rgb(3, 105, 161)' }">{{ char }}</span>
              </div>
              <div class="timer-label negative-label">{{ negativeLabel }}</div>
            </div>
          </div>
        </div>

        <!-- 单计时器显示 -->
        <div v-else-if="!isSpecialStage" class="text-center timer-display-section">
          <div class="digital-display">
            <span v-for="(char, index) in displayTime" :key="index" class="digital-char" :class="{'text-orange-400': isTimeWarning, 'text-red-400': isTimeCritical, 'text-white': !isTimeWarning && !isTimeCritical}">{{ char }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 控制面板（左下角，默认透明，悬停显示） -->
    <div class="fixed bottom-4 left-4 control-panel">
      <!-- 双计时器控制 -->
      <div v-if="isDualTimerStage" class="flex items-center space-x-1 mb-1">
        <span class="text-white text-xs font-bold w-16">计时控制:</span>
        <button v-if="!dualTimer.isRunning" class="control-btn" @click="startTimer" :disabled="currentStage === 0">{{ dualTimer.isPaused ? '继续计时(空格)' : '启动计时(空格)' }}</button>
        <button v-if="dualTimer.isRunning" class="control-btn" @click="switchActiveTimer">{{ dualTimer.activeTimer === 'positive' ? '切换反方(空格)' : '切换正方(空格)' }}</button>
        <button class="control-btn" @click="pauseTimer" :disabled="!dualTimer.isRunning">中断(P)</button>
      </div>

      <!-- 直接启动（双计时模式下显示在计时控制下方） -->
      <div v-if="isDualTimerStage" class="flex items-center space-x-1 mb-1">
        <span class="text-white text-xs font-bold w-16">直接启动:</span>
        <button class="control-btn" @click="startPositiveTimer">启动正方(。)</button>
        <button class="control-btn" @click="startNegativeTimer">启动反方(，)</button>
      </div>

      <!-- 单计时器控制 -->
      <div v-else-if="!isSpecialStage" class="flex items-center space-x-1 mb-1">
        <span class="text-white text-xs font-bold w-16">计时控制:</span>
        <button class="control-btn" @click="isRunning ? pauseTimer() : startTimer()" :disabled="currentStage === 0">{{ isRunning ? '暂停计时(空格)' : (isPaused ? '继续计时(空格)' : '启动计时(空格)') }}</button>
        <button class="control-btn" @click="pauseTimer" :disabled="!isRunning && !isPaused">中断(P)</button>
      </div>

      <!-- 通用控制：环节切换 -->
      <div class="flex items-center space-x-1 mb-1">
        <span class="text-white text-xs font-bold w-16">环节切换:</span>
        <button class="control-btn" @click="previousStage" :disabled="currentStage <= 1">上一个环节(←)</button>
        <button class="control-btn" @click="nextStage" :disabled="currentStage >= stages.length">下一个环节(→)</button>
      </div>

      <!-- 试音环节 -->
      <div class="flex items-center space-x-1 mb-1">
        <span class="text-white text-xs font-bold w-16">试音环节:</span>
        <button class="control-btn" @click="playTestSound('30')">30秒(Q)</button>
        <button class="control-btn" @click="playTestSound('5')">5秒(W)</button>
        <button class="control-btn" @click="playTestSound('End')">时间到(E)</button>
      </div>

      <!-- 额外功能 -->
      <div class="flex items-center space-x-1 mb-1">
        <span class="text-white text-xs font-bold w-16">额外功能:</span>
        <button class="control-btn" @click="toggleFullscreen">进入全屏(F)</button>
        <button class="control-btn" @click="goBack">返回</button>
      </div>

      <!-- 特殊功能 -->
      <div class="flex items-center space-x-1">
        <span class="text-white text-xs font-bold w-16">特殊功能:</span>
        <button class="control-btn">奇袭发言</button>
        <button class="control-btn" @click="openTimeModal($event)">设置时间</button>
        <button class="control-btn">登记赛果</button>
      </div>
    </div>



    <!-- 进度指示器 -->
    <div v-if="showProgress" class="fixed inset-0 z-50" @click="() => { showProgress = false }">
      <div class="absolute top-32 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 rounded-lg p-4 border border-gray-600" @click.stop>
        <div class="text-center text-white text-base font-bold mb-3">辩论进度 (第{{ currentStage }}/{{ stages.length }}环节)</div>
        <div class="flex space-x-2 mb-2">
          <button v-for="stage in firstChunk" :key="stage.id" @click="jumpTo(stage.id)" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-transform" :class="{
              'bg-green-600 border-green-600 text-white': completedStages.includes(stage.id),
              'bg-blue-600 border-blue-600 text-white cursor-not-allowed opacity-80': currentStage === stage.id,
              'bg-gray-700 border-gray-600 text-gray-300 cursor-pointer hover:scale-[1.03]': !completedStages.includes(stage.id) && currentStage !== stage.id
            }">{{ stage.id }}</button>
        </div>
        <div class="flex space-x-2">
          <button v-for="stage in secondChunk" :key="stage.id" @click="jumpTo(stage.id)" class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-transform" :class="{
              'bg-green-600 border-green-600 text-white': completedStages.includes(stage.id),
              'bg-blue-600 border-blue-600 text-white cursor-not-allowed opacity-80': currentStage === stage.id,
              'bg-gray-700 border-gray-600 text-gray-300 cursor-pointer hover:scale-[1.03]': !completedStages.includes(stage.id) && currentStage !== stage.id
            }">{{ stage.id }}</button>
        </div>
      </div>
    </div>

    <!-- 时间设置弹窗（集成重置按钮 + 内部toast+进度条） -->
    <div v-if="showTimeModal" class="fixed bg-white rounded-lg p-3 w-64 shadow-2xl border border-gray-200 z-50" :style="{ top: timeModalPos.top + 'px', left: timeModalPos.left + 'px' }" @mouseenter="handleModalEnter" @mouseleave="handleModalLeave('time')">
      <!-- 内部 toast：居中在弹窗顶部，带进度条 -->
      <div v-if="showQuickTimeToast" class="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-2 bg-orange-500 text-white text-xs rounded shadow-lg whitespace-nowrap overflow-hidden z-10" style="min-width: 180px;">
        <div>请先点击输入框，再选择快捷时间</div>
        <div class="mt-1 h-1 bg-orange-300 rounded-full overflow-hidden">
          <div class="h-full bg-white" :style="{ width: toastProgress + '%', transition: 'width 2s linear' }"></div>
        </div>
      </div>
      <!-- 单计时器：标题 + 调整为 + 输入框 + 秒 同行 -->
      <div v-if="!isDualTimerStage" class="flex items-center mb-2">
        <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xs mr-2">i</div>
        <span class="text-gray-800 font-bold text-xs">调整时间</span>
        <span class="text-gray-800 text-xs ml-2">调整为</span>
        <input v-model.number="customTime" type="number" min="0" max="3600" class="mx-1.5 px-1.5 py-0.5 border border-gray-300 rounded w-14 text-center text-gray-800 text-xs" @keyup.enter="setCustomTime">
        <span class="text-gray-800 text-xs">秒</span>
      </div>
      <!-- 双计时器：标题行 + 正方/反方同行 -->
      <div v-else>
        <div class="flex items-center mb-2">
          <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xs mr-2">i</div>
          <span class="text-gray-800 font-bold text-xs">调整时间</span>
        </div>
        <div class="flex items-center space-x-2 mb-2">
          <div class="flex items-center flex-1">
            <span class="text-gray-600 text-xs">正方:</span>
            <input v-model.number="customPositiveTime" type="number" min="0" max="3600" class="ml-1 px-1.5 py-0.5 border border-gray-300 rounded w-14 text-center text-gray-800 text-xs" @keyup.enter="setCustomTime" @focus="lastFocusedInput = 'positive'">
          </div>
          <div class="flex items-center flex-1">
            <span class="text-gray-600 text-xs">反方:</span>
            <input v-model.number="customNegativeTime" type="number" min="0" max="3600" class="ml-1 px-1.5 py-0.5 border border-gray-300 rounded w-14 text-center text-gray-800 text-xs" @keyup.enter="setCustomTime" @focus="lastFocusedInput = 'negative'">
          </div>
        </div>
      </div>
      <!-- 快捷时间按钮：-5s +5s +10s +15s -->
      <div class="flex items-center space-x-1.5 mb-2">
        <button @click="addQuickTime(-5)" class="flex-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors">-5s</button>
        <button @click="addQuickTime(5)" class="flex-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors">+5s</button>
        <button @click="addQuickTime(10)" class="flex-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors">+10s</button>
        <button @click="addQuickTime(15)" class="flex-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors">+15s</button>
      </div>
      <!-- 底部按钮区：重置(红色) | 取消 | 确定 -->
      <div class="flex justify-between items-center mt-1">
        <button @click="openResetFromTimeModal" class="px-2.5 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors">重置</button>
        <div class="flex space-x-1.5">
          <button @click="closeTimeModal" class="px-2.5 py-0.5 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400 transition-colors">取消</button>
          <button @click="setCustomTime" class="px-2.5 py-0.5 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors">确定</button>
        </div>
      </div>
    </div>

    <!-- 重置确认弹窗 -->
    <div v-if="showResetModal" class="fixed bg-white rounded-lg p-3 w-64 shadow-2xl border border-gray-200 z-[60]" :style="{ top: resetModalPos.top + 'px', left: resetModalPos.left + 'px' }" @mouseenter="handleModalEnter" @mouseleave="handleModalLeave('reset')">
      <div v-if="isDualTimerStage">
        <div class="flex items-center mb-2">
          <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xs mr-2">i</div>
          <span class="text-gray-800 font-bold text-xs">重置计时器</span>
        </div>
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-gray-600 text-xs font-bold">正方</span>
            <button @click="resetDualTimer('positive')" class="px-2.5 py-0.5 border border-green-500 text-green-600 rounded text-xs hover:bg-green-50 transition-colors">点击重置</button>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-600 text-xs font-bold">反方</span>
            <button @click="resetDualTimer('negative')" class="px-2.5 py-0.5 border border-green-500 text-green-600 rounded text-xs hover:bg-green-50 transition-colors">点击重置</button>
          </div>
        </div>
        <div class="flex justify-end mt-3">
          <button @click="() => { showResetModal = false }" class="px-2.5 py-0.5 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400 transition-colors">关闭</button>
        </div>
      </div>
      <div v-else>
        <h3 class="text-base font-bold mb-2 text-gray-800">重置确认</h3>
        <p class="text-gray-600 mb-3 text-xs">确定要重置当前环节的计时器吗？</p>
        <div class="flex justify-end space-x-1.5">
          <button @click="() => { showResetModal = false }" class="px-2.5 py-0.5 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400 transition-colors">取消</button>
          <button @click="resetTimer" class="px-2.5 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors">确定重置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// ═══════════ 页面级配置 ═══════════
definePageMeta({ ssr: false, layout: false })

// ═══════════ 显式导入（帮助 IDE 类型检查与自动补全） ═══════════
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, useToast } from '#imports'
import { useDebateStore } from '~/stores/debate'

// ═══════════ 全局组合式 ═══════════
const debateStore = useDebateStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const matchId = computed(() => route.params.id as string)

// ═══════════ 赛事基本信息和辩题 ═══════════
const contestTitle = ref('辩论赛')
const positiveTopic = ref('')
const negativeTopic = ref('')
const teamPositiveName = ref('')
const teamNegativeName = ref('')
const positiveLabel = ref('正方')
const negativeLabel = ref('反方')

// ═══════════ UI 缩放与UI配置参数解析 ═══════════
const uiScale = ref(1)
onMounted(() => {
  try {
    const raw = Array.isArray(route.query?.scale) ? route.query.scale[0] : (route.query?.scale as string)
    const s = parseFloat(raw || '1')
    if (Number.isFinite(s)) uiScale.value = Math.min(2, Math.max(0.5, s))
  } catch {}
  // 从 URL 解析 ui 配置参数（用于预览 iframe）
  try {
    const uiRaw = Array.isArray(route.query?.ui) ? route.query.ui[0] : (route.query?.ui as string)
    if (uiRaw) {
      const parsed = JSON.parse(decodeURIComponent(uiRaw)) as Record<string, any>
      // 合并到 uiConfig
      Object.assign(uiConfig.value, parsed)
      // positiveLabel / negativeLabel 也是独立 ref
      if (typeof parsed.positiveLabel === 'string') positiveLabel.value = parsed.positiveLabel
      if (typeof parsed.negativeLabel === 'string') negativeLabel.value = parsed.negativeLabel
    }
  } catch {}
})

// ═══════════ UI 配置（视觉自定义） ═══════════
const uiConfig = ref({
  bannerVisible: true,       /* 显示横幅/辩题（原生字段）*/
  showBanner: true,          /* 显示横幅/辩题（details.vue 表单字段）*/
  eventNameVisible: true,    /* 显示比赛标题（原生字段）*/
  showTitle: true,           /* 显示比赛标题（details.vue 表单字段）*/
  titleColor: '#FFFFFF',     /* 标题颜色（details.vue 表单字段）*/
  teamNameColor: '#FFFFFF',  /* 队伍名称颜色（details.vue 表单字段）*/
  backgroundType: 'default' as 'default' | 'image',
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
  negativeLabel: '反方',
})

// ═══════════ 皮肤配置（背景等整体外观） ═══════════
// 与皮肤配置页同步，优先级高于 uiConfig 中的背景设置
const skinConfig = ref({
  backgroundType: 'default' as 'default' | 'gradient' | 'solid' | 'image',
  solidColor: '#1F2937',
  gradientStart: '#1F2937',
  gradientEnd: '#374151',
  imageUrl: '',
  imageOpacity: 1,
})

// ═══════════ 动态背景样式（根据皮肤配置计算） ═══════════
// 优先级：skinConfig > uiConfig > 默认径向渐变
// 与 TimerPreview 组件的 .timer-preview-container 默认背景保持一致
const backgroundStyle = computed(() => {
  let background = ''
  const skin = skinConfig.value
  const ui = uiConfig.value

  // 优先使用 skinConfig（皮肤配置页的设置）
  if (skin.backgroundType === 'gradient' && skin.gradientStart && skin.gradientEnd) {
    background = `radial-gradient(ellipse at center bottom, ${skin.gradientStart} 0%, ${skin.gradientEnd} 100%)`
  } else if (skin.backgroundType === 'solid' && skin.solidColor) {
    background = skin.solidColor
  } else if (skin.backgroundType === 'image' && skin.imageUrl) {
    background = `url(${skin.imageUrl}) center/cover no-repeat`
  }

  // 如果 skinConfig 是 default 或没有有效配置，回退到 uiConfig
  if (!background) {
    if (ui.backgroundType === 'image' && ui.imageFileName) {
      background = `url(${ui.imageFileName}) center/cover no-repeat`
    } else if ((ui as any).backgroundType === 'gradient' && (ui as any).gradientStart && (ui as any).gradientEnd) {
      background = `radial-gradient(ellipse at center bottom, ${(ui as any).gradientStart} 0%, ${(ui as any).gradientEnd} 100%)`
    } else if ((ui as any).backgroundType === 'solid' && (ui as any).solidColor) {
      background = (ui as any).solidColor
    }
  }

  // 最终回退：默认径向渐变（与预览组件一致）
  if (!background) {
    background = 'radial-gradient(ellipse at center bottom, rgb(57, 76, 86) 0%, rgb(14, 17, 17) 100%)'
  }

  return { background }
})

// ═══════════ 辩题文字溢出检测与字体大小调整 ═══════════
const positiveTopicRef = ref<HTMLElement | null>(null)
const negativeTopicRef = ref<HTMLElement | null>(null)
// 检测元素是否溢出单行，若是则切换为小字体两行
function checkTopicOverflow() {
  const check = (el: HTMLElement | null) => {
    if (!el || !el.textContent) return
    // 先去掉溢出类，检测是否会溢出
    el.classList.remove('topic-overflow')
    // 使用scrollWidth > clientWidth来检测
    const isOverflow = el.scrollWidth > el.clientWidth + 1
    if (isOverflow) el.classList.add('topic-overflow')
  }
  check(positiveTopicRef.value)
  check(negativeTopicRef.value)
}

// ═══════════ 设置面板 ═══════════
// 独立赛事模式下不显示设置弹窗，数据在创建赛事时已收集
const showSetup = ref(false)

// ═══════════ 进度指示器 ═══════════
const showProgress = ref(false)
const showTimeModal = ref(false)
const showResetModal = ref(false)
const customTime = ref(0)
const customPositiveTime = ref(0)
const customNegativeTime = ref(0)
const modalHoverTimer = ref<ReturnType<typeof setTimeout> | null>(null)
// 弹窗动态位置（跟随点击按钮的位置显示）
const timeModalPos = ref({ top: 0, left: 0 })
const resetModalPos = ref({ top: 0, left: 0 })
// 双计时模式下最后聚焦的输入框：'positive' | 'negative' | null
const lastFocusedInput = ref<string | null>(null)
// toast 进度条（100→0，2秒内完成
const toastProgress = ref(100)
let toastProgressTimer: ReturnType<typeof setInterval> | null = null
// 快捷时间 toast 提示
const showQuickTimeToast = ref(false)
let quickTimeToastTimer: ReturnType<typeof setTimeout> | null = null

// ═══════════ 从 debateStore 获取状态 ═══════════
const currentStage = computed(() => debateStore.currentStage)
const currentStageInfo = computed(() => debateStore.currentStageInfo)
const dualTimer = computed(() => debateStore.dualTimer)
const formattedTime = computed(() => debateStore.formattedTime)
const isRunning = computed(() => debateStore.isRunning)
const isPaused = computed(() => debateStore.isPaused)
const isTimeWarning = computed(() => debateStore.isTimeWarning)
const isTimeCritical = computed(() => debateStore.isTimeCritical)
// 按 order 排序的环节列表
const stages = computed(() => {
  const list = debateStore.stages || []
  return Array.isArray(list) ? [...list].sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0)) : []
})
const half = computed(() => Math.ceil(stages.value.length / 2))
const firstChunk = computed(() => stages.value.slice(0, half.value))
const secondChunk = computed(() => stages.value.slice(half.value))
const completedStages = computed(() => debateStore.completedStages)

const isSpecialStage = computed(() => currentStageInfo.value?.type === 'special')
const isDualTimerStage = computed(() => currentStageInfo.value?.type === 'dual-timer')
const displayTime = computed(() => (formattedTime.value || '00:00').padStart(5, '0'))

// ═══════════ 格式化双计时器时间 ═══════════
function formatDualTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// ═══════════ 计时控制（委托给 debateStore 内部心跳引擎，页面不再持有 timerInterval）═══════════
function startTimer() {
  if (isDualTimerStage.value) debateStore.startDualTimer()
  else debateStore.startTimer()
}

function pauseTimer() {
  debateStore.pauseTimer()
}

function resetTimer() {
  debateStore.resetTimer()
  showResetModal.value = false
}

function resetDualTimer(type: 'positive' | 'negative') {
  debateStore.resetDualTimer(type)
}

function switchActiveTimer() {
  debateStore.switchDualTimer()
}

function startPositiveTimer() {
  debateStore.startPositiveTimer()
}

function startNegativeTimer() {
  debateStore.startNegativeTimer()
}

// ═══════════ 环节切换 ═══════════
function nextStage() {
  if (currentStage.value < stages.value.length) debateStore.nextStage()
}

function previousStage() {
  if (currentStage.value > 1) debateStore.previousStage()
}

async function jumpTo(id: number) {
  if (id === currentStage.value) return
  debateStore.goToStage(id)
  showProgress.value = false
}

// ═══════════ 全屏切换 ═══════════
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {})
  } else {
    document.exitFullscreen()
  }
}

// ═══════════ 试音播放（使用 store 缓存的音频对象，避免每次 new Audio）═══════════
function playTestSound(type: '30' | '5' | 'End') {
  debateStore.playTestSound(type)
}

// ═══════════ 弹窗控制 ═══════════
// 根据点击事件计算弹窗位置：弹窗右下角出现在按钮正上方
// estimatedHeight: 弹窗估算高度，用于计算 top 值
function calcModalPosition(event: any, posRef: any, estimatedHeight: number = 150) {
  const target = event?.currentTarget || event?.target
  if (target && target.getBoundingClientRect) {
    const rect = target.getBoundingClientRect()
    const modalWidth = 260
    const gap = 8 // 弹窗与按钮之间的间距
    // 弹窗 top = 按钮 top - 弹窗高度 - 间距（弹窗底部贴近按钮顶部）
    let top = rect.top - estimatedHeight - gap
    // 弹窗 left = 按钮 right - 弹窗宽度（弹窗右下角对齐按钮右上角的上方）
    let left = rect.right - modalWidth
    // 边界修正：左侧超出屏幕时，左移到屏幕左侧
    if (left < 8) {
      left = 8
    }
    // 边界修正：上方空间不足时，改为在按钮下方显示
    if (top < 20) {
      top = rect.bottom + gap
    }
    posRef.value = { top, left }
  }
}

function handleModalEnter() {
  if (modalHoverTimer.value) clearTimeout(modalHoverTimer.value)
}
function handleModalLeave(modalType: string) {
  modalHoverTimer.value = setTimeout(() => {
    if (modalType === 'time') showTimeModal.value = false
    else if (modalType === 'reset') showResetModal.value = false
  }, 1000)
}
function openTimeModal(event?: any) {
  handleModalEnter()
  showResetModal.value = false
  lastFocusedInput.value = null // 打开弹窗时重置聚焦状态
  if (event) calcModalPosition(event, timeModalPos, 150)
  if (isDualTimerStage.value) {
    customPositiveTime.value = dualTimer.value.positiveTime
    customNegativeTime.value = dualTimer.value.negativeTime
  } else {
    customTime.value = (debateStore as any).timeRemaining || 0
  }
  showTimeModal.value = true
}
function openResetModal(event?: any) {
  // 打开重置确认弹窗（覆盖在时间弹窗之上）
  handleModalEnter()
  if (event) calcModalPosition(event, resetModalPos, 120)
  showResetModal.value = true
}
function closeTimeModal() {
  showTimeModal.value = false
}
// 显示 toast 提示（弹窗内居中）
// 性能优化：用 CSS transition 替代高频 setInterval（原每 50ms 触发响应式更新）
// 现在仅触发一次响应式更新，过渡动画在合成线程上执行，不阻塞主线程
function showToast() {
  showQuickTimeToast.value = true
  toastProgress.value = 100
  // 清理旧的定时器
  if (toastProgressTimer) clearInterval(toastProgressTimer)
  if (quickTimeToastTimer) clearTimeout(quickTimeToastTimer)
  // 下一帧再将进度设为 0，让 CSS transition 自动完成 2 秒动画
  // 双 requestAnimationFrame 确保浏览器先渲染 100% 状态再触发过渡
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toastProgress.value = 0
    })
  })
  // 2 秒后隐藏 toast
  quickTimeToastTimer = setTimeout(() => {
    showQuickTimeToast.value = false
  }, 2000)
}
// 从时间弹窗内点击红色"重置"按钮：打开重置确认弹窗（居中在旧弹窗位置，同时旧弹窗消失）
function openResetFromTimeModal() {
  // 将重置确认弹窗定位在时间弹窗的中心（两个弹窗宽度相同260px，左对齐；顶部略偏上）
  resetModalPos.value = {
    top: timeModalPos.value.top + 20,
    left: timeModalPos.value.left
  }
  showTimeModal.value = false  // 旧弹窗消失
  showResetModal.value = true   // 新弹窗显示
}
// 快捷时间：单计时模式直接加；双计时模式需先选择输入框
function addQuickTime(seconds: number) {
  // 单计时模式：直接加减
  if (!isDualTimerStage.value) {
    customTime.value = Number(customTime.value) + seconds
    return
  }
  // 双计时模式：必须先点击（聚焦）一个输入框
  if (lastFocusedInput.value === 'positive') {
    customPositiveTime.value = Number(customPositiveTime.value) + seconds
  } else if (lastFocusedInput.value === 'negative') {
    customNegativeTime.value = Number(customNegativeTime.value) + seconds
  } else {
    // 未聚焦任何输入框，弹出 toast 提醒
    showToast()
  }
}
function setCustomTime() {
  if (isDualTimerStage.value) {
    debateStore.setCustomDualTime(Number(customPositiveTime.value), Number(customNegativeTime.value))
  } else {
    debateStore.setCustomTime(Number(customTime.value))
  }
  showTimeModal.value = false
}

// ═══════════ 设置面板 ═══════════
// 独立赛事模式下不显示设置弹窗，数据在创建赛事时已收集
function goBack() {
  debateStore.disposeTimer()
  router.push(`/standalone/${matchId.value}`)
}

// ═══════════ 键盘快捷键 ═══════════
function handleKeyPress(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

  const keyMap: Record<string, () => void> = {
    'ArrowLeft': () => { if (currentStage.value > 1) previousStage() },
    'ArrowRight': () => { if (currentStage.value < stages.value.length) nextStage() },
    ' ': () => {
      if (isDualTimerStage.value) {
        isRunning.value ? switchActiveTimer() : startTimer()
      } else if (!isSpecialStage.value) {
        isRunning.value ? pauseTimer() : startTimer()
      }
    },
    'p': () => { if (isRunning.value) pauseTimer() },
    'P': () => { if (isRunning.value) pauseTimer() },
    '.': () => { if (isDualTimerStage.value) startPositiveTimer() },
    '。': () => { if (isDualTimerStage.value) startPositiveTimer() },
    ',': () => { if (isDualTimerStage.value) startNegativeTimer() },
    '，': () => { if (isDualTimerStage.value) startNegativeTimer() },
    'q': () => playTestSound('30'),
    'Q': () => playTestSound('30'),
    'w': () => playTestSound('5'),
    'W': () => playTestSound('5'),
    'e': () => playTestSound('End'),
    'E': () => playTestSound('End'),
    'f': toggleFullscreen,
    'F': toggleFullscreen,
    'b': goBack,
    'B': goBack,
    'Tab': () => { event.preventDefault(); showProgress.value = !showProgress.value },
  }
  const handler = keyMap[event.key]
  if (handler) { event.preventDefault(); handler() }
}

// ═══════════ 数据加载：从赛事信息和配置获取数据 ═══════════
async function loadTournamentData() {
  try {
    // 加载独立赛事基本信息
    const match = await $fetch<any>(`/api/standalone-matches/${matchId.value}`, {
      headers: { Authorization: `Bearer ${useAuthStore().token}` },
    })
    let matchName = '辩论赛'
    if (match?.data) {
      const m = match.data
      matchName = m.name || '辩论赛'
    }

    // 加载计时器配置（包含标题、队伍名称、辩题等自定义设置）
    const configRes = await $fetch<any>(`/api/standalone-matches/${matchId.value}/timer-config`, {
      headers: { Authorization: `Bearer ${useAuthStore().token}` },
    })
    if (configRes?.data) {
      const cfg = configRes.data
      // 优先使用配置中的 title 或 name，其次使用赛事名称
      contestTitle.value = cfg.title || cfg.name || matchName
      // 同步其他配置（队伍名称、辩题等）
      if (cfg.teamPositiveName) teamPositiveName.value = cfg.teamPositiveName
      if (cfg.teamNegativeName) teamNegativeName.value = cfg.teamNegativeName
      if (cfg.positiveTopic) positiveTopic.value = cfg.positiveTopic
      if (cfg.negativeTopic) negativeTopic.value = cfg.negativeTopic
      // 同步正方/反方标签
      if (cfg.uiConfig?.positiveLabel) positiveLabel.value = cfg.uiConfig.positiveLabel
      if (cfg.uiConfig?.negativeLabel) negativeLabel.value = cfg.uiConfig.negativeLabel
      // 同步 UI 配置（标题颜色等）
      if (cfg.uiConfig) Object.assign(uiConfig.value, cfg.uiConfig)
      // 同步皮肤配置（背景等整体外观）
      if (cfg.skinConfig) Object.assign(skinConfig.value, cfg.skinConfig)
      // 同步环节配置（从 timer-config 的 stages 字段读取，与 timing.vue 保存的数据源一致）
      if (cfg.stages && Array.isArray(cfg.stages) && cfg.stages.length > 0) {
        const convertedStages = cfg.stages.map((s: any, idx: number) => ({
          id: Number(s.id) || idx + 1,
          name: s.name || '未命名环节',
          duration: s.duration || 60,
          type: s.type === 'free_debate' || s.type === 'dual-timer' ? 'dual-timer' : (s.type === 'special' ? 'special' : 'speech'),
          order: typeof s.orderIndex === 'number' ? s.orderIndex : (s.order ?? idx + 1),
          positiveDuration: s.positiveDuration || s.duration || 60,
          negativeDuration: s.negativeDuration || s.duration || 60,
        }))
        debateStore.setStages(convertedStages)
      }
    } else {
      // 没有配置时使用赛事名称
      contestTitle.value = matchName
    }

    // 如果环节为空，使用默认模板
    if (!stages.value.length) {
      const defaultStages = [
        { id: 1, name: '开篇立论', duration: 180, type: 'speech' as const, order: 1, positiveDuration: 180, negativeDuration: 180 },
        { id: 2, name: '攻辩', duration: 120, type: 'speech' as const, order: 2, positiveDuration: 120, negativeDuration: 120 },
        { id: 3, name: '自由辩论', duration: 240, type: 'dual-timer' as const, order: 3, positiveDuration: 120, negativeDuration: 120 },
        { id: 4, name: '总结陈词', duration: 180, type: 'speech' as const, order: 4, positiveDuration: 180, negativeDuration: 180 },
      ]
      debateStore.setStages(defaultStages)
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  }
}

// resize 回流节流：用 rAF 合并高频 resize 事件，避免每次触发都强制同步布局重排
let resizeRafHandle: number | null = null
function onResizeThrottled() {
  if (resizeRafHandle !== null) return
  resizeRafHandle = requestAnimationFrame(() => {
    resizeRafHandle = null
    checkTopicOverflow()
  })
}

onMounted(async () => {
  await loadTournamentData()
  // 独立赛事模式下不显示设置弹窗，数据从 timer-config 加载
  document.addEventListener('keydown', handleKeyPress)
  // 等待DOM渲染后检测辩题文字溢出
  setTimeout(() => {
    checkTopicOverflow()
    window.addEventListener('resize', onResizeThrottled)
  }, 100)
})

onUnmounted(() => {
  if (resizeRafHandle !== null) cancelAnimationFrame(resizeRafHandle)
  if (modalHoverTimer.value) clearTimeout(modalHoverTimer.value)
  document.removeEventListener('keydown', handleKeyPress)
  window.removeEventListener('resize', onResizeThrottled)
  debateStore.disposeTimer()
})
</script>

<style scoped>
/* ═══════════ 字体定义（全局main.css已定义，此处仅作引用）═══════════ */
/* ponytail: 删除重复的@font-face定义，使用全局定义 */
/* 性能优化：用具体元素选择器替代 * 通配符（原 `*:not(.digital-char)` 会扫描所有 DOM 节点）
   显式列出页面用到的元素类型，覆盖范围相同但计算成本大幅降低 */
.responsive-container,
.responsive-container h1, .responsive-container h2, .responsive-container h3,
.responsive-container h4, .responsive-container h5, .responsive-container h6,
.responsive-container p, .responsive-container span, .responsive-container div,
.responsive-container button, .responsive-container input, .responsive-container label,
.responsive-container td, .responsive-container th, .responsive-container li,
.responsive-container a, .responsive-container strong, .responsive-container em {
  font-family: 'SourceHanSerifCN-Heavy', 'SimSun', '宋体', serif !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}
/* digital-char 元素保留 Digiface 字体（在更具体的类中定义） */

/* ═══════════ 缩放容器 ═══════════ */
.scale-wrapper { transform: scale(var(--ui-scale)); transform-origin: top center; }

/* ═══════════ 渐变背景（复刻原始设计） ═══════════ */
.gradient-background { background: radial-gradient(ellipse at center bottom, rgb(57, 76, 86) 0%, rgb(14, 17, 17) 100%); }
.responsive-container, :deep(html), :deep(body) { min-height: 100vh; overflow: hidden; }
.responsive-container { display: flex; flex-direction: column; }

/* ═══════════ 横幅（顶部红蓝条） ═══════════ */
.debate-header { padding-top: 6vh; flex-shrink: 0; }
.debate-side-positive { background-color: rgb(169, 35, 35); padding: 1vh 2vw; }
.debate-side-negative { background-color: rgb(3, 105, 161); padding: 1vh 2vw; }
.debate-label-white {
  border: 1px solid white; border-radius: 0.5vw; padding: 0; /* 边框细一些，圆角更圆润 */
  font-size: clamp(2vw, 3vw, 2.8vw); /* 标签字体加大，更醒目 */
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  height: 1.3em; line-height: 1.3;
}
.debate-label-white span { padding: 0.1vh 0.5vw; line-height: 1; }
/* 辩题文字：默认与标签同大小，单行；溢出时自动变两行并缩小字体 */
.debate-topic-text {
  font-size: clamp(2vw, 3vw, 2.8vw); /* 默认与标签同大小 */
  line-height: 1.2;
  max-width: 45vw;
  white-space: nowrap;              /* 默认单行 */
  overflow: hidden;
  flex: 1;
  min-width: 0;
}
.debate-topic-text.topic-overflow {
  font-size: 1.5vw;                 /* 溢出时变小字体 */
  white-space: normal;              /* 允许换行 */
  word-wrap: break-word;
  line-height: 1.3;
}
.debate-side-positive .debate-label-white { margin-left: 1vw; margin-right: 2vw; }
.debate-side-negative .debate-label-white { margin-right: 1vw; margin-left: 2vw; }

/* ═══════════ 主内容区 ═══════════ */
/* 使用从顶部固定偏移的布局，确保单/双计时器模式下 h1 和计时器位置一致 */
/* 基准换算：vw/vh 基于屏幕实际尺寸（1vw=屏幕宽度的1%, 1vh=屏幕高度的1%） */
/* 与 TimerPreview.vue 的对应关系：1vw = 12.8px (1280px宽度基准), 1vh = 10.8px (1080px高度基准) */
.main-content { flex: 1; display: flex; flex-direction: column; align-items: center; padding-top: 8vh; padding-bottom: 25vh; }
.contest-title { margin-bottom: 5vh; }
.contest-title-text { font-size: 4.5vw; } /* 赛事名称标题在原基础上加 0.5 倍 */
.contest-title-color { color: rgb(3, 105, 161); }

/* ═══════════ 计时器区域 ═══════════ */
/* 固定最小高度容器，确保单/双计时器模式下环节标题位置一致 */
.stage-timer-container { display: flex; flex-direction: column; align-items: center; gap: 2vh; min-height: 40vh; }
.stage-title-text { font-size: 4.376vw; } /* 环节标题在原 2.917vw 基础上加 0.5 倍 */
.special-stage-text { font-size: 13.281vw; line-height: 1.2; } /* 特殊环节在原 8.854vw 基础上加 0.5 倍 */

/* ═══════════ 双计时器 ═══════════ */
.dual-timer-display { display: flex; justify-content: center; align-items: center; gap: 8vw; }
.timer-side { display: flex; flex-direction: column; align-items: center; }
.timer-label { font-size: 1.875vw; font-weight: bold; margin-top: 2vh; } /* 在原 1.25vw 基础上加 0.5 倍 */
.positive-label { color: rgb(179, 37, 37); }
.negative-label { color: rgb(3, 105, 161); }

/* ═══════════ 单计时器显示容器 ═══════════ */
/* 给单计时器区域设置最小高度，使单/双计时器模式下计时器上方位置对齐 */
.timer-display-section { min-height: 13.75vw; display: flex; align-items: flex-start; justify-content: center; }

/* ═══════════ 数码时钟 ═══════════ */
.digital-display { display: flex; justify-content: center; align-items: center; gap: 0.1em; }
/* 提权到高于 `.responsive-container span`（ponytail 优化把它圈进了 serif 规则），确保计时数字用 Digiface */
.digital-display .digital-char { font-family: 'Digiface', monospace !important; font-size: 13.75vw; font-weight: normal; line-height: 1; } /* 在原 9.167vw 基础上加 0.5 倍 */

/* ═══════════ 控制面板：默认透明，悬停可见 ═══════════ */
.control-panel {
  opacity: 0.1;
  transition: opacity 0.3s ease-in-out;
  background: transparent;
  min-width: 14vw; /* 确保全屏时能放下标签+按钮 */
}
.control-panel:hover { opacity: 1; }

/* 标签 span：响应式宽度，实现左对齐基准（禁止内部换行） */
.control-panel span.text-xs {
  font-size: 1.146vw;
  width: 5vw; /* 响应式宽度，与按钮 vw 单位协调，保证不同屏幕下比例一致 */
  display: inline-block;
  flex-shrink: 0;
  white-space: nowrap; /* 禁止文字在标签内换行 */
  /* 使用阿里巴巴普惠体 Regular（较粗，标签醒目） */
  font-family: 'AlibabaPuHuiTi', 'SimSun', '宋体', sans-serif !important;
  font-weight: 400;
}

/* 每一行：flex 布局，行间距统一，禁止换行 */
.control-panel > div {
  margin-bottom: 0.2vw;
  display: flex;
  align-items: center;
  width: 100%;
  flex-wrap: nowrap; /* 防止按钮换行到下一行 */
}

/* 元素间距：统一用 gap 控制 */
.control-panel .space-x-1 {
  gap: 0.15vw;
}
.control-panel .space-x-1 > * + * {
  margin-left: 0;
}

/* 按钮：均分宽度，圆角更圆润 */
.control-btn {
  position: relative;
  padding: 0.2vw 0.4vw; /* padding 再缩小 */
  background: transparent;
  color: white;
  font-size: 1vw; /* 字号略缩小 */
  border: 0.1vw solid #4a5568;
  border-radius: 0.3vw;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex: 1;
  text-align: center; /* 水平居中 */
  display: flex; /* 垂直居中 */
  align-items: center; /* 垂直居中 */
  justify-content: center; /* 水平居中（flex 模式下） */
  min-width: 2.5vw; /* 最小宽度再缩小 */
  /* 使用阿里巴巴普惠体 Light（轻盈，按钮不厚重） */
  font-family: 'AlibabaPuHuiTi', 'SimSun', '宋体', sans-serif !important;
  font-weight: 300;
}
.control-btn:hover { border-color: #718096; background: rgba(255, 255, 255, 0.05); }
.control-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ═══════════ 全屏适配（缩放倍率自动跟随视口，无需额外设置） ═══════════ */
</style>