import { describe, it, expect } from 'vitest'
import { tokenize, getTokenClass, type Token, type TokenType } from '../../../src/lib/json/tokenizer'

describe('tokenize', () => {
  const getTokenTypes = (tokens: Token[]): TokenType[] => 
    tokens.filter(t => t.type !== 'whitespace').map(t => t.type)

  const getTokenValues = (tokens: Token[]): string[] => 
    tokens.filter(t => t.type !== 'whitespace').map(t => t.value)

  describe('primitive values', () => {
    it('tokenizes null', () => {
      const tokens = tokenize('null')
      expect(getTokenTypes(tokens)).toEqual(['null'])
      expect(getTokenValues(tokens)).toEqual(['null'])
    })

    it('tokenizes boolean true', () => {
      const tokens = tokenize('true')
      expect(getTokenTypes(tokens)).toEqual(['boolean'])
      expect(getTokenValues(tokens)).toEqual(['true'])
    })

    it('tokenizes boolean false', () => {
      const tokens = tokenize('false')
      expect(getTokenTypes(tokens)).toEqual(['boolean'])
      expect(getTokenValues(tokens)).toEqual(['false'])
    })

    it('tokenizes integer', () => {
      const tokens = tokenize('42')
      expect(getTokenTypes(tokens)).toEqual(['number'])
      expect(getTokenValues(tokens)).toEqual(['42'])
    })

    it('tokenizes negative number', () => {
      const tokens = tokenize('-123')
      expect(getTokenTypes(tokens)).toEqual(['number'])
      expect(getTokenValues(tokens)).toEqual(['-123'])
    })

    it('tokenizes decimal number', () => {
      const tokens = tokenize('3.14')
      expect(getTokenTypes(tokens)).toEqual(['number'])
      expect(getTokenValues(tokens)).toEqual(['3.14'])
    })

    it('tokenizes number with exponent', () => {
      const tokens = tokenize('1.5e10')
      expect(getTokenTypes(tokens)).toEqual(['number'])
      expect(getTokenValues(tokens)).toEqual(['1.5e10'])
    })

    it('tokenizes number with negative exponent', () => {
      const tokens = tokenize('2.5e-3')
      expect(getTokenTypes(tokens)).toEqual(['number'])
      expect(getTokenValues(tokens)).toEqual(['2.5e-3'])
    })

    it('tokenizes string', () => {
      const tokens = tokenize('"hello"')
      expect(getTokenTypes(tokens)).toEqual(['string'])
      expect(getTokenValues(tokens)).toEqual(['"hello"'])
    })

    it('tokenizes string with escape sequences', () => {
      const tokens = tokenize('"hello\\nworld"')
      expect(getTokenTypes(tokens)).toEqual(['string'])
      expect(getTokenValues(tokens)).toEqual(['"hello\\nworld"'])
    })

    it('tokenizes empty string', () => {
      const tokens = tokenize('""')
      expect(getTokenTypes(tokens)).toEqual(['string'])
      expect(getTokenValues(tokens)).toEqual(['""'])
    })
  })

  describe('arrays', () => {
    it('tokenizes empty array', () => {
      const tokens = tokenize('[]')
      expect(getTokenTypes(tokens)).toEqual(['bracket-open', 'bracket-close'])
    })

    it('tokenizes array with single element', () => {
      const tokens = tokenize('[1]')
      expect(getTokenTypes(tokens)).toEqual(['bracket-open', 'number', 'bracket-close'])
    })

    it('tokenizes array with multiple elements', () => {
      const tokens = tokenize('[1, 2, 3]')
      expect(getTokenTypes(tokens)).toEqual([
        'bracket-open', 'number', 'comma', 'number', 'comma', 'number', 'bracket-close'
      ])
    })

    it('tokenizes nested arrays', () => {
      const tokens = tokenize('[[1], [2]]')
      expect(getTokenTypes(tokens)).toEqual([
        'bracket-open', 
        'bracket-open', 'number', 'bracket-close', 
        'comma', 
        'bracket-open', 'number', 'bracket-close', 
        'bracket-close'
      ])
    })
  })

  describe('objects', () => {
    it('tokenizes empty object', () => {
      const tokens = tokenize('{}')
      expect(getTokenTypes(tokens)).toEqual(['brace-open', 'brace-close'])
    })

    it('tokenizes object with single key-value pair', () => {
      const tokens = tokenize('{"key": "value"}')
      expect(getTokenTypes(tokens)).toEqual([
        'brace-open', 'key', 'colon', 'string', 'brace-close'
      ])
    })

    it('tokenizes object with multiple key-value pairs', () => {
      const tokens = tokenize('{"a": 1, "b": 2}')
      expect(getTokenTypes(tokens)).toEqual([
        'brace-open', 'key', 'colon', 'number', 'comma', 'key', 'colon', 'number', 'brace-close'
      ])
    })

    it('distinguishes keys from string values', () => {
      const tokens = tokenize('{"key": "value"}')
      const nonWhitespace = tokens.filter(t => t.type !== 'whitespace')
      expect(nonWhitespace[1]?.type).toBe('key')
      expect(nonWhitespace[3]?.type).toBe('string')
    })

    it('tokenizes nested objects', () => {
      const tokens = tokenize('{"outer": {"inner": 1}}')
      expect(getTokenTypes(tokens)).toEqual([
        'brace-open', 'key', 'colon', 
        'brace-open', 'key', 'colon', 'number', 'brace-close',
        'brace-close'
      ])
    })
  })

  describe('whitespace handling', () => {
    it('tokenizes whitespace separately', () => {
      const tokens = tokenize('{ }')
      expect(tokens).toHaveLength(3)
      expect(tokens[0]?.type).toBe('brace-open')
      expect(tokens[1]?.type).toBe('whitespace')
      expect(tokens[2]?.type).toBe('brace-close')
    })

    it('handles newlines in whitespace', () => {
      const tokens = tokenize('{\n}')
      const whitespaceToken = tokens.find(t => t.type === 'whitespace')
      expect(whitespaceToken?.value).toBe('\n')
    })

    it('handles tabs in whitespace', () => {
      const tokens = tokenize('{\t}')
      const whitespaceToken = tokens.find(t => t.type === 'whitespace')
      expect(whitespaceToken?.value).toBe('\t')
    })
  })

  describe('token positions', () => {
    it('tracks line numbers correctly', () => {
      const tokens = tokenize('{\n  "key": 1\n}')
      const keyToken = tokens.find(t => t.type === 'key')
      expect(keyToken?.line).toBe(2)
    })

    it('tracks column numbers correctly', () => {
      const tokens = tokenize('{"key": 1}')
      const keyToken = tokens.find(t => t.type === 'key')
      expect(keyToken?.column).toBe(2)
    })

    it('tracks start and end positions', () => {
      const tokens = tokenize('"hello"')
      expect(tokens[0]?.start).toBe(0)
      expect(tokens[0]?.end).toBe(7)
    })
  })

  describe('error handling', () => {
    it('marks unknown characters as error tokens', () => {
      const tokens = tokenize('{@}')
      const errorToken = tokens.find(t => t.type === 'error')
      expect(errorToken).toBeDefined()
      expect(errorToken?.value).toBe('@')
    })
  })

  describe('complex JSON', () => {
    it('tokenizes complex nested structure', () => {
      const json = '{"users": [{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]}'
      const tokens = tokenize(json)
      const types = getTokenTypes(tokens)
      
      expect(types[0]).toBe('brace-open')
      expect(types[1]).toBe('key') // "users"
      expect(types[types.length - 1]).toBe('brace-close')
    })

    it('correctly identifies all keys in nested objects', () => {
      const json = '{"a": {"b": {"c": 1}}}'
      const tokens = tokenize(json)
      const keys = tokens.filter(t => t.type === 'key')
      
      expect(keys).toHaveLength(3)
      expect(keys.map(k => k.value)).toEqual(['"a"', '"b"', '"c"'])
    })
  })
})

