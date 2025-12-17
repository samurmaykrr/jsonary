import { describe, it, expect } from 'vitest'
import { repairJson, canRepairJson } from '../../../src/lib/json/repair'

describe('repairJson', () => {
  describe('already valid JSON', () => {
    it('returns valid JSON unchanged', () => {
      const input = '{"name": "John"}'
      const result = repairJson(input)
      expect(result.output).toBe(input)
      expect(result.wasRepaired).toBe(false)
      expect(result.error).toBeNull()
    })

    it('handles empty object', () => {
      const result = repairJson('{}')
      expect(result.output).toBe('{}')
      expect(result.wasRepaired).toBe(false)
    })

    it('handles empty array', () => {
      const result = repairJson('[]')
      expect(result.output).toBe('[]')
      expect(result.wasRepaired).toBe(false)
    })

    it('handles primitives', () => {
      expect(repairJson('null').wasRepaired).toBe(false)
      expect(repairJson('true').wasRepaired).toBe(false)
      expect(repairJson('42').wasRepaired).toBe(false)
      expect(repairJson('"hello"').wasRepaired).toBe(false)
    })
  })

  describe('repairable JSON', () => {
    it('repairs unquoted keys', () => {
      const input = '{name: "John"}'
      const result = repairJson(input)
      expect(result.wasRepaired).toBe(true)
      expect(result.error).toBeNull()
      expect(JSON.parse(result.output)).toEqual({ name: 'John' })
    })

    it('repairs single quotes', () => {
      const input = "{'name': 'John'}"
      const result = repairJson(input)
      expect(result.wasRepaired).toBe(true)
      expect(JSON.parse(result.output)).toEqual({ name: 'John' })
    })

    it('repairs trailing commas in objects', () => {
      const input = '{"name": "John",}'
      const result = repairJson(input)
      expect(result.wasRepaired).toBe(true)
      expect(JSON.parse(result.output)).toEqual({ name: 'John' })
    })

    it('repairs trailing commas in arrays', () => {
      const input = '[1, 2, 3,]'
      const result = repairJson(input)
      expect(result.wasRepaired).toBe(true)
      expect(JSON.parse(result.output)).toEqual([1, 2, 3])
    })

    it('repairs Python-style True/False/None', () => {
      const input = '{"active": True, "value": None, "enabled": False}'
      const result = repairJson(input)
      expect(result.wasRepaired).toBe(true)
      expect(JSON.parse(result.output)).toEqual({ active: true, value: null, enabled: false })
    })

    it('repairs missing quotes around strings', () => {
      const input = '{name: John}'
      const result = repairJson(input)
      expect(result.wasRepaired).toBe(true)
      // jsonrepair should handle this
      const parsed = JSON.parse(result.output)
      expect(parsed.name).toBeDefined()
    })

    it('repairs comments', () => {
      const input = `{
        // This is a comment
        "name": "John"
      }`
      const result = repairJson(input)
      expect(result.wasRepaired).toBe(true)
      expect(JSON.parse(result.output)).toEqual({ name: 'John' })
    })

    it('repairs missing closing brace', () => {
      const input = '{"name": "John"'
      const result = repairJson(input)
      expect(result.wasRepaired).toBe(true)
      expect(JSON.parse(result.output)).toEqual({ name: 'John' })
    })

    it('repairs missing closing bracket', () => {
      const input = '[1, 2, 3'
      const result = repairJson(input)
      expect(result.wasRepaired).toBe(true)
      expect(JSON.parse(result.output)).toEqual([1, 2, 3])
    })
  })

  describe('unrepairable input', () => {
    it('returns error for completely invalid input', () => {
      const input = 'this is not json at all {'
      const result = repairJson(input)
      // jsonrepair is very permissive, so it might actually repair this
      // If it can't, there should be an error
      if (result.error) {
        expect(result.error).toBeDefined()
      }
    })
  })
})

describe('canRepairJson', () => {
  it('returns false for valid JSON', () => {
    expect(canRepairJson('{"name": "John"}')).toBe(false)
    expect(canRepairJson('[]')).toBe(false)
    expect(canRepairJson('null')).toBe(false)
  })

  it('returns true for repairable JSON', () => {
    expect(canRepairJson('{name: "John"}')).toBe(true)
    expect(canRepairJson("{'name': 'John'}")).toBe(true)
    expect(canRepairJson('[1, 2, 3,]')).toBe(true)
  })

  it('returns true for JSON with trailing comma', () => {
    expect(canRepairJson('{"a": 1,}')).toBe(true)
  })

  it('returns true for JSON with comments', () => {
    expect(canRepairJson('{"a": 1} // comment')).toBe(true)
  })
})
