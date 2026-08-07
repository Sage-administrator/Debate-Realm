import { describe, it, expect } from 'vitest'
import { dedupeTrimmedStrings, formatDeviceInfo, safeJsonParse } from '../../../server/utils/common'

describe('dedupeTrimmedStrings', () => {
  it('should deduplicate and trim strings', () => {
    expect(dedupeTrimmedStrings(['a', 'b', 'a', ' c '])).toEqual(['a', 'b', 'c'])
  })

  it('should filter empty strings', () => {
    expect(dedupeTrimmedStrings(['', ' ', 'a', '', 'b'])).toEqual(['a', 'b'])
  })

  it('should return empty array for empty input', () => {
    expect(dedupeTrimmedStrings([])).toEqual([])
  })

  it('should preserve order', () => {
    expect(dedupeTrimmedStrings(['z', 'a', 'z', 'b'])).toEqual(['z', 'a', 'b'])
  })
})

describe('formatDeviceInfo', () => {
  it('should detect Chrome on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0'
    expect(formatDeviceInfo(ua)).toBe('Chrome on Windows')
  })

  it('should detect Safari on macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
    expect(formatDeviceInfo(ua)).toBe('Safari on macOS')
  })

  it('should handle null/undefined', () => {
    expect(formatDeviceInfo(null)).toBe('未知设备')
    expect(formatDeviceInfo(undefined)).toBe('未知设备')
  })

  it('should detect Edge', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Edg/120.0'
    expect(formatDeviceInfo(ua)).toBe('Edge on Windows')
  })
})

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 })
  })

  it('should return fallback for invalid JSON', () => {
    expect(safeJsonParse('{invalid}', { default: true })).toEqual({ default: true })
  })

  it('should return fallback for null/undefined', () => {
    expect(safeJsonParse(null, 'fallback')).toBe('fallback')
    expect(safeJsonParse(undefined, 'fallback')).toBe('fallback')
  })

  it('should parse arrays', () => {
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3])
  })
})
