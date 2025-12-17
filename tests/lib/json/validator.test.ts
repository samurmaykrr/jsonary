import { describe, it, expect } from 'vitest'
import { 
  validateJsonSchema, 
  isValidSchema, 
  formatPath,
  findPathLine,
  parseAndValidate
} from '../../../src/lib/json/validator'

describe('validateJsonSchema', () => {
  describe('type validation', () => {
    it('validates string type', () => {
      const schema = { type: 'string' }
      expect(validateJsonSchema('hello', schema)).toEqual([])
      expect(validateJsonSchema(123, schema).length).toBeGreaterThan(0)
    })

    it('validates number type', () => {
      const schema = { type: 'number' }
      expect(validateJsonSchema(42, schema)).toEqual([])
      expect(validateJsonSchema('42', schema).length).toBeGreaterThan(0)
    })

    it('validates boolean type', () => {
      const schema = { type: 'boolean' }
      expect(validateJsonSchema(true, schema)).toEqual([])
      expect(validateJsonSchema('true', schema).length).toBeGreaterThan(0)
    })

    it('validates array type', () => {
      const schema = { type: 'array' }
      expect(validateJsonSchema([1, 2, 3], schema)).toEqual([])
      expect(validateJsonSchema({}, schema).length).toBeGreaterThan(0)
    })

    it('validates object type', () => {
      const schema = { type: 'object' }
      expect(validateJsonSchema({}, schema)).toEqual([])
      expect(validateJsonSchema([], schema).length).toBeGreaterThan(0)
    })

    it('validates null type', () => {
      const schema = { type: 'null' }
      expect(validateJsonSchema(null, schema)).toEqual([])
      expect(validateJsonSchema('null', schema).length).toBeGreaterThan(0)
    })
  })

  describe('required properties', () => {
    it('returns error for missing required property', () => {
      const schema = {
        type: 'object',
        required: ['name', 'age'],
      }
      const errors = validateJsonSchema({ name: 'John' }, schema)
      expect(errors.length).toBe(1)
      expect(errors[0]?.keyword).toBe('required')
      expect(errors[0]?.message).toContain('age')
    })

    it('passes when all required properties exist', () => {
      const schema = {
        type: 'object',
        required: ['name', 'age'],
      }
      expect(validateJsonSchema({ name: 'John', age: 30 }, schema)).toEqual([])
    })
  })

  describe('property validation', () => {
    it('validates property types', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      }
      expect(validateJsonSchema({ name: 'John', age: 30 }, schema)).toEqual([])
      expect(validateJsonSchema({ name: 'John', age: '30' }, schema).length).toBeGreaterThan(0)
    })

    it('reports additional properties when forbidden', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: false,
      }
      const errors = validateJsonSchema({ name: 'John', extra: 'value' }, schema)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]?.keyword).toBe('additionalProperties')
    })
  })

  describe('string constraints', () => {
    it('validates minLength', () => {
      const schema = { type: 'string', minLength: 3 }
      expect(validateJsonSchema('abc', schema)).toEqual([])
      expect(validateJsonSchema('ab', schema).length).toBeGreaterThan(0)
    })

    it('validates maxLength', () => {
      const schema = { type: 'string', maxLength: 5 }
      expect(validateJsonSchema('hello', schema)).toEqual([])
      expect(validateJsonSchema('hello world', schema).length).toBeGreaterThan(0)
    })

    it('validates pattern', () => {
      const schema = { type: 'string', pattern: '^[a-z]+$' }
      expect(validateJsonSchema('hello', schema)).toEqual([])
      expect(validateJsonSchema('Hello123', schema).length).toBeGreaterThan(0)
    })
  })

  describe('number constraints', () => {
    it('validates minimum', () => {
      const schema = { type: 'number', minimum: 0 }
      expect(validateJsonSchema(0, schema)).toEqual([])
      expect(validateJsonSchema(-1, schema).length).toBeGreaterThan(0)
    })

    it('validates maximum', () => {
      const schema = { type: 'number', maximum: 100 }
      expect(validateJsonSchema(100, schema)).toEqual([])
      expect(validateJsonSchema(101, schema).length).toBeGreaterThan(0)
    })
  })

  describe('array constraints', () => {
    it('validates minItems', () => {
      const schema = { type: 'array', minItems: 2 }
      expect(validateJsonSchema([1, 2], schema)).toEqual([])
      expect(validateJsonSchema([1], schema).length).toBeGreaterThan(0)
    })

    it('validates maxItems', () => {
      const schema = { type: 'array', maxItems: 3 }
      expect(validateJsonSchema([1, 2, 3], schema)).toEqual([])
      expect(validateJsonSchema([1, 2, 3, 4], schema).length).toBeGreaterThan(0)
    })

    it('validates uniqueItems', () => {
      const schema = { type: 'array', uniqueItems: true }
      expect(validateJsonSchema([1, 2, 3], schema)).toEqual([])
      expect(validateJsonSchema([1, 2, 2], schema).length).toBeGreaterThan(0)
    })

    it('validates items schema', () => {
      const schema = {
        type: 'array',
        items: { type: 'number' },
      }
      expect(validateJsonSchema([1, 2, 3], schema)).toEqual([])
      expect(validateJsonSchema([1, '2', 3], schema).length).toBeGreaterThan(0)
    })
  })

  describe('enum validation', () => {
    it('validates enum values', () => {
      const schema = { enum: ['red', 'green', 'blue'] }
      expect(validateJsonSchema('red', schema)).toEqual([])
      expect(validateJsonSchema('yellow', schema).length).toBeGreaterThan(0)
    })
  })

  describe('nested validation', () => {
    it('validates deeply nested structures', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: {
                type: 'object',
                properties: {
                  city: { type: 'string' },
                },
              },
            },
          },
        },
      }
      
      const valid = {
        user: {
          name: 'John',
          address: { city: 'NYC' },
        },
      }
      expect(validateJsonSchema(valid, schema)).toEqual([])

      const invalid = {
        user: {
          name: 'John',
          address: { city: 123 },
        },
      }
      const errors = validateJsonSchema(invalid, schema)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]?.path).toContain('city')
    })
  })
})

