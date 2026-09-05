/**
 * debate store —— 真实行为回归套件
 *
 * 直接 import 并驱动真实 Pinia store（经 tests/setup/auto-imports.ts 桥接 Nuxt 自动导入）。
 * 用 vi.useFakeTimers() 冻结墙钟，使「时间戳锚定」计时引擎可被精确断言：
 *   - startTimer 锚点 = Date.now() + 剩余秒*1000
 *   - pauseTimer 按墙钟冻结剩余秒（整秒四舍五入）
 *   - 双计时器切换时冻结当前侧、激活另一侧
 *   - 环节切换 / 完成 / 重置的台账
 *   - resolveSoundFile 的 default / formal 方案映射
 *   - 心跳循环在剩余秒穿越 30/5/0 时播报对应提示音
 *
 * 这是 P1（计时页面收敛）前的「底片」：页面重构只调用这些公开 action，行为必须不变。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDebateStore, type DebateStage } from '../../../app/stores/debate'

// 冻结墙钟起点，便于精确断言锚点
const T0 = new Date('2026-01-01T00:00:00.000Z').getTime()

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  try {
    useDebateStore().disposeTimer()
  } catch {
    /* 某些用例可能已 stop */
  }
  vi.useRealTimers()
  setActivePinia(null)
})

/** 构造一个最小环节定义 */
function makeStage(p: Partial<DebateStage> & { id: number; type: string; duration: number }): DebateStage {
  return { name: `S${p.id}`, ...p } as DebateStage
}

// ===================== setStages 初始化 =====================

describe('setStages', () => {
  it('为 speech 环节生成单计时器初始状态', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 1, type: 'single_speech', duration: 180 })])
    const st = s.stageStates[1] as any
    expect(st.type).toBe('single_speech')
    expect(st.timeRemaining).toBe(180)
    expect(st.isRunning).toBe(false)
    expect(st.endAt).toBeNull()
  })

  it('为 bilateral 环节生成双计时器初始状态（取独立时长）', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 2, type: 'bilateral_debate', duration: 300, positiveDuration: 240, negativeDuration: 240 })])
    const st = s.stageStates[2] as any
    expect(st.type).toBe('dual-timer')
    expect(st.positiveTime).toBe(240)
    expect(st.negativeTime).toBe(240)
    expect(st.activeTimer).toBe('positive')
  })

  it('无 positiveDuration 时回退 stage.duration', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 3, type: 'free_debate', duration: 300 })])
    const st = s.stageStates[3] as any
    expect(st.positiveTime).toBe(300)
    expect(st.negativeTime).toBe(300)
  })

  it('按 order 字段排序', () => {
    const s = useDebateStore()
    s.setStages([
      makeStage({ id: 1, type: 'single_speech', duration: 10, order: 3 }),
      makeStage({ id: 2, type: 'single_speech', duration: 10, order: 1 }),
      makeStage({ id: 3, type: 'summary', duration: 10, order: 2 }),
    ])
    expect(s.stages.map((x) => x.id)).toEqual([2, 3, 1])
  })

  it('空环节不重置状态', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 1, type: 'single_speech', duration: 10 })])
    s.setStages([]) // 空数组应被忽略
    expect(s.stages).toHaveLength(1)
  })
})

// ===================== 单计时器控制 =====================

