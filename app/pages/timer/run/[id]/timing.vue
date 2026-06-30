<!--
  /pages/timer/run/[id]/timing.vue - 计时器运行时页面
  功能：
  - 显示辩论比赛的实时计时
  - 支持单计时器（发言、质询等）和双计时器（对辩、自由辩论）
  - 键盘快捷键操作
  - 声音提示（剩余30秒、5秒、时间到）
-->
<script setup lang="ts">
const authStore = useAuthStore()
const debateStore = useDebateStore()
const toast = useToast()
const route = useRoute()

const projectId = computed(() => route.params.id as string)

// 页面状态
const loading = ref(true)
const project = ref<any>(null)
const showSetupModal = ref(false) // 赛前设置弹窗（队伍名称、辩题）
const showTimeModal = ref(false)  // 临时设置时间弹窗
const showProgress = ref(false)   // 环节进度指示

// 赛前设置（临时覆盖，可编辑）
const setupForm = reactive({
  teamPositiveName: '',
  teamNegativeName: '',
  positiveTopic: '',
  negativeTopic: '',
})

// 自定义时间设置
const customTime = ref(0)
const customPositiveTime = ref(0)
const customNegativeTime = ref(0)

// ═══════════════════════════════════════════════
// 1. 加载项目数据并初始化状态
// ═══════════════════════════════════════════════
async function loadProject() {
  loading.value = true
  try {
    const res = await $fetch<any>(`/api/timer/projects/${projectId.value}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    project.value = res.data

    // 初始化赛前设置
    setupForm.teamPositiveName = res.data.teamPositiveName || ''
    setupForm.teamNegativeName = res.data.teamNegativeName || ''
    setupForm.positiveTopic = res.data.positiveTopic || ''
    setupForm.negativeTopic = res.data.negativeTopic || ''

    // 初始化 debate store
    const projectForStore: any = {
      id: res.data.id,
      name: res.data.name,
      title: res.data.title,
      positiveTopic: res.data.positiveTopic,
      negativeTopic: res.data.negativeTopic,
      teamPositiveName: res.data.teamPositiveName,
      teamNegativeName: res.data.teamNegativeName,
      stages: res.data.stages.map((s: any) => ({
        id: s.id,
        name: s.name,
        duration: s.duration,
        type: s.type,
        description: s.description,
        order: s.order,
        positiveDuration: s.positiveDuration,
        negativeDuration: s.negativeDuration,
        allowedRoles: s.allowedRoles,
      })),
    }
    debateStore.setProject(projectForStore)

    // 如果没有环节，提示用户
    if (!debateStore.stages.length) {
      toast.add({
        title: '该项目暂无环节，请先添加环节',
        color: 'warning',
      })
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ═══════════════════════════════════════════════
// 2. 格式化时间显示（MM:SS）
// ═══════════════════════════════════════════════
function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ═══════════════════════════════════════════════
// 3. 计时器控制
// ═══════════════════════════════════════════════

// 单计时器控制
let timerInterval: ReturnType<typeof setInterval> | null = null

function startTimer() {
  if (debateStore.isRunning) return
  debateStore.startTimer()
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    if (debateStore.currentStageInfo?.type === 'dual-timer') {
      debateStore.tickDualTimer()
    } else {
      debateStore.tick()
    }
    // 检查时间是否归零
    if (debateStore.currentStageInfo?.type === 'dual-timer') {
      const { activeTimer } = debateStore as any
      const remaining =
        (debateStore as any).stageStates?.[debateStore.currentStageInfo.id]?.[
          activeTimer === 'positive' ? 'positiveTime' : 'negativeTime'
        ] ?? 0
      if (remaining <= 0 && timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
      }
    } else {
      if ((debateStore as any).timeRemaining <= 0 && timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
      }
    }
  }, 1000)
}

function pauseTimer() {
  debateStore.pauseTimer()
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function resetTimer() {
  pauseTimer()
  debateStore.resetTimer()
}

// 双计时器控制
function switchActiveTimer() {
  pauseTimer()
  debateStore.switchDualTimer()
}

function startPositiveTimer() {
  pauseTimer()
  debateStore.startPositiveTimer()
  startTimer()
}

function startNegativeTimer() {
  pauseTimer()
  debateStore.startNegativeTimer()
  startTimer()
}

// 环节切换
function goToStage(idx: number) {
  pauseTimer()
  debateStore.currentStage = idx + 1
}

// ═══════════════════════════════════════════════
// 4. 键盘快捷键
// ═══════════════════════════════════════════════
function handleKeyPress(event: KeyboardEvent) {
  // 忽略输入框中的按键
  const target = event.target as HTMLElement
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  ) {
    return
  }

  switch (event.key) {
    case ' ':
      // 空格：开始/暂停计时
      event.preventDefault()
      if (debateStore.currentStageInfo?.type === 'dual-timer') {
        // 双计时模式：第一次按启动，再按切换
        if (!debateStore.isRunning) startTimer()
        else switchActiveTimer()
      } else {
        // 单计时模式：启动/暂停
        if (debateStore.isRunning) pauseTimer()
        else startTimer()
      }
      break

    case 'ArrowLeft':
      // 左箭头：上一环节
      event.preventDefault()
      if (debateStore.currentStage > 1) {
        pauseTimer()
        debateStore.previousStage()
      }
      break

    case 'ArrowRight':
      // 右箭头：下一环节
      event.preventDefault()
      if (debateStore.currentStage < debateStore.stages.length) {
        pauseTimer()
        debateStore.nextStage()
      }
      break

    case 'p':
    case 'P':
      // P：中断/暂停
      if (debateStore.isRunning) pauseTimer()
      break

    case ',':
    case '，':
      // 逗号：启动反方（双计时器模式）
      if (debateStore.currentStageInfo?.type === 'dual-timer') {
        startNegativeTimer()
      }
      break

    case '.':
    case '。':
      // 句号：启动正方（双计时器模式）
      if (debateStore.currentStageInfo?.type === 'dual-timer') {
        startPositiveTimer()
      }
      break

    case 'q':
    case 'Q':
      // Q：播放30秒提示音
      debateStore.playTestSound('30')
      break

    case 'w':
    case 'W':
      // W：播放5秒提示音
      debateStore.playTestSound('5')
      break

    case 'e':
    case 'E':
      // E：播放时间到提示音
      debateStore.playTestSound('End')
      break

    case 'Tab':
      // Tab：显示环节进度
      event.preventDefault()
      showProgress.value = !showProgress.value
      break
  }
}

// ═══════════════════════════════════════════════
// 5. 自定义时间设置
// ═══════════════════════════════════════════════

function openTimeModal() {
  if (debateStore.currentStageInfo?.type === 'dual-timer') {
    customPositiveTime.value = debateStore.dualTimer.positiveTime
    customNegativeTime.value = debateStore.dualTimer.negativeTime
  } else {
    customTime.value = (debateStore as any).timeRemaining || 0
  }
  showTimeModal.value = true
}

function applyCustomTime() {
  pauseTimer()
  if (debateStore.currentStageInfo?.type === 'dual-timer') {
    debateStore.setCustomDualTime(
      Number(customPositiveTime.value),
      Number(customNegativeTime.value),
    )
  } else {
    debateStore.setCustomTime(Number(customTime.value))
  }
  showTimeModal.value = false
}

// ═══════════════════════════════════════════════
// 6. 生命周期
// ═══════════════════════════════════════════════

onMounted(async () => {
  await loadProject()
  window.addEventListener('keydown', handleKeyPress)
})

onUnmounted(() => {
  pauseTimer()
  window.removeEventListener('keydown', handleKeyPress)
})

// 计算属性：当前环节信息
const currentStage = computed(() => debateStore.currentStage)
const currentStageInfo = computed(() => debateStore.currentStageInfo)
const isDualTimer = computed(() => currentStageInfo.value?.type === 'dual-timer')
const isSpecial = computed(() => currentStageInfo.value?.type === 'special')

// 双计时器状态
const dualTimer = computed(() => debateStore.dualTimer)
const activeTimer = computed(() => dualTimer.value.activeTimer)

// 单计时器状态
const isRunning = computed(() => debateStore.isRunning)
const timeRemaining = computed(() => (debateStore as any).timeRemaining || 0)
const isTimeWarning = computed(() => {
  const info = currentStageInfo.value
  if (!info || info.type === 'dual-timer') return false
  return (
    timeRemaining.value <= info.duration * 0.2 &&
    timeRemaining.value > info.duration * 0.1
  )
})
const isTimeCritical = computed(() => {
  const info = currentStageInfo.value
  if (!info || info.type === 'dual-timer') return false
  return timeRemaining.value <= info.duration * 0.1
})
</script>

<template>
  <!-- 加载状态 -->
  <div v-if="loading" class="min-h-screen flex items-center justify-center bg-gray-900 text-white">
    <div class="text-center">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin mx-auto mb-3" />
      <p>加载项目...</p>
    </div>
  </div>

  <!-- 主界面 -->
  <div v-else class="min-h-screen text-white overflow-hidden" style="background: radial-gradient(ellipse at center bottom, rgb(57, 76, 86) 0%, rgb(14, 17, 17) 100%);">

    <!-- 顶部横幅：正方/反方 -->
    <div class="w-full" style="padding-top: 4vh;">
      <div class="flex w-full">
        <!-- 正方（左侧，红色） -->
        <div class="flex-1 flex items-center" style="background-color: rgb(169, 35, 35); padding: 0.6vh 0.8vw;">
          <div class="border border-white rounded-sm px-2 py-1 flex items-center justify-center text-2xl font-bold" style="height: 1.3em; line-height: 1.3; margin-left: 0.5vw; margin-right: 1.5vw;">
            <span class="text-white">正方</span>
          </div>
          <div class="text-white font-bold text-xl" style="font-family: 'SimSun', '宋体', serif;">
            {{ setupForm.positiveTopic || '' }}
          </div>
        </div>
        <!-- 反方（右侧，蓝色） -->
        <div class="flex-1 flex items-center justify-end" style="background-color: rgb(3, 105, 161); padding: 0.6vh 0.8vw;">
          <div class="text-white font-bold text-xl text-right" style="font-family: 'SimSun', '宋体', serif;">
            {{ setupForm.negativeTopic || '' }}
          </div>
          <div class="border border-white rounded-sm px-2 py-1 flex items-center justify-center text-2xl font-bold" style="height: 1.3em; line-height: 1.3; margin-right: 0.5vw; margin-left: 1.5vw;">
            <span class="text-white">反方</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 队伍名称（横幅下方） -->
    <div class="flex w-full items-start justify-between px-4 mt-2">
      <div v-if="setupForm.teamPositiveName" class="text-white" style="font-size: 18px; font-family: 'SimSun', '宋体', serif;">
        {{ setupForm.teamPositiveName }}
      </div>
      <div v-if="setupForm.teamNegativeName" class="text-white text-right" style="font-size: 18px; font-family: 'SimSun', '宋体', serif;">
        {{ setupForm.teamNegativeName }}
      </div>
    </div>

    <!-- 比赛标题 -->
    <div class="text-center mt-4">
      <h1 class="font-bold text-2xl" style="color: rgb(3, 105, 161); font-family: 'SimSun', '宋体', serif;">
        {{ project?.title || '辩论赛' }}
      </h1>
    </div>

    <!-- 主计时器显示区域 -->
    <div class="flex flex-col items-center justify-center" style="padding: 4vh 0;">

      <!-- 当前环节名称 -->
      <div class="text-center mb-6">
        <h2 class="font-bold text-5xl" style="font-family: 'SimSun', '宋体', serif;">
          {{ currentStageInfo?.name || '彩排 · 试音' }}
        </h2>
      </div>

      <!-- 双计时器显示 -->
      <div v-if="isDualTimer" class="flex justify-center items-center gap-16">
        <!-- 正方计时器 -->
        <div class="text-center">
          <div class="mb-3" style="font-family: 'SimSun', '宋体', serif; font-size: 28px; color: rgb(179, 37, 37); font-weight: bold;">
            正方
          </div>
          <div style="font-family: 'Digiface', monospace; font-size: 180px; line-height: 1; color: rgb(179, 37, 37); font-weight: normal;">
            {{ formatTime(dualTimer.positiveTime) }}
          </div>
        </div>
        <!-- 反方计时器 -->
        <div class="text-center">
          <div class="mb-3" style="font-family: 'SimSun', '宋体', serif; font-size: 28px; color: rgb(3, 105, 161); font-weight: bold;">
            反方
          </div>
          <div style="font-family: 'Digiface', monospace; font-size: 180px; line-height: 1; color: rgb(3, 105, 161); font-weight: normal;">
            {{ formatTime(dualTimer.negativeTime) }}
          </div>
        </div>
      </div>

      <!-- 单计时器显示 -->
      <div v-else-if="!isSpecial" class="text-center">
        <div
          style="font-family: 'Digiface', monospace; font-size: 200px; line-height: 1; font-weight: normal;"
          :class="{
            'text-orange-400': isTimeWarning,
            'text-red-400': isTimeCritical,
            'text-white': !isTimeWarning && !isTimeCritical,
          }"
        >
          {{ formatTime(timeRemaining) }}
        </div>
      </div>

      <!-- 特殊环节（无计时）：显示大字 -->
      <div v-else class="text-center">
        <div style="font-family: 'SimSun', '宋体', serif; font-size: 120px; line-height: 1.2; color: white; font-weight: bold;">
          {{ currentStageInfo?.name || '' }}
        </div>
      </div>
    </div>

    <!-- 控制面板（左下角） -->
    <div class="fixed bottom-4 left-4 flex flex-col items-start timing-panel">

      <div>
        <span class="label-text text-gray-400">环节:</span>
        <div class="button-group">
          <button
            class="timing-btn"
            :disabled="currentStage <= 1"
            @click="() => { pauseTimer(); debateStore.previousStage() }"
          >
            ← 上一环节
          </button>
          <span class="text-gray-300 text-xs text-center min-w-[60px]">
            {{ currentStage }} / {{ debateStore.stages.length }}
          </span>
          <button
            class="timing-btn"
            :disabled="currentStage >= debateStore.stages.length"
            @click="() => { pauseTimer(); debateStore.nextStage() }"
          >
            下一环节 →
          </button>
        </div>
      </div>

      <!-- 计时控制（单计时器） -->
      <div v-if="!isDualTimer && !isSpecial">
        <span class="label-text text-gray-400">计时:</span>
        <div class="button-group">
          <button
            class="timing-btn"
            :disabled="!currentStageInfo"
            @click="isRunning ? pauseTimer() : startTimer()"
          >
            {{ isRunning ? '暂停' : '启动' }}
          </button>
          <button
            class="timing-btn"
            @click="resetTimer"
          >
            重置
          </button>
          <button
            class="timing-btn"
            @click="openTimeModal"
          >
            设置时间
          </button>
        </div>
      </div>

      <!-- 计时控制（双计时器） -->
      <div v-else-if="isDualTimer" class="space-y-2">
        <div>
          <span class="label-text text-gray-400">计时:</span>
          <div class="button-group">
            <button
              class="timing-btn"
              @click="() => { isRunning ? pauseTimer() : startTimer() }"
            >
              {{ isRunning ? '暂停' : '启动' }}
            </button>
            <button
              class="timing-btn"
              @click="switchActiveTimer"
            >
              切换方
            </button>
            <button
              class="timing-btn"
              @click="resetTimer"
            >
              重置
            </button>
            <button
              class="timing-btn"
              @click="openTimeModal"
            >
              设时
            </button>
          </div>
        </div>
        <div>
          <span class="label-text text-gray-400">直接启动:</span>
          <div class="button-group">
            <button
              class="timing-btn timing-btn-red"
              @click="startPositiveTimer"
            >
              正方
            </button>
            <button
              class="timing-btn timing-btn-blue"
              @click="startNegativeTimer"
            >
              反方
            </button>
          </div>
        </div>
      </div>

      <!-- 试音控制 -->
      <div>
        <span class="label-text text-gray-400">试音:</span>
        <div class="button-group">
          <button
            class="timing-btn"
            @click="() => debateStore.playTestSound('30')"
          >
            30秒
          </button>
          <button
            class="timing-btn"
            @click="() => debateStore.playTestSound('5')"
          >
            5秒
          </button>
          <button
            class="timing-btn"
            @click="() => debateStore.playTestSound('End')"
          >
            时间到
          </button>
        </div>
      </div>

      <!-- 其他功能 -->
      <div>
        <span class="label-text text-gray-400">其他:</span>
        <div class="button-group">
          <button
            class="timing-btn"
          >
            登记赛果
          </button>
          <button
            class="timing-btn"
            @click="showSetupModal = true"
          >
            设置
          </button>
          <button
            class="timing-btn"
            @click="showProgress = true"
          >
            进度
          </button>
          <NuxtLink :to="'/timer/projects'" class="timing-btn">
            返回
          </NuxtLink>
        </div>
        <NUseHead>
          <title>
            {{ debateStore.currentDebate?.title || '辩论赛计时' }}
          </title>
        </NUseHead>
      </div>
    </div>

    <!-- 左下角快捷键提示 -->
    <div class="fixed bottom-6 left-6 bg-black/50 rounded px-3 py-2 border border-gray-700 text-xs">
      <div class="font-bold text-gray-300 mb-1">快捷键</div>
      <div class="space-y-0.5 text-gray-400">
        <div><kbd class="px-1 bg-gray-700 rounded">空格</kbd> 启动/暂停/切换</div>
        <div><kbd class="px-1 bg-gray-700 rounded">←</kbd> <kbd class="px-1 bg-gray-700 rounded">→</kbd> 切换环节</div>
        <div><kbd class="px-1 bg-gray-700 rounded">,</kbd> 反方 <kbd class="px-1 bg-gray-700 rounded">.</kbd> 正方</div>
        <div><kbd class="px-1 bg-gray-700 rounded">Q</kbd> 30秒 <kbd class="px-1 bg-gray-700 rounded">W</kbd> 5秒 <kbd class="px-1 bg-gray-700 rounded">E</kbd> 时间到</div>
        <div><kbd class="px-1 bg-gray-700 rounded">Tab</kbd> 进度</div>
      </div>
    </div>

    <!-- 赛前设置弹窗 -->
    <UModal v-model="showSetupModal">
      <div class="p-6 max-w-lg space-y-4 text-gray-800">
        <h3 class="text-lg font-bold">比赛设置</h3>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-700">正方队伍名称</label>
          <input
            v-model="setupForm.teamPositiveName"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
            placeholder="例：北京大学辩论队"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-700">反方队伍名称</label>
          <input
            v-model="setupForm.teamNegativeName"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
            placeholder="例：清华大学辩论队"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-700">正方辩题</label>
          <input
            v-model="setupForm.positiveTopic"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
            placeholder="例：顺境更有利于人的成长"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-700">反方辩题</label>
          <input
            v-model="setupForm.negativeTopic"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
            placeholder="例：逆境更有利于人的成长"
          />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200" @click="showSetupModal = false">
            关闭
          </button>
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            @click="showSetupModal = false"
          >
            应用
          </button>
        </div>
      </div>
    </UModal>

    <!-- 时间设置弹窗 -->
    <UModal v-model="showTimeModal">
      <div class="p-6 max-w-sm space-y-4 text-gray-800">
        <h3 class="text-lg font-bold">设置时间</h3>

        <div v-if="isDualTimer" class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-700">正方时间(秒):</label>
            <input
              type="number"
              v-model.number="customPositiveTime"
              class="w-20 px-2 py-1 border border-gray-300 rounded text-right"
              min="0"
              max="3600"
            />
          </div>
          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-700">反方时间(秒):</label>
            <input
              type="number"
              v-model.number="customNegativeTime"
              class="w-20 px-2 py-1 border border-gray-300 rounded text-right"
              min="0"
              max="3600"
            />
          </div>
        </div>

        <div v-else>
          <label class="block text-sm font-medium mb-1">时间(秒):</label>
          <input
            type="number"
            v-model.number="customTime"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
            min="0"
            max="3600"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200" @click="showTimeModal = false">
            取消
          </button>
          <button
            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            @click="applyCustomTime"
          >
            应用
          </button>
        </div>
      </div>
    </UModal>

    <!-- 环节进度弹窗 -->
    <UModal v-model="showProgress">
      <div class="p-6 max-w-3xl space-y-4 text-gray-800">
        <h3 class="text-lg font-bold">环节进度</h3>

        <div v-if="!debateStore.stages.length" class="text-center text-gray-500 py-8">
          暂无环节数据
        </div>

        <div v-else class="grid grid-cols-3 gap-2">
          <button
            v-for="(stage, idx) in debateStore.stages"
            :key="stage.id"
            class="text-left px-4 py-3 border rounded transition"
            :class="{
              'bg-blue-600 text-white border-blue-600': currentStage === idx + 1,
              'bg-gray-100 border-gray-300 hover:bg-gray-200': currentStage !== idx + 1,
            }"
            @click="() => { goToStage(idx); showProgress = false }"
          >
            <div class="font-bold text-sm">{{ idx + 1 }}. {{ stage.name }}</div>
            <div class="text-xs opacity-80 mt-1">
              <span v-if="stage.type === 'dual-timer'">
                双计时 {{ stage.positiveDuration || stage.duration }}s / {{ stage.negativeDuration || stage.duration }}s
              </span>
              <span v-else-if="stage.type === 'special'">
                无计时
              </span>
              <span v-else>
                单计时 {{ stage.duration }}s
              </span>
            </div>
          </button>
        </div>

        <div class="flex justify-end pt-2">
          <button class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200" @click="showProgress = false">
            关闭
          </button>
        </div>
      </div>
    </UModal>
  </div>
</template>

<style scoped>
/* ═══════════ 控制面板：左下角，均匀分布 ═══════════ */
.timing-panel {
  opacity: 0.15;
  transition: opacity 0.3s ease-in-out;
  min-width: 12vw; /* 再缩窄一倍 */
}
.timing-panel:hover { opacity: 1; }

/* 每一行：flex + 全宽 + 居中对齐 */
.timing-panel > div {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 0.2vw;
}

/* 标签：固定最小宽度，不缩小 */
.timing-panel .label-text {
  font-size: 0.875rem;
  min-width: 2vw; /* 标签再缩窄 */
  flex-shrink: 0;
  text-align: left;
}

/* 按钮组：占据剩余空间，均匀分布 */
.timing-panel .button-group {
  display: flex;
  align-items: center;
  gap: 0.15vw; /* 按钮间距缩小 */
  flex: 1;
}

/* 按钮：均分宽度，圆角更圆润 */
.timing-panel .timing-btn {
  padding: 0.2vw 0.4vw; /* padding 再缩小 */
  border: 2px solid #6b7280;
  border-radius: 0.3vw; /* 圆角缩小 */
  font-size: 0.75rem; /* 字号略缩小 */
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex: 1;
  min-width: 2.5vw; /* 最小宽度再缩小 */
  text-align: center;
  background: transparent;
  color: #f3f4f6;
  text-decoration: none;
}
.timing-panel .timing-btn:hover {
  border-color: #9ca3af;
  background: rgba(255, 255, 255, 0.05);
}
.timing-panel .timing-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 红色按钮（正方） */
.timing-panel .timing-btn-red {
  border-color: #ef4444;
  color: #f87171;
}
.timing-panel .timing-btn-red:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* 蓝色按钮（反方） */
.timing-panel .timing-btn-blue {
  border-color: #3b82f6;
  color: #60a5fa;
}
.timing-panel .timing-btn-blue:hover {
  background: rgba(59, 130, 246, 0.1);
}
</style>
