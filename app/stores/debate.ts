import { defineStore } from 'pinia'

// ============ 类型定义 ============

/** 单计时器环节的状态 */
interface SingleTimerState {
  type: 'speech' | 'question' | 'summary' | 'special'
  timeRemaining: number
  isRunning: boolean
  isPaused: boolean
}

/** 双计时器环节的状态（对辩、自由辩论等） */
interface DualTimerState {
  type: 'dual-timer'
  positiveTime: number
  negativeTime: number
  activeTimer: 'positive' | 'negative'
  isRunning: boolean
  isPaused: boolean
}

type StageState = SingleTimerState | DualTimerState

/** 辩论环节的完整定义 */
export interface DebateStage {
  id: number
  name: string
  duration: number        // 主时长（秒）
  type: string            // 'speech' | 'question' | 'summary' | 'special' | 'dual-timer'
  description?: string
  allowedRoles?: string[]
  order?: number          // 排序顺序
  // 双计时器可选的独立时长
  positiveDuration?: number
  negativeDuration?: number
}

/** 辩论项目的全局配置 */
export interface DebateProject {
  id: number
  name: string
  title: string          // 比赛标题（如"三社联合辩论赛"）
  positiveTopic?: string // 正方辩题
  negativeTopic?: string // 反方辩题
  teamPositiveName?: string
  teamNegativeName?: string
  stages: DebateStage[]
  // UI 配置（可选的视觉自定义）
  ui?: {
    bannerVisible?: boolean
    eventNameVisible?: boolean
    bannerColorPos?: string
    bannerColorNeg?: string
    bannerFontColorPos?: string
    bannerFontColorNeg?: string
    eventColor?: string
    eventFontSize?: number
    bannerFontSize?: number
    bannerPos?: number
    eventPosY?: number
    // 正反方用词（可自定义为"甲方/乙方"等）
    positiveLabel?: string
    negativeLabel?: string
    backgroundType?: 'default' | 'image'
    imageFileName?: string
  }
}

/** Store 的完整状态 */
interface DebateState {
  currentStage: number                 // 当前环节（从1开始）
  stages: DebateStage[]                // 所有环节定义
  stageStates: Record<number, StageState> // 各环节的运行状态
  completedStages: number[]            // 已完成的环节
  project: DebateProject | null        // 当前项目
}

// ============ 辅助函数 ============

/** 基于给定的项目环节生成初始运行状态 */
function generateInitialStatesFrom(stages: DebateStage[]): Record<number, StageState> {
  const states: Record<number, StageState> = {}
  stages.forEach((stage) => {
    if (stage.type === 'dual-timer') {
      states[stage.id] = {
        type: 'dual-timer',
        positiveTime: stage.positiveDuration ?? stage.duration,
        negativeTime: stage.negativeDuration ?? stage.duration,
        activeTimer: 'positive',
        isRunning: false,
        isPaused: false,
      }
    } else {
      states[stage.id] = {
        type: stage.type as any,
        timeRemaining: stage.duration,
        isRunning: false,
        isPaused: false,
      }
    }
  })
  return states
}

// ============ Store 定义 ============

