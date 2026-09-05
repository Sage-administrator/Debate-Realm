/**
 * debate.ts 纯函数提取测试
 *
 * 测试从 Pinia Store 中提取为独立纯函数的核心计算逻辑：
 *   - remainingFrom → calcRemaining (时间戳锚定)
 *   - generateInitialStatesFrom (状态初始化)
 *   - resolveSoundFile (音效方案解析)
 */
import { describe, it, expect } from 'vitest'

// 被提取的纯函数（不依赖 Pinia/DOM/Date.now）

/** 根据锚点时间戳和当前时间计算剩余秒数（纯函数版本） */
function calcRemaining(endAt: number, now: number): number {
  return Math.max(0, Math.round((endAt - now) / 1000))
}

/** 判断环节类型是否为双计时器（从 normalizeStageType 简化） */
const TYPE_MAP: Record<string, string> = {
  'speech': 'single_speech',
  'question': 'single_question',
  'dual-timer': 'bilateral_debate',
  'special': 'no_timer',
}
function normalizeStageType(old: string | null | undefined): string {
  if (!old) return 'single_speech'
  return TYPE_MAP[old] || old
}
function isDualTimerType(t: string | null | undefined): boolean {
  const n = normalizeStageType(t)
  return n === 'bilateral_debate' || n === 'free_debate' || n === 'double_timer'
}

/** 根据声音方案解析音频文件路径（纯函数） */
function resolveSoundFile(
  timeRemaining: number,
  cfg: { enabled?: boolean; scheme?: 'default' | 'formal'; warningSound?: string; finalWarningSound?: string; timeUpSound?: string } | null,
): string {
  if (!cfg || cfg.enabled === false) return ''
  const scheme = cfg.scheme || 'default'
  if (scheme === 'formal') {
    if (timeRemaining === 30) return cfg.warningSound || '/dingtalk.mp3'
    if (timeRemaining === 0) return cfg.timeUpSound || '/dingtalk.mp3'
    return ''
  }
  if (timeRemaining === 30) return cfg.warningSound || '/30.mp3'
  if (timeRemaining === 5) return cfg.finalWarningSound || '/5.mp3'
  if (timeRemaining === 0) return cfg.timeUpSound || '/End.mp3'
  return ''
}

interface DebateStage {
  id: number
  name: string
  duration: number
  type: string
  positiveDuration?: number
  negativeDuration?: number
}

