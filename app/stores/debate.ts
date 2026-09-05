/**
 * debate store —— 辩论计时器核心状态管理（Pinia）
 * 维护辩论项目的环节定义、各环节计时状态（单计时器/双计时器）、当前环节、已完成环节等。
 * 提供环节切换、计时控制（开始/暂停/重置/递减）、音效提示、时间警告/危急判定等能力。
 *
 * 计时引擎说明（性能/精度优化）：
 * - 不再用 `timeRemaining--` 逐秒递减，而是采用「时间戳锚定」模型：
 *   开始计时时记录 endAt = Date.now() + 剩余秒*1000，心跳每 250ms 用
 *   remaining = max(0, round((endAt - Date.now())/1000)) 计算剩余时间。
 * - 这样后台标签页被浏览器节流时计时不会漂移（按真实墙钟修正），且每帧只做廉价计算。
 * - 心跳循环由 store 统一管理（单一 setInterval），页面不再各自持有 timerInterval。
 */
import { defineStore } from 'pinia'

// ============ 类型定义 ============

/** 单计时器环节的状态 */
interface SingleTimerState {
  type: 'speech' | 'question' | 'summary' | 'special'
  timeRemaining: number
  isRunning: boolean
  isPaused: boolean
  /** 倒计时锚点（ms 时间戳，到达此值即剩余 0）；null 表示未运行/已暂停 */
  endAt: number | null
}

/** 双计时器环节的状态（对辩、自由辩论等） */
interface DualTimerState {
  type: 'dual-timer'
  positiveTime: number
  negativeTime: number
  activeTimer: 'positive' | 'negative'
  isRunning: boolean
  isPaused: boolean
  /** 当前 activeTimer 一侧的锚点（ms 时间戳）；null 表示未运行/已暂停 */
  endAt: number | null
}

type StageState = SingleTimerState | DualTimerState

/** 辩论环节的完整定义 */
export interface DebateStage {
  id: number
  name: string
  duration: number // 主时长（秒）
  type: string // 环节类型，统一用新枚举值（normalizeStageType 映射后）
  description?: string
  allowedRoles?: string[]
  order?: number // 排序顺序
  // 双计时器可选的独立时长
  positiveDuration?: number
  negativeDuration?: number
  // 角色字段
  speaker?: string
  questioner?: string
  responder?: string
  responders?: string[] // 单方发问接受人（多选）
  firstSpeaker?: string
  protectionTime?: number
  // 对辩双方参与辩手（多选）
  positiveSpeakers?: string[]
  negativeSpeakers?: string[]
  // 单方发问拆分时长
  questionDuration?: number
  answerDuration?: number
  // 无计时器环节的可发言角色（multi-select，角色 label 列表，用于发言权限联动）
  speakers?: string[]
  // PPT/图片展示环节：上传到 /uploads/images/ 的相对路径（纯播报不计时）
  pptImage?: string
  // 启用开关
  enabled?: boolean
}