export const useDebateStore = defineStore('debate', {
  state: (): DebateState => ({
    currentStage: 1,
    stages: [],
    stageStates: {},
    completedStages: [],
    project: null,
  }),

  getters: {
    /** 获取当前环节的定义信息 */
    currentStageInfo(state): DebateStage | null {
      const index = state.currentStage - 1
      return state.stages[index] || null
    },

    /** 获取当前环节的运行状态 */
    currentStageState(state): StageState | null {
      const stage = state.stages[state.currentStage - 1]
      return stage ? state.stageStates[stage.id] || null : null
    },

    /** 当前环节是否正在计时 */
    isRunning(): boolean {
      return this.currentStageState?.isRunning ?? false
    },

    /** 当前环节是否已暂停 */
    isPaused(): boolean {
      return this.currentStageState?.isPaused ?? false
    },

    /** 单计时器：剩余时间 */
    timeRemaining(): number {
      const state = this.currentStageState
      if (state && state.type !== 'dual-timer') {
        return (state as SingleTimerState).timeRemaining
      }
      return 0
    },

    /** 双计时器状态 */
    dualTimer(): DualTimerState {
      const stage = this.stages[this.currentStage - 1]
      const s = stage ? this.stageStates[stage.id] : null
      if (s && s.type === 'dual-timer') return s as DualTimerState
      return {
        type: 'dual-timer',
        positiveTime: 0,
        negativeTime: 0,
        activeTimer: 'positive',
        isRunning: false,
        isPaused: false,
      }
    },

    /** 格式化剩余时间 (mm:ss) */
    formattedTime(): string {
      const minutes = Math.floor(this.timeRemaining / 60)
      const seconds = this.timeRemaining % 60
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    },

    /** 是否为时间警告阶段（剩余20%-10%） */
    isTimeWarning(): boolean {
      const info = this.currentStageInfo
      if (!info || info.type === 'dual-timer') return false
      return (
        this.timeRemaining <= info.duration * 0.2 &&
        this.timeRemaining > info.duration * 0.1
      )
    },

    /** 是否为时间危急阶段（剩余10%以内） */
    isTimeCritical(): boolean {
      const info = this.currentStageInfo
      if (!info || info.type === 'dual-timer') return false
      return this.timeRemaining <= info.duration * 0.1
    },
  },

  actions: {
    // ============ 项目与环节管理 ============

    /** 设置项目数据和环节 */
    setProject(project: DebateProject) {
      this.project = project
      this.setStages(project.stages || [])
    },

    /** 设置环节（并初始化每个环节的计时状态） */
    setStages(newStages: DebateStage[]) {
      if (!Array.isArray(newStages) || newStages.length === 0) return
      // 按 order 排序，若无 order 则按 id 排序
      const sorted = [...newStages].sort(
        (a, b) => (a.order ?? a.id) - (b.order ?? b.id),
      )
      this.stages = sorted

      // 为所有环节构建初始状态
      const initialStates = generateInitialStatesFrom(sorted)
      for (const s of sorted) {
        this.stageStates[s.id] = JSON.parse(
          JSON.stringify(initialStates[s.id]),
        )
      }

      // 清理已不存在的状态和完成列表
      Object.keys(this.stageStates).forEach((k) => {
        const id = Number(k)
        if (!sorted.some((s) => s.id === id)) delete this.stageStates[id]
      })
      this.completedStages = this.completedStages.filter((id) =>
        sorted.some((s) => s.id === id),
      )

      // 校正当前环节
      if (this.currentStage > sorted.length) this.currentStage = sorted.length
      if (this.currentStage < 1) this.currentStage = 1
    },

    /** 确保所有环节都有状态（在运行时按需补齐） */
    ensureStagesUpToDate() {
      this.stages.forEach((s) => {
        if (!this.stageStates[s.id]) {
          if (s.type === 'dual-timer') {
            this.stageStates[s.id] = {
              type: 'dual-timer',
              positiveTime: s.positiveDuration ?? s.duration,
              negativeTime: s.negativeDuration ?? s.duration,
              activeTimer: 'positive',
              isRunning: false,
              isPaused: false,
            }
          } else {
            this.stageStates[s.id] = {
              type: s.type as any,
              timeRemaining: s.duration,
              isRunning: false,
              isPaused: false,
            }
          }
        }
      })
      // 清理已不存在的状态
      Object.keys(this.stageStates).forEach((k) => {
        const id = Number(k)
        if (!this.stages.some((s) => s.id === id)) delete this.stageStates[id]
      })
      this.completedStages = this.completedStages.filter((id) =>
        this.stages.some((s) => s.id === id),
      )
    },

    // ============ 环节切换 ============

    /** 跳转到指定环节（1-based index） */
    goToStage(target: number) {
      this.ensureStagesUpToDate()
      const max = this.stages.length
      if (!Number.isFinite(target)) return
      if (target < 1) target = 1
      if (target > max) target = max
      if (target === this.currentStage) return
      this.currentStage = target
    },

    /** 进入下一环节 */
    nextStage() {
      this.ensureStagesUpToDate()
      if (this.currentStage < this.stages.length) {
        this.completeCurrentStage()
        this.currentStage++
        // 确保新增环节的状态已按项目数据初始化
        const currentStageInfo = this.stages[this.currentStage - 1]
        if (currentStageInfo && !this.stageStates[currentStageInfo.id]) {
          const initialStates = generateInitialStatesFrom(this.stages)
          if (initialStates[currentStageInfo.id]) {
            this.stageStates[currentStageInfo.id] = JSON.parse(
              JSON.stringify(initialStates[currentStageInfo.id]),
            )
          }
        }
      }
    },

    /** 返回上一环节 */
    previousStage() {
      this.ensureStagesUpToDate()
      if (this.currentStage > 1) {
        this.currentStage--
        const currentStageInfo = this.stages[this.currentStage - 1]
        if (currentStageInfo && !this.stageStates[currentStageInfo.id]) {
          const initialStates = generateInitialStatesFrom(this.stages)
          if (initialStates[currentStageInfo.id]) {
            this.stageStates[currentStageInfo.id] = JSON.parse(
              JSON.stringify(initialStates[currentStageInfo.id]),
            )
          }
        }
        // 从完成列表中移除该环节
        this.completedStages = this.completedStages.filter(
          (id) => id !== currentStageInfo?.id,
        )
      }
    },

    /** 标记当前环节为已完成 */
    completeCurrentStage() {
      const info = this.stages[this.currentStage - 1]
      if (info && !this.completedStages.includes(info.id)) {
        this.completedStages.push(info.id)
      }
    },

    // ============ 单计时器控制 ============

    /** 开始计时 */
    startTimer() {
      const state = this.currentStageState
      if (!state) return
      state.isRunning = true
      state.isPaused = false
    },

    /** 暂停计时 */
    pauseTimer() {
      const state = this.currentStageState
      if (!state) return
      state.isRunning = false
      state.isPaused = true
    },

    /** 重置计时器（恢复到环节初始时长） */
    resetTimer() {
      const info = this.currentStageInfo
      const state = this.currentStageState
      if (!state || !info) return
      if (state.type === 'dual-timer') {
        // 双计时器兼容处理
        ;(state as DualTimerState).positiveTime =
          info.positiveDuration ?? info.duration
        ;(state as DualTimerState).negativeTime =
          info.negativeDuration ?? info.duration
        ;(state as DualTimerState).activeTimer = 'positive'
        state.isRunning = false
        state.isPaused = false
      } else {
        ;(state as SingleTimerState).timeRemaining = info.duration
        state.isRunning = false
        state.isPaused = false
      }
    },

    /** 设置自定义时间（单计时器） */
    setCustomTime(seconds: number) {
      const state = this.currentStageState
      if (state && state.type !== 'dual-timer') {
        ;(state as SingleTimerState).timeRemaining = seconds
        state.isRunning = false
        state.isPaused = false
      }
    },

    /** 设置自定义时间（双计时器） */
    setCustomDualTime(positiveTime: number, negativeTime: number) {
      const state = this.currentStageState
      if (state && state.type === 'dual-timer') {
        ;(state as DualTimerState).positiveTime = positiveTime
        ;(state as DualTimerState).negativeTime = negativeTime
        state.isRunning = false
        state.isPaused = false
      }
    },

    /** 单计时器每秒递减 */
    tick() {
      const state = this.currentStageState
      if (!state || !state.isRunning || state.type === 'dual-timer') return
      const s = state as SingleTimerState
      if (s.timeRemaining > 0) {
        s.timeRemaining--
        this.playTimerSound(s.timeRemaining)
      }
      if (s.timeRemaining === 0) {
        s.isRunning = false
        this.completeCurrentStage()
      }
    },

    // ============ 双计时器控制 ============

    /** 双计时器每秒递减 */
    tickDualTimer() {
      const state = this.currentStageState
      if (!state || !state.isRunning || state.type !== 'dual-timer') return
      const s = state as DualTimerState

      if (s.activeTimer === 'positive' && s.positiveTime > 0) {
        s.positiveTime--
        this.playTimerSound(s.positiveTime)
      } else if (s.activeTimer === 'negative' && s.negativeTime > 0) {
        s.negativeTime--
        this.playTimerSound(s.negativeTime)
      }
    },

    /** 开始双计时 */
    startDualTimer() {
      const state = this.currentStageState
      if (state && state.type === 'dual-timer') {
        const s = state as DualTimerState
        if (s.positiveTime > 0 || s.negativeTime > 0) {
          // 若当前侧已耗尽，自动切到有剩余的一侧
          if (s.activeTimer === 'positive' && s.positiveTime === 0 && s.negativeTime > 0) {
            s.activeTimer = 'negative'
          } else if (s.activeTimer === 'negative' && s.negativeTime === 0 && s.positiveTime > 0) {
            s.activeTimer = 'positive'
          }
          s.isRunning = true
          s.isPaused = false
        }
      }
    },

    /** 暂停双计时 */
    pauseDualTimer() {
      const state = this.currentStageState
      if (state && state.type === 'dual-timer') {
        state.isRunning = false
        state.isPaused = true
      }
    },

    /** 切换双计时器的激活侧 */
    switchDualTimer() {
      const state = this.currentStageState
      if (state && state.type === 'dual-timer') {
        const s = state as DualTimerState
        const next = s.activeTimer === 'positive' ? 'negative' : 'positive'
        const nextHas =
          next === 'positive' ? s.positiveTime > 0 : s.negativeTime > 0
        const currHas =
          s.activeTimer === 'positive' ? s.positiveTime > 0 : s.negativeTime > 0

        if (nextHas) {
          s.activeTimer = next
          s.isRunning = true
          s.isPaused = false
        } else if (currHas) {
          // 保持在当前侧继续计时
          s.isRunning = true
          s.isPaused = false
        } else {
          // 双方均耗尽
          s.isRunning = false
          s.isPaused = true
        }
      }
    },

    /** 直接激活正方计时 */
    startPositiveTimer() {
      const state = this.currentStageState
      if (state && state.type === 'dual-timer') {
        const s = state as DualTimerState
        s.activeTimer = 'positive'
        s.isRunning = true
        s.isPaused = false
      }
    },

    /** 直接激活反方计时 */
    startNegativeTimer() {
      const state = this.currentStageState
      if (state && state.type === 'dual-timer') {
        const s = state as DualTimerState
        s.activeTimer = 'negative'
        s.isRunning = true
        s.isPaused = false
      }
    },

    /** 重置指定侧或两侧的双计时器 */
    resetDualTimer(type: 'positive' | 'negative' | 'both' = 'both') {
      const info = this.currentStageInfo
      const state = this.currentStageState
      if (!state || state.type !== 'dual-timer' || !info) return
      const s = state as DualTimerState
      const initialPositive = info.positiveDuration ?? info.duration
      const initialNegative = info.negativeDuration ?? info.duration

      if (type === 'both') {
        s.positiveTime = initialPositive
        s.negativeTime = initialNegative
        s.isRunning = false
        s.isPaused = false
        s.activeTimer = 'positive'
      } else if (type === 'positive') {
        s.positiveTime = initialPositive
      } else if (type === 'negative') {
        s.negativeTime = initialNegative
      }
    },

    // ============ 音效播放 ============

    /** 播放提示音（剩余30秒、5秒、0秒） */
    playTimerSound(timeRemaining: number) {
      try {
        let audioFile = ''
        if (timeRemaining === 30) audioFile = '/30.mp3'
        else if (timeRemaining === 5) audioFile = '/5.mp3'
        else if (timeRemaining === 0) audioFile = '/End.mp3'

        if (audioFile) {
          const audio = new Audio(audioFile)
          audio.play().catch(() => {
            /* 浏览器自动播放策略可能阻止，忽略 */
          })
        }
      } catch (e) {
        // 静默失败，不影响计时
      }
    },

    /** 手动播放测试音效 */
    playTestSound(type: '30' | '5' | 'End') {
      try {
        const audio = new Audio(`/${type}.mp3`)
        audio.play().catch(() => {})
      } catch {}
    },

    // ============ 完整重置 ============

    /** 重置整个比赛 */
    resetAll() {
      this.currentStage = 1
      const initialStates = generateInitialStatesFrom(this.stages)
      for (const s of this.stages) {
        this.stageStates[s.id] = JSON.parse(
          JSON.stringify(initialStates[s.id]),
        )
      }
      this.completedStages = []
    },
  },
})
