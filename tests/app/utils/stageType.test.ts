/**
 * app/utils/stageType.ts 单元测试
 * 10 个纯函数，全部无副作用，适合单元测试
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeStageType,
  isSpeech,
  isQuestion,
  isSummary,
  isBilateral,
  isDualTimer,
  isTimerType,
  isNoTimer,
  isPpt,
  hasTimer,
  typeLabel,
} from '../../../app/utils/stageType'

// ===================== normalizeStageType =====================

describe('normalizeStageType (app)', () => {
  it('should map old enum values to new', () => {
    expect(normalizeStageType('speech')).toBe('single_speech')
    expect(normalizeStageType('question')).toBe('single_question')
    expect(normalizeStageType('dual-timer')).toBe('bilateral_debate')
    expect(normalizeStageType('special')).toBe('no_timer')
  })

  it('should keep new values unchanged', () => {
    expect(normalizeStageType('single_speech')).toBe('single_speech')
    expect(normalizeStageType('summary')).toBe('summary')
    expect(normalizeStageType('free_debate')).toBe('free_debate')
    expect(normalizeStageType('ppt_replace')).toBe('ppt_replace')
  })

  it('should return single_speech for falsy input', () => {
    expect(normalizeStageType(null)).toBe('single_speech')
    expect(normalizeStageType(undefined)).toBe('single_speech')
    expect(normalizeStageType('')).toBe('single_speech')
  })
})

// ===================== isSpeech =====================

describe('isSpeech', () => {
  it('should return true for single_speech', () => {
    expect(isSpeech('single_speech')).toBe(true)
  })

  it('should return true for summary (same timing behavior)', () => {
    expect(isSpeech('summary')).toBe(true)
  })

  it('should return false for other types', () => {
    expect(isSpeech('single_question')).toBe(false)
    expect(isSpeech('bilateral_debate')).toBe(false)
    expect(isSpeech('no_timer')).toBe(false)
  })
})

// ===================== isQuestion =====================

describe('isQuestion', () => {
  it('should return true for single_question', () => {
    expect(isQuestion('single_question')).toBe(true)
    expect(isQuestion('question')).toBe(true) // old enum
  })

  it('should return false for speech', () => {
    expect(isQuestion('single_speech')).toBe(false)
    expect(isQuestion('speech')).toBe(false)
  })
})

// ===================== isSummary =====================

describe('isSummary', () => {
  it('should return true for summary', () => {
    expect(isSummary('summary')).toBe(true)
  })

  it('should return false for non-summary', () => {
    expect(isSummary('single_speech')).toBe(false)
    expect(isSummary('single_question')).toBe(false)
  })
})

// ===================== isBilateral =====================

describe('isBilateral', () => {
  it('should return true for bilateral_debate and free_debate', () => {
    expect(isBilateral('bilateral_debate')).toBe(true)
    expect(isBilateral('free_debate')).toBe(true)
    expect(isBilateral('dual-timer')).toBe(true) // old → bilateral_debate
  })

  it('should return false for non-debate types', () => {
    expect(isBilateral('single_speech')).toBe(false)
    expect(isBilateral('double_timer')).toBe(false)
  })
})

// ===================== isDualTimer =====================

describe('isDualTimer', () => {
  it('should return true for all dual-timer types', () => {
    expect(isDualTimer('bilateral_debate')).toBe(true)
    expect(isDualTimer('free_debate')).toBe(true)
    expect(isDualTimer('double_timer')).toBe(true)
    expect(isDualTimer('dual-timer')).toBe(true)
  })

  it('should return false for single timer types', () => {
    expect(isDualTimer('single_speech')).toBe(false)
    expect(isDualTimer('single_question')).toBe(false)
    expect(isDualTimer('single_timer')).toBe(false)
  })
})

// ===================== isTimerType =====================

describe('isTimerType', () => {
  it('should return true for speech/question/bilateral', () => {
    expect(isTimerType('single_speech')).toBe(true)
    expect(isTimerType('single_question')).toBe(true)
    expect(isTimerType('bilateral_debate')).toBe(true)
  })

  it('should return true for base timer types', () => {
    expect(isTimerType('single_timer')).toBe(true)
    expect(isTimerType('double_timer')).toBe(true)
  })

  it('should return false for no_timer and ppt', () => {
    expect(isTimerType('no_timer')).toBe(false)
    expect(isTimerType('ppt_replace')).toBe(false)
  })
})

// ===================== isNoTimer =====================

describe('isNoTimer', () => {
  it('should return true for no_timer', () => {
    expect(isNoTimer('no_timer')).toBe(true)
    expect(isNoTimer('special')).toBe(true) // old
  })

  it('should return false otherwise', () => {
    expect(isNoTimer('single_speech')).toBe(false)
  })
})

// ===================== isPpt =====================

describe('isPpt', () => {
  it('should return true for ppt_replace', () => {
    expect(isPpt('ppt_replace')).toBe(true)
  })

  it('should return false otherwise', () => {
    expect(isPpt('single_speech')).toBe(false)
    expect(isPpt('no_timer')).toBe(false)
  })
})

// ===================== hasTimer =====================

describe('hasTimer', () => {
  it('should return true for all timer types', () => {
    expect(hasTimer('single_speech')).toBe(true)
    expect(hasTimer('bilateral_debate')).toBe(true)
    expect(hasTimer('single_timer')).toBe(true)
  })

  it('should return false for no_timer and ppt', () => {
    expect(hasTimer('no_timer')).toBe(false)
    expect(hasTimer('ppt_replace')).toBe(false)
  })
})

// ===================== typeLabel =====================

describe('typeLabel', () => {
  it('should return correct labels for all types', () => {
    expect(typeLabel('single_speech')).toBe('单方发言')
    expect(typeLabel('single_question')).toBe('单方发问')
    expect(typeLabel('summary')).toBe('小结/总结')
    expect(typeLabel('bilateral_debate')).toBe('双边对辩')
    expect(typeLabel('free_debate')).toBe('自由辩论')
    expect(typeLabel('single_timer')).toBe('单计时器')
    expect(typeLabel('double_timer')).toBe('双计时器')
    expect(typeLabel('no_timer')).toBe('无计时器')
    expect(typeLabel('ppt_replace')).toBe('PPT图片')
  })

  it('should map old enum values via normalize', () => {
    expect(typeLabel('speech')).toBe('单方发言')
    expect(typeLabel('dual-timer')).toBe('双边对辩')
    expect(typeLabel('special')).toBe('无计时器')
  })

  it('should return raw value for unknown types', () => {
    expect(typeLabel('unknown')).toBe('unknown')
  })

  it('should handle falsy input', () => {
    expect(typeLabel(null)).toBe('单方发言') // defaults to single_speech
    expect(typeLabel('')).toBe('单方发言')
  })
})
