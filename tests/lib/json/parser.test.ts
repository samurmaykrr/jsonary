import { describe, it, expect } from 'vitest'
import { parseJson, isValidJson, getValueType, getValuePreview } from '../../../src/lib/json/parser'

describe('parseJson', () => {
  describe('valid JSON', () => {
    it('parses an empty object', () => {
      const result = parseJson('{}')
      expect(result.value).toEqual({})
      expect(result.error).toBeNull()
    })

    it('parses an empty array', () => {
      const result = parseJson('[]')
      expect(result.value).toEqual([])
      expect(result.error).toBeNull()
    })

    it('parses null', () => {
      const result = parseJson('null')
      expect(result.value).toBeNull()
      expect(result.error).toBeNull()
    })

    it('parses boolean true', () => {
      const result = parseJson('true')
      expect(result.value).toBe(true)
      expect(result.error).toBeNull()
    })

    it('parses boolean false', () => {
      const result = parseJson('false')
      expect(result.value).toBe(false)
      expect(result.error).toBeNull()
    })

    it('parses a string', () => {
      const result = parseJson('"hello world"')
      expect(result.value).toBe('hello world')
      expect(result.error).toBeNull()
    })

    it('parses a string with escape sequences', () => {
      const result = parseJson('"hello\\nworld\\t!"')
      expect(result.value).toBe('hello\nworld\t!')
      expect(result.error).toBeNull()
    })

    it('parses an integer', () => {
      const result = parseJson('42')
      expect(result.value).toBe(42)
      expect(result.error).toBeNull()
    })

    it('parses a negative number', () => {
      const result = parseJson('-123')
      expect(result.value).toBe(-123)
      expect(result.error).toBeNull()
    })

    it('parses a floating point number', () => {
      const result = parseJson('3.14159')
      expect(result.value).toBe(3.14159)
      expect(result.error).toBeNull()
    })

    it('parses a number with exponent', () => {
      const result = parseJson('1.5e10')
      expect(result.value).toBe(1.5e10)
      expect(result.error).toBeNull()
    })

    it('parses a simple object', () => {
      const result = parseJson('{"name": "John", "age": 30}')
      expect(result.value).toEqual({ name: 'John', age: 30 })
      expect(result.error).toBeNull()
    })

    it('parses a simple array', () => {
      const result = parseJson('[1, 2, 3, 4, 5]')
      expect(result.value).toEqual([1, 2, 3, 4, 5])
      expect(result.error).toBeNull()
    })

    it('parses nested objects', () => {
      const json = '{"user": {"name": "John", "address": {"city": "NYC"}}}'
      const result = parseJson(json)
      expect(result.value).toEqual({
        user: {
          name: 'John',
          address: { city: 'NYC' },
        },
      })
      expect(result.error).toBeNull()
    })

    it('parses nested arrays', () => {
      const result = parseJson('[[1, 2], [3, 4], [5, 6]]')
      expect(result.value).toEqual([[1, 2], [3, 4], [5, 6]])
      expect(result.error).toBeNull()
    })

    it('parses mixed nested structures', () => {
      const json = '{"users": [{"name": "John"}, {"name": "Jane"}]}'
      const result = parseJson(json)
      expect(result.value).toEqual({
        users: [{ name: 'John' }, { name: 'Jane' }],
      })
      expect(result.error).toBeNull()
    })

    it('parses JSON with whitespace', () => {
      const json = `{
        "name": "John",
        "age": 30
      }`
      const result = parseJson(json)
      expect(result.value).toEqual({ name: 'John', age: 30 })
      expect(result.error).toBeNull()
    })
  })

  describe('invalid JSON', () => {
    it('returns error for empty string', () => {
      const result = parseJson('')
      expect(result.value).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toBeDefined()
    })

    it('returns error for missing closing brace', () => {
      const result = parseJson('{"name": "John"')
      expect(result.value).toBeNull()
      expect(result.error).not.toBeNull()
    })

    it('returns error for missing closing bracket', () => {
      const result = parseJson('[1, 2, 3')
      expect(result.value).toBeNull()
      expect(result.error).not.toBeNull()
    })

    it('returns error for trailing comma in object', () => {
      const result = parseJson('{"name": "John",}')
      expect(result.value).toBeNull()
      expect(result.error).not.toBeNull()
    })

    it('returns error for trailing comma in array', () => {
      const result = parseJson('[1, 2, 3,]')
      expect(result.value).toBeNull()
      expect(result.error).not.toBeNull()
    })

    it('returns error for single quotes', () => {
      const result = parseJson("{'name': 'John'}")
      expect(result.value).toBeNull()
      expect(result.error).not.toBeNull()
    })

    it('returns error for unquoted keys', () => {
      const result = parseJson('{name: "John"}')
      expect(result.value).toBeNull()
      expect(result.error).not.toBeNull()
    })

    it('returns error for invalid number', () => {
      const result = parseJson('{"value": 01}')
      expect(result.value).toBeNull()
      expect(result.error).not.toBeNull()
    })

    it('returns error location for syntax error', () => {
      const json = `{
  "name": "John",
  "age": 
}`
      const result = parseJson(json)
      expect(result.value).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.error?.line).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('isValidJson', () => {
  it('returns true for valid JSON', () => {
    expect(isValidJson('{}')).toBe(true)
    expect(isValidJson('[]')).toBe(true)
    expect(isValidJson('null')).toBe(true)
    expect(isValidJson('"string"')).toBe(true)
    expect(isValidJson('123')).toBe(true)
    expect(isValidJson('{"key": "value"}')).toBe(true)
  })

  it('returns false for invalid JSON', () => {
    expect(isValidJson('')).toBe(false)
    expect(isValidJson('{')).toBe(false)
    expect(isValidJson('undefined')).toBe(false)
    expect(isValidJson("{'key': 'value'}")).toBe(false)
    expect(isValidJson('{key: "value"}')).toBe(false)
  })
})

describe('getValueType', () => {
  it('returns "null" for null', () => {
    expect(getValueType(null)).toBe('null')
  })

  it('returns "boolean" for booleans', () => {
    expect(getValueType(true)).toBe('boolean')
    expect(getValueType(false)).toBe('boolean')
  })

  it('returns "number" for numbers', () => {
    expect(getValueType(42)).toBe('number')
    expect(getValueType(3.14)).toBe('number')
    expect(getValueType(-100)).toBe('number')
  })

  it('returns "string" for strings', () => {
    expect(getValueType('')).toBe('string')
    expect(getValueType('hello')).toBe('string')
  })

  it('returns "array" for arrays', () => {
    expect(getValueType([])).toBe('array')
    expect(getValueType([1, 2, 3])).toBe('array')
  })

  it('returns "object" for objects', () => {
    expect(getValueType({})).toBe('object')
    expect(getValueType({ key: 'value' })).toBe('object')
  })
})

describe('getValuePreview', () => {
  it('returns "null" for null', () => {
    expect(getValuePreview(null)).toBe('null')
  })

  it('returns string representation for booleans', () => {
    expect(getValuePreview(true)).toBe('true')
    expect(getValuePreview(false)).toBe('false')
  })

  it('returns string representation for numbers', () => {
    expect(getValuePreview(42)).toBe('42')
    expect(getValuePreview(3.14)).toBe('3.14')
  })

  it('returns quoted string for short strings', () => {
    expect(getValuePreview('hello')).toBe('"hello"')
  })

  it('truncates long strings', () => {
    const longString = 'a'.repeat(100)
    const preview = getValuePreview(longString, 50)
    expect(preview.length).toBeLessThanOrEqual(50)
    expect(preview).toContain('...')
  })

  it('returns Array(n) for arrays', () => {
    expect(getValuePreview([])).toBe('Array(0)')
    expect(getValuePreview([1, 2, 3])).toBe('Array(3)')
    expect(getValuePreview([1, 2, 3, 4, 5])).toBe('Array(5)')
  })

  it('returns Object(n) for objects', () => {
    expect(getValuePreview({})).toBe('Object(0)')
    expect(getValuePreview({ a: 1, b: 2 })).toBe('Object(2)')
  })
})