describe('单计时器控制', () => {
  it('startTimer 按墙钟锚定 endAt', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 1, type: 'single_speech', duration: 35 })])
    s.startTimer()
    const st = s.stageStates[1] as any
    expect(st.endAt).toBe(T0 + 35000)
    expect(st.isRunning).toBe(true)
    expect(st.isPaused).toBe(false)
  })

  it('pauseTimer 按墙钟冻结剩余秒（整秒四舍五入）', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 1, type: 'single_speech', duration: 35 })])
    s.startTimer()
    vi.advanceTimersByTime(3000) // 墙钟到 T0+3000，剩余 32
    s.pauseTimer()
    const st = s.stageStates[1] as any
    expect(st.timeRemaining).toBe(32)
    expect(st.isPaused).toBe(true)
    expect(st.endAt).toBeNull()
    expect(s.isRunning).toBe(false)
  })

  it('resetTimer 恢复到环节初始时长', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 1, type: 'single_speech', duration: 35 })])
    s.startTimer()
    vi.advanceTimersByTime(3000)
    s.pauseTimer()
    expect((s.stageStates[1] as any).timeRemaining).toBe(32)
    s.resetTimer()
    expect((s.stageStates[1] as any).timeRemaining).toBe(35)
    expect((s.stageStates[1] as any).isPaused).toBe(false)
  })

  it('setCustomTime 直接改写剩余秒并停止', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 1, type: 'single_speech', duration: 35 })])
    s.startTimer()
    s.setCustomTime(99)
    expect((s.stageStates[1] as any).timeRemaining).toBe(99)
    expect(s.isRunning).toBe(false)
  })
})

// ===================== 双计时器控制 =====================

describe('双计时器控制', () => {
  it('startDualTimer 激活正方并锚定', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 1, type: 'bilateral_debate', duration: 10, positiveDuration: 10, negativeDuration: 10 })])
    s.startDualTimer()
    const st = s.stageStates[1] as any
    expect(st.activeTimer).toBe('positive')
    expect(st.endAt).toBe(T0 + 10000)
  })

  it('switchDualTimer 冻结当前侧、激活另一侧并重新锚定', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 1, type: 'bilateral_debate', duration: 10, positiveDuration: 10, negativeDuration: 10 })])
    s.startDualTimer()
    vi.advanceTimersByTime(4000) // 正方剩 6
    s.switchDualTimer()
    const st = s.stageStates[1] as any
    expect(st.positiveTime).toBe(6)
    expect(st.activeTimer).toBe('negative')
    expect(st.endAt).toBe(T0 + 4000 + 10000) // 重新锚定到墙钟
    vi.advanceTimersByTime(2000) // 反方剩 8
    expect(s.stageStates[1].negativeTime).toBe(8)
  })

  it('resetDualTimer(both) 两侧归位并停表', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 1, type: 'bilateral_debate', duration: 10, positiveDuration: 10, negativeDuration: 10 })])
    s.startDualTimer()
    vi.advanceTimersByTime(4000)
    s.switchDualTimer()
    vi.advanceTimersByTime(2000)
    s.resetDualTimer('both')
    const st = s.stageStates[1] as any
    expect(st.positiveTime).toBe(10)
    expect(st.negativeTime).toBe(10)
    expect(st.activeTimer).toBe('positive')
    expect(st.isRunning).toBe(false)
    expect(st.endAt).toBeNull()
  })
})

// ===================== 环节切换台账 =====================

describe('环节切换', () => {
  function threeStages() {
    return [
      makeStage({ id: 1, type: 'single_speech', duration: 10 }),
      makeStage({ id: 2, type: 'single_speech', duration: 10 }),
      makeStage({ id: 3, type: 'summary', duration: 10 }),
    ]
  }

  it('nextStage 推进并标记完成', () => {
    const s = useDebateStore()
    s.setStages(threeStages())
    expect(s.currentStage).toBe(1)
    s.nextStage()
    expect(s.currentStage).toBe(2)
    expect(s.completedStages).toContain(1)
  })

  it('goToStage 跳转并夹取边界', () => {
    const s = useDebateStore()
    s.setStages(threeStages())
    s.goToStage(99)
    expect(s.currentStage).toBe(3)
    s.goToStage(-5)
    expect(s.currentStage).toBe(1)
  })

  it('previousStage 回退并撤销完成标记', () => {
    const s = useDebateStore()
    s.setStages(threeStages())
    s.nextStage() // →2, 完成1
    s.nextStage() // →3, 完成2
    s.previousStage() // →2
    expect(s.currentStage).toBe(2)
    expect(s.completedStages).not.toContain(3)
  })

  it('resetAll 回到首环节并清空完成列表', () => {
    const s = useDebateStore()
    s.setStages(threeStages())
    s.startTimer()
    vi.advanceTimersByTime(3000)
    s.nextStage()
    s.resetAll()
    expect(s.currentStage).toBe(1)
    expect(s.completedStages).toHaveLength(0)
    expect((s.stageStates[1] as any).timeRemaining).toBe(10)
  })
})

