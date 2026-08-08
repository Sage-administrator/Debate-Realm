import { describe, it, expect } from 'vitest'
import { isSystemFieldKey, getSystemFieldDef, SYSTEM_FIELDS, SYSTEM_FIELD_KEYS } from '../../../server/utils/system-fields'

describe('system-fields', () => {
  describe('SYSTEM_FIELDS', () => {
    it('should contain exactly 6 system fields', () => {
      expect(SYSTEM_FIELDS).toHaveLength(6)
    })

    it('should have required fieldKeys', () => {
      const keys = SYSTEM_FIELDS.map(f => f.fieldKey)
      expect(keys).toContain('submitterName')
      expect(keys).toContain('contactPhone')
      expect(keys).toContain('contactEmail')
      expect(keys).toContain('teamName')
      expect(keys).toContain('members')
      expect(keys).toContain('notes')
    })

    it('should have unique fieldKeys', () => {
      const keys = SYSTEM_FIELDS.map(f => f.fieldKey)
      expect(new Set(keys).size).toBe(keys.length)
    })
  })

  describe('SYSTEM_FIELD_KEYS', () => {
    it('should match SYSTEM_FIELDS keys', () => {
      expect(SYSTEM_FIELD_KEYS).toEqual(SYSTEM_FIELDS.map(f => f.fieldKey))
    })
  })

  describe('isSystemFieldKey', () => {
    it('should return true for known system fields', () => {
      expect(isSystemFieldKey('submitterName')).toBe(true)
      expect(isSystemFieldKey('contactPhone')).toBe(true)
      expect(isSystemFieldKey('members')).toBe(true)
    })

    it('should return false for custom fields', () => {
      expect(isSystemFieldKey('custom_field')).toBe(false)
      expect(isSystemFieldKey('')).toBe(false)
      expect(isSystemFieldKey('wechatId')).toBe(false)
    })
  })

  describe('getSystemFieldDef', () => {
    it('should return definition for existing field', () => {
      const def = getSystemFieldDef('submitterName')
      expect(def).toBeDefined()
      expect(def!.fieldKey).toBe('submitterName')
      expect(def!.fieldName).toBe('姓名')
      expect(def!.fieldType).toBe('text')
    })

    it('should return undefined for non-existent field', () => {
      expect(getSystemFieldDef('nonexistent')).toBeUndefined()
    })
  })
})