describe('isValidSchema', () => {
  it('returns true for valid schemas', () => {
    expect(isValidSchema({ type: 'string' })).toBe(true)
    expect(isValidSchema({ type: 'object', properties: {} })).toBe(true)
  })

  it('returns false for invalid schemas', () => {
    expect(isValidSchema({ type: 'invalid' })).toBe(false)
    expect(isValidSchema('not an object')).toBe(false)
  })
})

describe('formatPath', () => {
  it('returns "root" for empty path', () => {
    expect(formatPath('')).toBe('root')
    expect(formatPath('/')).toBe('root')
  })

  it('formats simple paths', () => {
    expect(formatPath('/name')).toBe('name')
    expect(formatPath('/user/name')).toBe('user.name')
  })

  it('formats array indices', () => {
    expect(formatPath('/0')).toBe('[0]')
    expect(formatPath('/users/0')).toBe('users[0]')
    expect(formatPath('/users/0/name')).toBe('users[0].name')
  })

  it('handles complex paths', () => {
    expect(formatPath('/data/items/0/values/1')).toBe('data.items[0].values[1]')
  })
})

describe('findPathLine', () => {
  it('returns 1 for root path', () => {
    const json = '{"name": "John"}'
    expect(findPathLine(json, '/')).toBe(1)
    expect(findPathLine(json, '')).toBe(1)
  })

  it('finds line for simple key', () => {
    const json = `{
  "name": "John",
  "age": 30
}`
    const line = findPathLine(json, '/name')
    expect(line).toBe(2)
  })

  it('finds line for nested key', () => {
    const json = `{
  "user": {
    "name": "John"
  }
}`
    const line = findPathLine(json, '/name')
    expect(line).toBe(3)
  })

  it('returns null for non-existent path', () => {
    const json = '{"name": "John"}'
    expect(findPathLine(json, '/nonexistent')).toBeNull()
  })
})

describe('parseAndValidate', () => {
  it('returns parse error for invalid JSON', () => {
    const schema = { type: 'object' }
    const result = parseAndValidate('{invalid}', schema)
    expect('parseError' in result).toBe(true)
  })

  it('returns validation errors for valid JSON that fails schema', () => {
    const schema = { type: 'object', required: ['name'] }
    const result = parseAndValidate('{}', schema)
    expect('errors' in result).toBe(true)
    if ('errors' in result) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('returns empty errors for valid JSON matching schema', () => {
    const schema = { type: 'object', required: ['name'] }
    const result = parseAndValidate('{"name": "John"}', schema)
    expect('errors' in result).toBe(true)
    if ('errors' in result) {
      expect(result.errors).toEqual([])
    }
  })
})
