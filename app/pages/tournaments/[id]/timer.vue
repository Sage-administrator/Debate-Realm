<!--
  计时器全屏演示页面 - 复刻自 reference/往期项目代码/debate-timer/pages/index.vue
  视觉设计：径向渐变背景、红蓝横幅、Digiface 数码字体、控制面板悬停可见
  适配：使用项目 debateStore 管理计时状态，移除 QQ Bot/WS 相关功能
  不包含"快捷时间"div
-->
<template>
  <div class="h-screen text-white overflow-hidden responsive-container gradient-background scale-wrapper" :style="{ '--ui-scale': uiScale }">

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

    <!-- 进入前设置面板 -->
    <div v-if="showSetup" class="fixed inset-0 z-40 flex items-center justify-center" @click="showSetup = false">
      <div class="absolute inset-0 bg-black/50"></div>
      <div class="relative bg-white text-gray-800 rounded-lg shadow-2xl w-[45rem] max-w-[90vw] border border-gray-200 p-4" @click.stop>
        <h3 class="font-bold text-lg mb-3">对阵双方和辩题设置</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-600 mb-1 block">正方队伍名</label>
            <input v-model="setupTeamPositiveName" class="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-600" placeholder="例：重庆大学">
          </div>
          <div>
            <label class="text-xs text-gray-600 mb-1 block">反方队伍名</label>
            <input v-model="setupTeamNegativeName" class="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-600" placeholder="例：中国科学院大学">
          </div>
          <div>
            <label class="text-xs text-gray-600 mb-1 block">正方辩题</label>
            <input v-model="setupPositiveTopic" class="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-600" placeholder="请输入正方辩题">
          </div>
          <div>
            <label class="text-xs text-gray-600 mb-1 block">反方辩题</label>
            <input v-model="setupNegativeTopic" class="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-600" placeholder="请输入反方辩题">
          </div>
        </div>
        <div class="flex items-center justify-between mt-4">
          <button class="px-3 py-1 border border-blue-500 text-blue-600 rounded text-sm hover:bg-blue-50 transition-colors" @click="openMatchSelectModal">从赛程选择</button>
          <button class="px-3 py-1 border border-green-600 bg-green-600 text-white rounded text-sm hover:bg-green-700" @click="applySetupAndStart">使用以上设置开始计时</button>
        </div>
      </div>
    </div>

    <!-- 从赛程选择比赛弹窗 -->
    <div v-if="showMatchSelectModal" class="fixed inset-0 z-50 flex items-center justify-center" @click="showMatchSelectModal = false">
      <div class="absolute inset-0 bg-black/50"></div>
      <div class="relative bg-white text-gray-800 rounded-lg shadow-2xl w-[35rem] max-w-[90vw] max-h-[70vh] border border-gray-200 p-4 overflow-hidden flex flex-col" @click.stop>
        <h3 class="font-bold text-lg mb-3">从赛程选择比赛</h3>
        <div v-if="matchSelectLoading" class="flex-1 flex items-center justify-center py-8">
          <span class="text-gray-500 text-sm">加载中...</span>
        </div>
        <div v-else-if="matches.length === 0" class="flex-1 flex items-center justify-center py-8">
          <span class="text-gray-500 text-sm">暂无比赛数据，请先在赛程页面添加比赛</span>
        </div>
        <div v-else class="flex-1 overflow-y-auto space-y-2">
          <div
            v-for="match in matches"
            :key="match.id"
            class="border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
            @click="selectMatch(match)"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-gray-500">第 {{ match.round }} 轮 · 第 {{ match.orderNum }} 场</span>
              <span v-if="match.status" class="text-xs px-2 py-0.5 bg-gray-100 rounded">{{ match.status === 'completed' ? '已完成' : (match.status === 'in_progress' ? '进行中' : '待开始') }}</span>
            </div>
            <div class="font-bold text-sm text-gray-800 mb-1">
              {{ match.teamA || '队伍A' }} vs {{ match.teamB || '队伍B' }}
            </div>
            <div class="text-xs text-gray-600">
              <span v-if="match.affirmativeSide === 'teamA'">正方: {{ match.teamA }} / 反方: {{ match.teamB }}</span>
              <span v-else-if="match.affirmativeSide === 'teamB'">正方: {{ match.teamB }} / 反方: {{ match.teamA }}</span>
              <span v-else>未指定正反方</span>
            </div>
            <div v-if="match.topic" class="text-xs text-gray-500 mt-1">
              辩题: {{ match.topic }}
            </div>
          </div>
        </div>
        <div class="mt-4 flex justify-end">
          <button class="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50" @click="showMatchSelectModal = false">取消</button>
        </div>
      </div>
    </div>

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
    <div v-if="showProgress" class="fixed inset-0 z-50" @click="showProgress = false">
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
          <div class="h-full bg-white" :style="{ width: toastProgress + '%', transition: 'width 0.05s linear' }"></div>
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
          <button @click="showResetModal = false" class="px-2.5 py-0.5 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400 transition-colors">关闭</button>
        </div>
      </div>
      <div v-else>
        <h3 class="text-base font-bold mb-2 text-gray-800">重置确认</h3>
        <p class="text-gray-600 mb-3 text-xs">确定要重置当前环节的计时器吗？</p>
        <div class="flex justify-end space-x-1.5">
          <button @click="showResetModal = false" class="px-2.5 py-0.5 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400 transition-colors">取消</button>
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
const tournamentId = computed(() => route.params.id as string)

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
// 检测 URL 是否包含预览参数——如有则跳过初始设置弹窗
const isPreviewMode = computed(() => !!route.query?.ui)
const showSetup = ref(true)
const setupPositiveTopic = ref('')
const setupNegativeTopic = ref('')
const setupTeamPositiveName = ref('')
const setupTeamNegativeName = ref('')
const manualSetupApplied = ref(false)

