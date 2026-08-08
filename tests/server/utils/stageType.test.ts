import { describe, it, expect } from 'vitest'
import { normalizeStageType } from '../../../server/utils/stageType'

describe('normalizeStageType', () => {
  it('should map old enum values to new', () => {
    expect(normalizeStageType('speech')).toBe('single_speech')
    expect(normalizeStageType('question')).toBe('single_question')
    expect(normalizeStageType('dual-timer')).toBe('bilateral_debate')
    expect(normalizeStageType('special')).toBe('no_timer')
  })

  it('should keep new enum values unchanged', () => {
    expect(normalizeStageType('single_speech')).toBe('single_speech')
    expect(normalizeStageType('single_question')).toBe('single_question')
    expect(normalizeStageType('summary')).toBe('summary')
    expect(normalizeStageType('bilateral_debate')).toBe('bilateral_debate')
    expect(normalizeStageType('free_debate')).toBe('free_debate')
    expect(normalizeStageType('no_timer')).toBe('no_timer')
    expect(normalizeStageType('ppt_replace')).toBe('ppt_replace')
    expect(normalizeStageType('double_timer')).toBe('double_timer')
  })

  it('should return single_speech for null/undefined/empty', () => {
    expect(normalizeStageType(null)).toBe('single_speech')
    expect(normalizeStageType(undefined)).toBe('single_speech')
    expect(normalizeStageType('')).toBe('single_speech')
  })

  it('should return unknown types as-is', () => {
    expect(normalizeStageType('unknown_type')).toBe('unknown_type')
  })
})