/** 辩论项目的全局配置 */
export interface DebateProject {
  id: number
  name: string
  title: string // 比赛标题（如"三社联合辩论赛"）
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

/** 提示音配置（来自赛事/独立赛的 timer-config.audioConfig） */
export interface TimerAudioConfig {
  enabled?: boolean
  /** 声音方案：default=默认提示音(30/5/0)；formal=正式比赛提示音·钉钉响铃(30/0，5秒不响) */
  scheme?: 'default' | 'formal'
  /** 剩余 30 秒 自定义音，缺省回退内置音 */
  warningSound?: string
  /** 剩余 5 秒 自定义音，缺省回退内置音（formal 方案下不播放） */
  finalWarningSound?: string
  /** 时间到（剩余 0 秒）自定义音，缺省回退内置音 */
  timeUpSound?: string
}

/** Store 的完整状态 */
interface DebateState {
  currentStage: number // 当前环节（从1开始）
  stages: DebateStage[] // 所有环节定义
  stageStates: Record<number, StageState> // 各环节的运行状态
  completedStages: number[] // 已完成的环节
  project: DebateProject | null // 当前项目
  audioConfig: TimerAudioConfig | null // 当前提示音配置（含声音方案）
}

// ============ 辅助函数 ============

// 音频对象缓存：避免每次播放都 new Audio()，减少 GC 压力
const audioCache: Record<string, HTMLAudioElement> = {}

/** 获取（或创建）缓存的 Audio 对象，复用已加载的音频资源 */
function getCachedAudio(file: string): HTMLAudioElement {
  if (!audioCache[file]) {
    audioCache[file] = typeof Audio !== 'undefined' ? new Audio(file) : (null as any)
  }
  // ponytail: 上面 if 已保证缓存中存在，非空断言
  return audioCache[file]!
}

/** 基于给定的项目环节生成初始运行状态 */
function generateInitialStatesFrom(stages: DebateStage[]): Record<number, StageState> {
  const states: Record<number, StageState> = {}
  stages.forEach((stage) => {
    if (isDualTimer(stage.type)) {
      states[stage.id] = {
        type: 'dual-timer',
        positiveTime: stage.positiveDuration ?? stage.duration,
        negativeTime: stage.negativeDuration ?? stage.duration,
        activeTimer: 'positive',
        isRunning: false,
        isPaused: false,
        endAt: null,
      }
    } else {
      states[stage.id] = {
        type: stage.type as any,
        timeRemaining: stage.duration,
        isRunning: false,
        isPaused: false,
        endAt: null,
      }
    }
  })
  return states
}

// ============ 计时心跳引擎（store 层，单一循环） ============
// 由 start* 动作启动，所有运行中环节共用一个 250ms 心跳。
// 性能优化：
//   1. 缓存 store 引用，避免每帧重复调用 useDebateStore()
//   2. 只在整秒变化时才更新响应式状态（减少 Vue 重渲染次数）
let loopHandle: ReturnType<typeof setInterval> | null = null
// 缓存 store 引用（首次调用时初始化，后续直接复用）
let cachedStore: any = null
// 提示音穿越检测用的「上一帧剩余秒」快照（按侧记录）
let prevSingle: number | null = null
let prevPos: number | null = null
let prevNeg: number | null = null
// 上一次写入响应式状态的整秒值（避免每250ms都触发重渲染）
let lastWrittenSingle: number | null = null
let lastWrittenPos: number | null = null
let lastWrittenNeg: number | null = null

/** 根据锚点计算当前剩余秒（向上取整到整秒，最小 0） */
function remainingFrom(endAt: number): number {
  return Math.max(0, Math.round((endAt - Date.now()) / 1000))
}

/** 提示音穿越检测：当剩余秒从上方向下穿过 30/5/0 时触发对应音效 */
function fireCues(prev: number | null, remaining: number) {
  if (prev === null) return
  if (prev > 30 && remaining <= 30) cachedStore.playTimerSound(30)
  if (prev > 5 && remaining <= 5) cachedStore.playTimerSound(5)
  if (prev > 0 && remaining <= 0) cachedStore.playTimerSound(0)
}

/** 心跳主循环（模块级，运行时由 store 动作启动） */
function runLoop() {
  // 首次调用时缓存 store 引用
  if (!cachedStore) cachedStore = useDebateStore()
  const store = cachedStore
  const s = store.currentStageState as StageState | null
  // 没有任何在计时的环节 → 停止循环，省电
  if (!s || !s.isRunning || s.endAt == null) {
    stopLoop()
    return
  }
  if (isDualTimer(s.type)) {
    const st = s as DualTimerState
    // endAt 已在上方 isRunning 判断中保证非空
    const remaining = remainingFrom(st.endAt!)
    if (st.activeTimer === 'positive') {
      fireCues(prevPos, remaining)
      prevPos = remaining
      // 只在整秒变化时更新响应式状态，减少重渲染
      if (remaining !== lastWrittenPos) {
        st.positiveTime = remaining
        lastWrittenPos = remaining
      }
    } else {
      fireCues(prevNeg, remaining)
      prevNeg = remaining
      // 只在整秒变化时更新响应式状态
      if (remaining !== lastWrittenNeg) {
        st.negativeTime = remaining
        lastWrittenNeg = remaining
      }
    }
    // 当前激活侧耗尽：冻结（endAt 置空），保留 isRunning 以便空格切换另一侧
    if (remaining <= 0) {
      st.endAt = null
      stopLoop()
    }
  } else {
    const st = s as SingleTimerState
    // endAt 已在上方 isRunning 判断中保证非空
    const remaining = remainingFrom(st.endAt!)
    fireCues(prevSingle, remaining)
    prevSingle = remaining
    // 只在整秒变化时更新响应式状态，减少重渲染（约从4次/秒降到1次/秒）
    if (remaining !== lastWrittenSingle) {
      st.timeRemaining = remaining
      lastWrittenSingle = remaining
    }
    if (remaining <= 0) {
      st.isRunning = false
      st.endAt = null
      store.completeCurrentStage()
      stopLoop()
    }
  }
}

function ensureLoop() {
  if (loopHandle) return
  loopHandle = setInterval(runLoop, 250)
}

function stopLoop() {
  if (loopHandle) {
    clearInterval(loopHandle)
    loopHandle = null
  }
}

// 重置整秒写入缓存（在开始/重置/切换环节时调用，确保首次值被正确写入）
function resetWriteCache() {
  lastWrittenSingle = null
  lastWrittenPos = null
  lastWrittenNeg = null
}

// ============ Store 定义 ============

export const useDebateStore = defineStore('debate', {
  state: (): DebateState => ({
    currentStage: 1,
    stages: [],
    stageStates: {},
    completedStages: [],
    project: null,
    audioConfig: null,
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
      if (s && isDualTimer(s.type)) return s as DualTimerState
      return {
        type: 'dual-timer',
        positiveTime: 0,
        negativeTime: 0,
        activeTimer: 'positive',
        isRunning: false,
        isPaused: false,
        endAt: null,
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
      if (!info || isDualTimer(info.type)) return false
      return this.timeRemaining <= info.duration * 0.2 && this.timeRemaining > info.duration * 0.1
    },

    /** 是否为时间危急阶段（剩余10%以内） */
    isTimeCritical(): boolean {
      const info = this.currentStageInfo
      if (!info || isDualTimer(info.type)) return false
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
      const sorted = [...newStages].sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))
      this.stages = sorted

      // ponytail: 直接赋值，StageState 都是纯数据对象无引用共享风险
      const initialStates = generateInitialStatesFrom(sorted)
      for (const s of sorted) {
        this.stageStates[s.id] = initialStates[s.id]!
      }

      // 清理已不存在的状态和完成列表
      Object.keys(this.stageStates).forEach((k) => {
        const id = Number(k)
        if (!sorted.some((s) => s.id === id)) delete this.stageStates[id]
      })
      this.completedStages = this.completedStages.filter((id) => sorted.some((s) => s.id === id))

      // 校正当前环节
      if (this.currentStage > sorted.length) this.currentStage = sorted.length
      if (this.currentStage < 1) this.currentStage = 1
      resetWriteCache()
    },

    /** 确保所有环节都有状态（在运行时按需补齐） */
    ensureStagesUpToDate() {
      this.stages.forEach((s) => {
        if (!this.stageStates[s.id]) {
          if (isDualTimer(s.type)) {
            this.stageStates[s.id] = {
              type: 'dual-timer',
              positiveTime: s.positiveDuration ?? s.duration,
              negativeTime: s.negativeDuration ?? s.duration,
              activeTimer: 'positive',
              isRunning: false,
              isPaused: false,
              endAt: null,
            }
          } else {
            this.stageStates[s.id] = {
              type: s.type as any,
              timeRemaining: s.duration,
              isRunning: false,
              isPaused: false,
              endAt: null,
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

    /** 停止当前环节计时（切换环节/跳转前调用） */
    stopCurrentTimer() {
      const s = this.currentStageState as StageState | null
      if (s && s.isRunning) {
        s.isRunning = false
        s.isPaused = false
        s.endAt = null
      }
      stopLoop()
      resetWriteCache()
    },

    /** 跳转到指定环节（1-based index） */
    goToStage(target: number) {
      this.stopCurrentTimer()
      const max = this.stages.length
      if (!Number.isFinite(target)) return
      if (target < 1) target = 1
      if (target > max) target = max
      if (target === this.currentStage) return
      this.currentStage = target
    },

    /** 进入下一环节 */
    nextStage() {
      this.stopCurrentTimer()
      if (this.currentStage < this.stages.length) {
        this.completeCurrentStage()
        this.currentStage++
        // 确保新增环节的状态已按项目数据初始化
        const currentStageInfo = this.stages[this.currentStage - 1]
        if (currentStageInfo && !this.stageStates[currentStageInfo.id]) {
          const initialStates = generateInitialStatesFrom(this.stages)
          if (initialStates[currentStageInfo.id]) {
            // ponytail: 直接赋值，无需 JSON 深拷贝
            this.stageStates[currentStageInfo.id] = initialStates[currentStageInfo.id]!
          }
        }
      }
    },

    /** 返回上一环节 */
    previousStage() {
      this.stopCurrentTimer()
      if (this.currentStage > 1) {
        this.currentStage--
        const currentStageInfo = this.stages[this.currentStage - 1]
        if (currentStageInfo && !this.stageStates[currentStageInfo.id]) {
          const initialStates = generateInitialStatesFrom(this.stages)
          if (initialStates[currentStageInfo.id]) {
            // ponytail: 直接赋值，无需 JSON 深拷贝
            this.stageStates[currentStageInfo.id] = initialStates[currentStageInfo.id]!
          }
        }
        // 从完成列表中移除该环节
        this.completedStages = this.completedStages.filter((id) => id !== currentStageInfo?.id)
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

    /** 开始计时（单计时器） */
    startTimer() {
      const s = this.currentStageState as StageState | null
      // 双计时器与无计时器/PPT 环节均不启动单计时（PPT 为纯播报不计时）
      if (!s || isDualTimer(s.type) || !hasTimer(s.type)) return
      const st = s as SingleTimerState
      st.endAt = Date.now() + Math.max(0, st.timeRemaining) * 1000
      st.isRunning = true
      st.isPaused = false
      prevSingle = st.timeRemaining
      resetWriteCache()
      ensureLoop()
    },

    /** 暂停计时（单/双通用） */
    pauseTimer() {
      const s = this.currentStageState as StageState | null
      if (!s) return
      if (s.isRunning && s.endAt != null) {
        const remaining = remainingFrom(s.endAt)
        if (isDualTimer(s.type)) {
          const st = s as DualTimerState
          if (st.activeTimer === 'positive') st.positiveTime = remaining
          else st.negativeTime = remaining
        } else {
          ;(s as SingleTimerState).timeRemaining = remaining
        }
      }
      s.isRunning = false
      s.isPaused = true
      s.endAt = null
      stopLoop()
    },

    /** 重置计时器（恢复到环节初始时长） */
    resetTimer() {
      const info = this.currentStageInfo
      const s = this.currentStageState as StageState | null
      if (!s || !info) return
      if (isDualTimer(s.type)) {
        const st = s as DualTimerState
        st.positiveTime = info.positiveDuration ?? info.duration
        st.negativeTime = info.negativeDuration ?? info.duration
        st.activeTimer = 'positive'
      } else {
        ;(s as SingleTimerState).timeRemaining = info.duration
      }
      s.isRunning = false
      s.isPaused = false
      s.endAt = null
      stopLoop()
      resetWriteCache()
    },

    /** 设置自定义时间（单计时器） */
    setCustomTime(seconds: number) {
      const s = this.currentStageState as StageState | null
      if (s && s.type !== 'dual-timer') {
        ;(s as SingleTimerState).timeRemaining = seconds
        s.isRunning = false
        s.isPaused = false
        s.endAt = null
        stopLoop()
        resetWriteCache()
      }
    },

    /** 设置自定义时间（双计时器） */
    setCustomDualTime(positiveTime: number, negativeTime: number) {
      const s = this.currentStageState as StageState | null
      if (s && isDualTimer(s.type)) {
        const st = s as DualTimerState
        st.positiveTime = positiveTime
        st.negativeTime = negativeTime
        s.isRunning = false
        s.isPaused = false
        s.endAt = null
        stopLoop()
        resetWriteCache()
      }
    },

    // ============ 双计时器控制 ============

    /** 双计时器开始（取有剩余的一侧作为激活侧） */
    startDualTimer() {
      const s = this.currentStageState as StageState | null
      if (!s || s.type !== 'dual-timer') return
      const st = s as DualTimerState
      // 若当前侧已耗尽，自动切到有剩余的一侧
      if (st.activeTimer === 'positive' && st.positiveTime === 0 && st.negativeTime > 0) {
        st.activeTimer = 'negative'
      } else if (st.activeTimer === 'negative' && st.negativeTime === 0 && st.positiveTime > 0) {
        st.activeTimer = 'positive'
      }
      if (st.activeTimer === 'positive' && st.positiveTime > 0) {
        st.endAt = Date.now() + st.positiveTime * 1000
      } else if (st.activeTimer === 'negative' && st.negativeTime > 0) {
        st.endAt = Date.now() + st.negativeTime * 1000
      } else {
        return // 两侧皆空
      }
      st.isRunning = true
      st.isPaused = false
      prevPos = st.positiveTime
      prevNeg = st.negativeTime
      resetWriteCache()
      ensureLoop()
    },

    /** 暂停双计时（通用 pauseTimer 已覆盖，保留以兼容潜在调用） */
    pauseDualTimer() {
      this.pauseTimer()
    },

    /** 切换双计时器的激活侧 */
    switchDualTimer() {
      const s = this.currentStageState as StageState | null
      if (!s || s.type !== 'dual-timer') return
      const st = s as DualTimerState
      const next = st.activeTimer === 'positive' ? 'negative' : 'positive'
      const nextHas = next === 'positive' ? st.positiveTime > 0 : st.negativeTime > 0
      const currHas = st.activeTimer === 'positive' ? st.positiveTime > 0 : st.negativeTime > 0

      if (nextHas) {
        // 冻结当前激活侧到精确剩余秒
        if (st.endAt != null) {
          const rem = remainingFrom(st.endAt)
          if (st.activeTimer === 'positive') st.positiveTime = rem
          else st.negativeTime = rem
        }
        st.activeTimer = next
        if (st.activeTimer === 'positive') st.endAt = Date.now() + st.positiveTime * 1000
        else st.endAt = Date.now() + st.negativeTime * 1000
        st.isRunning = true
        st.isPaused = false
        prevPos = st.positiveTime
        prevNeg = st.negativeTime
        resetWriteCache()
        ensureLoop()
      } else if (currHas) {
        // 保持当前侧继续计时（按需重新锚定）
        if (st.endAt == null && st.activeTimer === 'positive' && st.positiveTime > 0) {
          st.endAt = Date.now() + st.positiveTime * 1000
        } else if (st.endAt == null && st.activeTimer === 'negative' && st.negativeTime > 0) {
          st.endAt = Date.now() + st.negativeTime * 1000
        }
        st.isRunning = true
        st.isPaused = false
        resetWriteCache()
        ensureLoop()
      } else {
        // 双方均耗尽
        st.isRunning = false
        st.isPaused = true
        st.endAt = null
        stopLoop()
      }
    },

    /** 直接激活正方计时 */
    startPositiveTimer() {
      const s = this.currentStageState as StageState | null
      if (!s || s.type !== 'dual-timer') return
      const st = s as DualTimerState
      if (st.positiveTime <= 0) return
      // 冻结反方（若正在计）
      if (st.endAt != null && st.activeTimer === 'negative') {
        st.negativeTime = remainingFrom(st.endAt)
      }
      st.activeTimer = 'positive'
      st.endAt = Date.now() + st.positiveTime * 1000
      st.isRunning = true
      st.isPaused = false
      prevPos = st.positiveTime
      prevNeg = st.negativeTime
      resetWriteCache()
      ensureLoop()
    },

    /** 直接激活反方计时 */
    startNegativeTimer() {
      const s = this.currentStageState as StageState | null
      if (!s || s.type !== 'dual-timer') return
      const st = s as DualTimerState
      if (st.negativeTime <= 0) return
      // 冻结正方（若正在计）
      if (st.endAt != null && st.activeTimer === 'positive') {
        st.positiveTime = remainingFrom(st.endAt)
      }
      st.activeTimer = 'negative'
      st.endAt = Date.now() + st.negativeTime * 1000
      st.isRunning = true
      st.isPaused = false
      prevPos = st.positiveTime
      prevNeg = st.negativeTime
      resetWriteCache()
      ensureLoop()
    },

    /** 重置指定侧或两侧的双计时器 */
    resetDualTimer(type: 'positive' | 'negative' | 'both' = 'both') {
      const info = this.currentStageInfo
      const s = this.currentStageState as StageState | null
      if (!s || s.type !== 'dual-timer' || !info) return
      const st = s as DualTimerState
      const initialPositive = info.positiveDuration ?? info.duration
      const initialNegative = info.negativeDuration ?? info.duration

      if (type === 'both') {
        st.positiveTime = initialPositive
        st.negativeTime = initialNegative
        st.isRunning = false
        st.isPaused = false
        st.activeTimer = 'positive'
        st.endAt = null
      } else if (type === 'positive') {
        st.positiveTime = initialPositive
        // 如果正方正在运行，则停止计时
        if (st.activeTimer === 'positive') {
          st.isRunning = false
          st.isPaused = false
          st.endAt = null
        }
      } else if (type === 'negative') {
        st.negativeTime = initialNegative
        // 如果反方正在运行，则停止计时
        if (st.activeTimer === 'negative') {
          st.isRunning = false
          st.isPaused = false
          st.endAt = null
        }
      }
      stopLoop()
      resetWriteCache()
    },

    // ============ 音效播放 ============

    /** 设置提示音配置（含声音方案），由计时页在加载 timer-config 后调用 */
    setAudioConfig(cfg: TimerAudioConfig | null | undefined) {
      this.audioConfig = cfg ? { ...cfg } : null
    },

    /**
     * 根据当前声音方案解析某一剩余秒数应播放的音频文件路径。
     * - default（默认提示音）：30秒→warningSound/30.mp3，5秒→finalWarningSound/5.mp3，0秒→timeUpSound/End.mp3
     * - formal（正式比赛提示音·钉钉响铃）：30秒与结束时各响一次钉钉铃，5秒不响
     * 未启用提示音时返回 ''（不播放）。
     */
    resolveSoundFile(timeRemaining: number): string {
      const cfg = this.audioConfig
      if (!cfg || cfg.enabled === false) return ''
      const scheme = cfg.scheme || 'default'
      if (scheme === 'formal') {
        // 正式比赛提示音：30秒响、结束响，5秒静音
        if (timeRemaining === 30) return cfg.warningSound || '/dingtalk.mp3'
        if (timeRemaining === 0) return cfg.timeUpSound || '/dingtalk.mp3'
        return '' // 5秒：不响
      }
      // 默认提示音
      if (timeRemaining === 30) return cfg.warningSound || '/30.mp3'
      if (timeRemaining === 5) return cfg.finalWarningSound || '/5.mp3'
      if (timeRemaining === 0) return cfg.timeUpSound || '/End.mp3'
      return ''
    },

    /** 播放提示音（剩余30秒、5秒、0秒），音源由当前声音方案决定 */
    playTimerSound(timeRemaining: number) {
      try {
        const audioFile = this.resolveSoundFile(timeRemaining)
        if (audioFile) {
          // 复用缓存的 Audio 对象，避免重复创建和加载
          const audio = getCachedAudio(audioFile)
          if (audio) {
            audio.currentTime = 0 // 从头播放
            audio.play().catch(() => {
              /* 浏览器自动播放策略可能阻止，忽略 */
            })
          }
        }
      } catch (e) {
        // 静默失败，不影响计时
      }
    },

    /** 手动播放测试音效（复用方案解析，使测试与实际播放一致） */
    playTestSound(type: '30' | '5' | 'End') {
      try {
        const map: Record<'30' | '5' | 'End', number> = { '30': 30, '5': 5, End: 0 }
        const audioFile = this.resolveSoundFile(map[type])
        if (audioFile) {
          const audio = getCachedAudio(audioFile)
          if (audio) {
            audio.currentTime = 0
            audio.play().catch(() => {})
          }
        }
      } catch {}
    },

    // ============ 完整重置 ============

    /** 重置整个比赛 */
    resetAll() {
      this.currentStage = 1
      // ponytail: 直接赋值，无需 JSON 深拷贝
      const initialStates = generateInitialStatesFrom(this.stages)
      for (const s of this.stages) {
        this.stageStates[s.id] = initialStates[s.id]!
      }
      this.completedStages = []
      stopLoop()
      resetWriteCache()
    },

    /** 页面卸载时调用：停止心跳循环并清空提示音快照 */
    disposeTimer() {
      stopLoop()
      prevSingle = null
      prevPos = null
      prevNeg = null
      resetWriteCache()
      // 页面卸载时也清空缓存的 store 引用，避免跨页面复用旧引用
      cachedStore = null
    },
  },
})