// ===================== 提示音方案解析 =====================

describe('resolveSoundFile', () => {
  it('default 方案映射 30/5/0', () => {
    const s = useDebateStore()
    s.setAudioConfig({ enabled: true, scheme: 'default' })
    expect(s.resolveSoundFile(30)).toBe('/30.mp3')
    expect(s.resolveSoundFile(5)).toBe('/5.mp3')
    expect(s.resolveSoundFile(0)).toBe('/End.mp3')
    expect(s.resolveSoundFile(29)).toBe('')
  })

  it('formal 方案仅 30 与 0 响（5 秒静音）', () => {
    const s = useDebateStore()
    s.setAudioConfig({ enabled: true, scheme: 'formal' })
    expect(s.resolveSoundFile(30)).toBe('/dingtalk.mp3')
    expect(s.resolveSoundFile(5)).toBe('')
    expect(s.resolveSoundFile(0)).toBe('/dingtalk.mp3')
  })

  it('禁用 / 空配置返回空串', () => {
    const s = useDebateStore()
    s.setAudioConfig(null)
    expect(s.resolveSoundFile(30)).toBe('')
    s.setAudioConfig({ enabled: false, scheme: 'default' })
    expect(s.resolveSoundFile(0)).toBe('')
  })

  it('自定义音路径优先', () => {
    const s = useDebateStore()
    s.setAudioConfig({ enabled: true, scheme: 'default', warningSound: '/a.mp3', finalWarningSound: '/b.mp3', timeUpSound: '/c.mp3' })
    expect(s.resolveSoundFile(30)).toBe('/a.mp3')
    expect(s.resolveSoundFile(5)).toBe('/b.mp3')
    expect(s.resolveSoundFile(0)).toBe('/c.mp3')
  })
})

// ===================== 心跳提示音穿越 =====================

describe('心跳提示音穿越', () => {
  it('default 方案在剩余秒穿越 30/5/0 时播报', () => {
    const s = useDebateStore()
    const spy = vi.spyOn(s, 'playTimerSound')
    s.setStages([makeStage({ id: 1, type: 'single_speech', duration: 35 })])
    s.setAudioConfig({ enabled: true, scheme: 'default' })
    s.startTimer()
    vi.advanceTimersByTime(5000) // 跨越 30
    expect(spy).toHaveBeenCalledWith(30)
    vi.advanceTimersByTime(25000) // 跨到 5
    expect(spy).toHaveBeenCalledWith(5)
    vi.advanceTimersByTime(5000) // 跨到 0
    expect(spy).toHaveBeenCalledWith(0)
  })

  it('formal 方案在 5 秒处 cue 仍触发但无声（方案只在解析层生效）', () => {
    const s = useDebateStore()
    const spy = vi.spyOn(s, 'playTimerSound')
    s.setStages([makeStage({ id: 1, type: 'single_speech', duration: 35 })])
    s.setAudioConfig({ enabled: true, scheme: 'formal' })
    s.startTimer()
    vi.advanceTimersByTime(30000) // 到 5 秒
    expect(spy).toHaveBeenCalledWith(5) // 心跳 cue 与方案无关，仍会触发
    expect(s.resolveSoundFile(5)).toBe('') // formal 方案下 5 秒解析为空 → 实际无声
    expect(spy).toHaveBeenCalledWith(30)
  })

  it('时间到自动标记当前环节完成并停表', () => {
    const s = useDebateStore()
    s.setStages([makeStage({ id: 1, type: 'single_speech', duration: 2 })])
    s.startTimer()
    vi.advanceTimersByTime(2000) // 剩余 0
    expect(s.isRunning).toBe(false)
    expect(s.completedStages).toContain(1)
  })
})
