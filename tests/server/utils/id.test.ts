import { describe, it, expect } from 'vitest'
import { generateShortId } from '../../../server/utils/id'

describe('generateShortId', () => {
  it('should return a string of length 8', () => {
    const id = generateShortId()
    expect(id).toHaveLength(8)
  })

  it('should contain only lowercase letters and numbers', () => {
    // Run multiple times to detect non-alphanumeric characters
    for (let i = 0; i < 100; i++) {
      const id = generateShortId()
      expect(id).toMatch(/^[a-z0-9]{8}$/)
    }
  })

  it('should produce unique values across many calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateShortId())
    }
    // Extremely unlikely to have collisions in 1000 calls (36^8 = 2.8 trillion)
    expect(ids.size).toBe(1000)
  })

  it('should not be empty', () => {
    expect(generateShortId()).toBeTruthy()
  })
})