describe('getTokenClass', () => {
  it('returns correct class for key', () => {
    expect(getTokenClass('key')).toBe('text-syntax-key')
  })

  it('returns correct class for string', () => {
    expect(getTokenClass('string')).toBe('text-syntax-string')
  })

  it('returns correct class for number', () => {
    expect(getTokenClass('number')).toBe('text-syntax-number')
  })

  it('returns correct class for boolean', () => {
    expect(getTokenClass('boolean')).toBe('text-syntax-boolean')
  })

  it('returns correct class for null', () => {
    expect(getTokenClass('null')).toBe('text-syntax-null')
  })

  it('returns correct class for brackets and braces', () => {
    expect(getTokenClass('brace-open')).toBe('text-syntax-bracket')
    expect(getTokenClass('brace-close')).toBe('text-syntax-bracket')
    expect(getTokenClass('bracket-open')).toBe('text-syntax-bracket')
    expect(getTokenClass('bracket-close')).toBe('text-syntax-bracket')
  })

  it('returns correct class for punctuation', () => {
    expect(getTokenClass('colon')).toBe('text-syntax-punctuation')
    expect(getTokenClass('comma')).toBe('text-syntax-punctuation')
  })

  it('returns correct class for error', () => {
    expect(getTokenClass('error')).toBe('text-syntax-error')
  })

  it('returns empty string for whitespace', () => {
    expect(getTokenClass('whitespace')).toBe('')
  })
})
