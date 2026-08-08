import { describe, it, expect } from 'vitest'
import { parseDefaultFieldsConfig } from '../../../server/utils/default-fields'

describe('parseDefaultFieldsConfig', () => {
  it('should return defaults when config is null', () => {
    const result = parseDefaultFieldsConfig(null)
    expect(result).toHaveLength(6)
    expect(result[0]!.fieldKey).toBe('submitterName')
    expect(result[0]!.appliesTo).toBe('both')
    expect(result[0]!.required).toBe(true)
  })

  it('should return defaults when config is empty string', () => {
    const result = parseDefaultFieldsConfig('')
    expect(result).toHaveLength(6)
  })

  it('should merge stored config overrides', () => {
    const config = JSON.stringify({
      submitterName: { appliesTo: 'individual', required: false },
      contactPhone: { required: false },
    })
    const result = parseDefaultFieldsConfig(config)
    const nameField = result.find(f => f.fieldKey === 'submitterName')!
    expect(nameField.appliesTo).toBe('individual')
    expect(nameField.required).toBe(false)
    const phoneField = result.find(f => f.fieldKey === 'contactPhone')!
    expect(phoneField.required).toBe(false)
    expect(phoneField.appliesTo).toBe('both') // not overridden
  })

  it('should handle partial overrides', () => {
    const config = JSON.stringify({ teamName: { appliesTo: 'team' } })
    const result = parseDefaultFieldsConfig(config)
    const teamField = result.find(f => f.fieldKey === 'teamName')!
    expect(teamField.appliesTo).toBe('team')
    expect(teamField.required).toBe(true) // from default
  })

  it('should mark all fields as isDefault=true', () => {
    const result = parseDefaultFieldsConfig(null)
    for (const f of result) {
      expect(f.isDefault).toBe(true)
    }
  })
})