/** 生成初始阶段状态（纯数据转换） */
function generateInitialStatesFrom(stages: DebateStage[]): Record<number, any> {
  const states: Record<number, any> = {}
  stages.forEach((stage) => {
    if (isDualTimerType(stage.type)) {
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

// ===================== calcRemaining =====================

describe('calcRemaining', () => {
  it('should return full time when now=0', () => {
    expect(calcRemaining(10000, 0)).toBe(10)    // 10s
    expect(calcRemaining(60000, 0)).toBe(60)     // 60s
    expect(calcRemaining(300000, 0)).toBe(300)    // 300s = 5min
  })

  it('should return 0 when endAt = now', () => {
    expect(calcRemaining(5000, 5000)).toBe(0)
  })

  it('should return 0 when now > endAt', () => {
    expect(calcRemaining(5000, 6000)).toBe(0)
  })

  it('should round correctly at .5 boundary', () => {
    // endAt=5500, now=0 → 5500ms = 5.5s → Math.round → 6
    expect(calcRemaining(5500, 0)).toBe(6)
    // endAt=5499, now=0 → 5499ms = 5.499s → Math.round → 5
    expect(calcRemaining(5499, 0)).toBe(5)
  })

  it('should count down correctly', () => {
    // Starting at 10s (endAt=10000), after 3500ms → 6.5s → round → 7
    expect(calcRemaining(10000, 3500)).toBe(7)
    // After 7500ms → 2.5s → round → 3
    expect(calcRemaining(10000, 7500)).toBe(3)
    // After 9999ms → 0.001s → round → 0
    expect(calcRemaining(10000, 9999)).toBe(0)
  })
})

// ===================== generateInitialStatesFrom =====================

describe('generateInitialStatesFrom', () => {
  it('should create single timer state for speech stage', () => {
    const stages: DebateStage[] = [
      { id: 1, name: '立论', duration: 180, type: 'single_speech' },
    ]
    const states = generateInitialStatesFrom(stages)
    expect(states[1]).toBeDefined()
    expect(states[1].type).toBe('single_speech')
    expect(states[1].timeRemaining).toBe(180)
    expect(states[1].isRunning).toBe(false)
    expect(states[1].isPaused).toBe(false)
    expect(states[1].endAt).toBeNull()
  })

  it('should create dual timer state for debate stage', () => {
    const stages: DebateStage[] = [
      { id: 2, name: '对辩', duration: 300, type: 'bilateral_debate', positiveDuration: 240, negativeDuration: 240 },
    ]
    const states = generateInitialStatesFrom(stages)
    expect(states[2].type).toBe('dual-timer')
    expect(states[2].positiveTime).toBe(240)
    expect(states[2].negativeTime).toBe(240)
    expect(states[2].activeTimer).toBe('positive')
    expect(states[2].isRunning).toBe(false)
  })

  it('should use stage.duration when positiveDuration not set', () => {
    const stages: DebateStage[] = [
      { id: 3, name: '自由辩论', duration: 300, type: 'free_debate' },
    ]
    const states = generateInitialStatesFrom(stages)
    expect(states[3].positiveTime).toBe(300)
    expect(states[3].negativeTime).toBe(300)
  })

  it('should handle multiple stages', () => {
    const stages: DebateStage[] = [
      { id: 1, name: '立论', duration: 180, type: 'single_speech' },
      { id: 2, name: '对辩', duration: 300, type: 'bilateral_debate' },
      { id: 3, name: '总结', duration: 240, type: 'summary' },
    ]
    const states = generateInitialStatesFrom(stages)
    expect(Object.keys(states)).toHaveLength(3)
  })

  it('should handle empty stages', () => {
    expect(generateInitialStatesFrom([])).toEqual({})
  })
})

// ===================== resolveSoundFile =====================

describe('resolveSoundFile', () => {
  it('should return empty when audio disabled', () => {
    expect(resolveSoundFile(30, { enabled: false })).toBe('')
    expect(resolveSoundFile(5, { enabled: false })).toBe('')
    expect(resolveSoundFile(0, { enabled: false })).toBe('')
  })

  it('should return empty when config is null', () => {
    expect(resolveSoundFile(30, null)).toBe('')
  })

  it('should return default 30s sound', () => {
    expect(resolveSoundFile(30, { enabled: true })).toBe('/30.mp3')
  })

  it('should return default 5s sound', () => {
    expect(resolveSoundFile(5, { enabled: true })).toBe('/5.mp3')
  })

  it('should return default 0s sound', () => {
    expect(resolveSoundFile(0, { enabled: true })).toBe('/End.mp3')
  })

  it('should respect custom sound paths', () => {
    const cfg = { enabled: true, warningSound: '/custom-30.mp3', finalWarningSound: '/custom-5.mp3', timeUpSound: '/custom-end.mp3' }
    expect(resolveSoundFile(30, cfg)).toBe('/custom-30.mp3')
    expect(resolveSoundFile(5, cfg)).toBe('/custom-5.mp3')
    expect(resolveSoundFile(0, cfg)).toBe('/custom-end.mp3')
  })

  it('should use formal scheme (only 30 and 0, dingtalk.mp3)', () => {
    const cfg = { enabled: true, scheme: 'formal' as const }
    expect(resolveSoundFile(30, cfg)).toBe('/dingtalk.mp3')
    expect(resolveSoundFile(5, cfg)).toBe('')       // formal scheme 5s不响
    expect(resolveSoundFile(0, cfg)).toBe('/dingtalk.mp3')
  })

  it('should return empty for irrelevant seconds', () => {
    expect(resolveSoundFile(29, { enabled: true })).toBe('')
    expect(resolveSoundFile(10, { enabled: true })).toBe('')
    expect(resolveSoundFile(1, { enabled: true })).toBe('')
  })
})