// ═══════════ 从赛程选择弹窗 ═══════════
const showMatchSelectModal = ref(false)
const matches = ref<any[]>([])
const matchSelectLoading = ref(false)

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
let timerInterval: ReturnType<typeof setInterval> | null = null

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

// ═══════════ 计时控制 ═══════════
function startTimer() {
  debateStore.startTimer()
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    if (isDualTimerStage.value) {
      debateStore.tickDualTimer()
      if (dualTimer.value.positiveTime === 0 && dualTimer.value.negativeTime === 0) {
        clearInterval(timerInterval!)
        timerInterval = null
      }
    } else {
      debateStore.tick()
      if ((debateStore as any).timeRemaining === 0) {
        clearInterval(timerInterval!)
        timerInterval = null
      }
    }
  }, 1000)
}

function pauseTimer() {
  debateStore.pauseTimer()
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
}

function resetTimer() {
  if (timerInterval) clearInterval(timerInterval)
  debateStore.resetTimer()
  showResetModal.value = false
}

function resetDualTimer(type: 'positive' | 'negative') {
  if (timerInterval) clearInterval(timerInterval)
  debateStore.resetDualTimer(type)
}

function switchActiveTimer() {
  debateStore.switchDualTimer()
}

function startPositiveTimer() {
  if (timerInterval) clearInterval(timerInterval)
  debateStore.startPositiveTimer()
  startTimer()
}

function startNegativeTimer() {
  if (timerInterval) clearInterval(timerInterval)
  debateStore.startNegativeTimer()
  startTimer()
}

// ═══════════ 环节切换 ═══════════
function nextStage() {
  if (timerInterval) clearInterval(timerInterval)
  if (currentStage.value < stages.value.length) debateStore.nextStage()
}

function previousStage() {
  if (timerInterval) clearInterval(timerInterval)
  if (currentStage.value > 1) debateStore.previousStage()
}

async function jumpTo(id: number) {
  if (id === currentStage.value) return
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
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

// ═══════════ 试音播放 ═══════════
function playTestSound(type: string) {
  try { new Audio(`/${type}.mp3`).play().catch(() => {}) } catch {}
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
function showToast() {
  showQuickTimeToast.value = true
  toastProgress.value = 100
  // 每50ms减少2.5%，2秒内从100→0
  if (toastProgressTimer) clearInterval(toastProgressTimer)
  toastProgressTimer = setInterval(() => {
    toastProgress.value -= 2.5
    if (toastProgress.value <= 0) {
      if (toastProgressTimer) clearInterval(toastProgressTimer)
      showQuickTimeToast.value = false
    }
  }, 50)
  // 2秒后确保关闭toast
  if (quickTimeToastTimer) clearTimeout(quickTimeToastTimer)
  quickTimeToastTimer = setTimeout(() => {
    showQuickTimeToast.value = false
    if (toastProgressTimer) clearInterval(toastProgressTimer)
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
// 从赛程选择弹窗：加载比赛列表
async function openMatchSelectModal() {
  showMatchSelectModal.value = true
  if (matches.value.length === 0) {
    matchSelectLoading.value = true
    try {
      const res = await $fetch<any>(`/api/tournaments/${tournamentId.value}/matches`, {
        headers: { Authorization: `Bearer ${useAuthStore().token}` },
      })
      if (Array.isArray(res)) matches.value = res
    } catch (e) {
      toast.add({ title: '加载赛程失败', color: 'error' })
    } finally {
      matchSelectLoading.value = false
    }
  }
}
// 从赛程选择弹窗：选中一场比赛，自动填充队伍名称和辩题
function selectMatch(match: any) {
  // 根据 affirmativeSide 判断正反方
  if (match.affirmativeSide === 'teamA') {
    setupTeamPositiveName.value = match.teamA || ''
    setupTeamNegativeName.value = match.teamB || ''
  } else if (match.affirmativeSide === 'teamB') {
    setupTeamPositiveName.value = match.teamB || ''
    setupTeamNegativeName.value = match.teamA || ''
  } else {
    // 未指定正反方时，默认 teamA 为正方
    setupTeamPositiveName.value = match.teamA || ''
    setupTeamNegativeName.value = match.teamB || ''
  }
  // 辩题：从 match.topic 解析（支持 JSON 格式：{"pro":"...","con":"..."}）
  if (match.topic) {
    try {
      const parsed = JSON.parse(match.topic)
      if (parsed && typeof parsed === 'object' && parsed.pro && parsed.con) {
        setupPositiveTopic.value = parsed.pro
        setupNegativeTopic.value = parsed.con
      } else {
        setupPositiveTopic.value = match.topic
        setupNegativeTopic.value = match.topic
      }
    } catch (e) {
      setupPositiveTopic.value = match.topic
      setupNegativeTopic.value = match.topic
    }
  }
  manualSetupApplied.value = true
  showMatchSelectModal.value = false
}
function applySetupAndStart() {
  positiveTopic.value = setupPositiveTopic.value
  negativeTopic.value = setupNegativeTopic.value
  teamPositiveName.value = setupTeamPositiveName.value
  teamNegativeName.value = setupTeamNegativeName.value
  manualSetupApplied.value = true
  showSetup.value = false
}
function goBack() {
  if (timerInterval) clearInterval(timerInterval)
  router.push(`/tournaments/${tournamentId.value}`)
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
    // 加载赛事基本信息
    const tournament = await $fetch<any>(`/api/tournaments/${tournamentId.value}`, {
      headers: { Authorization: `Bearer ${useAuthStore().token}` },
    })
    let tournamentName = '辩论赛'
    if (tournament?.data) {
      const t = tournament.data
      tournamentName = t.name || '辩论赛'
      // 从参赛队伍中取前两队作为正反方
      const teams: string[] = t.teams || []
      if (teams.length >= 1 && !manualSetupApplied.value) setupTeamPositiveName.value = teams[0]!
      if (teams.length >= 2 && !manualSetupApplied.value) setupTeamNegativeName.value = teams[1]!
    }

    // 加载计时器配置（包含标题、队伍名称、辩题等自定义设置）
    const configRes = await $fetch<any>(`/api/tournaments/${tournamentId.value}/timer-config`, {
      headers: { Authorization: `Bearer ${useAuthStore().token}` },
    })
    if (configRes?.data) {
      const cfg = configRes.data
      // 优先使用配置中的 title 或 name，其次使用赛事名称
      contestTitle.value = cfg.title || cfg.name || tournamentName
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
    } else {
      // 没有配置时使用赛事名称
      contestTitle.value = tournamentName
    }

    // 加载计时器环节配置
    const template = await $fetch<any>(`/api/tournaments/${tournamentId.value}/timer-template`, {
      headers: { Authorization: `Bearer ${useAuthStore().token}` },
    })
    if (template?.phases) {
      const phases = typeof template.phases === 'string' ? JSON.parse(template.phases) : template.phases
      if (Array.isArray(phases) && phases.length > 0) {
        // 将 phases 转换为 debateStore 能识别的 stages 格式
        const convertedStages = phases.map((p: any, idx: number) => ({
          id: Number(p.id) || idx + 1,
          name: p.name || '未命名环节',
          duration: p.duration || 60,
          type: p.type === 'free_debate' || p.type === 'dual-timer' ? 'dual-timer' : (p.type === 'special' ? 'special' : 'speech'),
          order: p.order ?? idx + 1,
          positiveDuration: p.positiveDuration || p.duration || 60,
          negativeDuration: p.negativeDuration || p.duration || 60,
        }))
        debateStore.setStages(convertedStages)
      }
    }

    // 如果环节为空，使用默认模板
    if (!stages.value.length) {
      const defaultStages = [
        { id: 1, name: '开篇立论', duration: 180, type: 'speech' as const, order: 1, positiveDuration: 180, negativeDuration: 180 },
        { id: 2, name: '攻辩', duration: 120, type: 'speech' as const, order: 2, positiveDuration: 120, negativeDuration: 120 },
        { id: 3, name: '自由辩论', duration: 240, type: 'dual-timer' as const, order: 3, positiveDuration: 240, negativeDuration: 240 },
        { id: 4, name: '总结陈词', duration: 180, type: 'speech' as const, order: 4, positiveDuration: 180, negativeDuration: 180 },
      ]
      debateStore.setStages(defaultStages)
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  }
}

onMounted(async () => {
  await loadTournamentData()
  // 预览模式下自动应用已加载的队伍/辩题设置，跳过设置弹窗
  if (isPreviewMode.value) {
    positiveTopic.value = setupPositiveTopic.value
    negativeTopic.value = setupNegativeTopic.value
    teamPositiveName.value = setupTeamPositiveName.value
    teamNegativeName.value = setupTeamNegativeName.value
    showSetup.value = false
  }
  document.addEventListener('keydown', handleKeyPress)
  // 等待DOM渲染后检测辩题文字溢出
  setTimeout(() => {
    checkTopicOverflow()
    window.addEventListener('resize', checkTopicOverflow)
  }, 100)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (modalHoverTimer.value) clearTimeout(modalHoverTimer.value)
  document.removeEventListener('keydown', handleKeyPress)
  window.removeEventListener('resize', checkTopicOverflow)
})
</script>

<style scoped>
/* ═══════════ 字体定义 ═══════════ */
@font-face { font-family: 'SourceHanSerifCN-Heavy'; src: url('/SourceHanSerifCN-Heavy.otf') format('opentype'); }
@font-face { font-family: 'Digiface'; src: url('/Digiface.ttf') format('truetype'); }
*:not(.digital-char) { font-family: 'SourceHanSerifCN-Heavy', 'SimSun', '宋体', serif !important; user-select: none !important; -webkit-user-select: none !important; }

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
.digital-char { font-family: 'Digiface', monospace !important; font-size: 13.75vw; font-weight: normal; line-height: 1; } /* 在原 9.167vw 基础上加 0.5 倍 */

/* ═══════════ 控制面板：默认透明，悬停可见 ═══════════ */
.control-panel {
  opacity: 0.1;
  transition: opacity 0.3s ease-in-out;
  background: transparent;
  min-width: 14vw; /* 确保全屏时能放下标签+按钮 */
}
.control-panel:hover { opacity: 1; }

/* 标签 span：固定宽度，实现左对齐基准（禁止内部换行） */
.control-panel span.text-xs {
  font-size: 1.146vw;
  min-width: 3vw; /* 确保容纳"计时控制:"等中文标签 */
  display: inline-block;
  flex-shrink: 0;
  white-space: nowrap; /* 禁止文字在标签内换行 */
}

/* 每一行：flex 布局，行间距统一，禁止换行 */
.control-panel > div {
  margin-bottom: 0.2vw;
  display: flex;
  align-items: center;
  width: 100%;
  flex-wrap: nowrap; /* 防止按钮换行到下一行 */
}

/* 标签与按钮的分隔：标签固定宽度，按钮区自动延伸 */
.control-panel > div > span.text-xs + * {
  display: flex;
  align-items: center;
  gap: 0.15vw; /* 按钮间距再缩小 */
  flex: 1;
  justify-content: flex-start;
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
  font-weight: bold;
  border: 2px solid #4a5568;
  border-radius: 0.3vw; /* 圆角也缩小 */
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex: 1;
  text-align: center;
  min-width: 2.5vw; /* 最小宽度再缩小 */
  font-family: 'SimSun', '宋体', serif !important;
}
.control-btn:hover { border-color: #718096; background: rgba(255, 255, 255, 0.05); }
.control-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ═══════════ 全屏适配（缩放倍率自动跟随视口，无需额外设置） ═══════════ */
</style>
