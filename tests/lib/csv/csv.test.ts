import { describe, it, expect } from 'vitest'
import { 
  parseCsv, 
  stringifyCsv, 
  detectDelimiter, 
  looksLikeCsv 
} from '../../../src/lib/csv'

describe('detectDelimiter', () => {
  it('detects comma delimiter', () => {
    expect(detectDelimiter('a,b,c')).toBe(',')
  })

  it('detects semicolon delimiter', () => {
    expect(detectDelimiter('a;b;c')).toBe(';')
  })

  it('detects tab delimiter', () => {
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
  })

  it('detects pipe delimiter', () => {
    expect(detectDelimiter('a|b|c')).toBe('|')
  })

  it('defaults to comma when no delimiters found', () => {
    expect(detectDelimiter('abc')).toBe(',')
  })

  it('chooses the most common delimiter', () => {
    expect(detectDelimiter('a,b,c;d')).toBe(',')
    expect(detectDelimiter('a;b;c,d')).toBe(';')
  })
})

describe('parseCsv', () => {
  describe('basic parsing', () => {
    it('parses simple CSV', () => {
      const csv = 'name,age\nJohn,30\nJane,25'
      const result = parseCsv(csv)
      
      expect(result.headers).toEqual(['name', 'age'])
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0]).toEqual({ name: 'John', age: 30 })
      expect(result.rows[1]).toEqual({ name: 'Jane', age: 25 })
    })

    it('handles empty CSV', () => {
      const result = parseCsv('')
      expect(result.headers).toEqual([])
      expect(result.rows).toEqual([])
    })

    it('handles CSV with only headers', () => {
      const result = parseCsv('name,age')
      expect(result.headers).toEqual(['name', 'age'])
      expect(result.rows).toEqual([])
    })
  })

  describe('type inference', () => {
    it('infers numbers', () => {
      const csv = 'value\n42\n3.14\n-10'
      const result = parseCsv(csv)
      
      expect(result.rows[0]?.value).toBe(42)
      expect(result.rows[1]?.value).toBe(3.14)
      expect(result.rows[2]?.value).toBe(-10)
    })

    it('infers booleans', () => {
      const csv = 'active\ntrue\nfalse\nTRUE'
      const result = parseCsv(csv)
      
      expect(result.rows[0]?.active).toBe(true)
      expect(result.rows[1]?.active).toBe(false)
      expect(result.rows[2]?.active).toBe(true)
    })

    it('infers null', () => {
      const csv = 'value\nnull\nNULL'
      const result = parseCsv(csv)
      
      expect(result.rows[0]?.value).toBeNull()
      expect(result.rows[1]?.value).toBeNull()
    })

    it('keeps strings as strings', () => {
      const csv = 'name\nJohn\nJane'
      const result = parseCsv(csv)
      
      expect(typeof result.rows[0]?.name).toBe('string')
    })

    it('can disable type inference', () => {
      const csv = 'value\n42\ntrue'
      const result = parseCsv(csv, { inferTypes: false })
      
      expect(result.rows[0]?.value).toBe('42')
      expect(result.rows[1]?.value).toBe('true')
    })
  })

  describe('quoted values', () => {
    it('handles quoted strings', () => {
      const csv = 'name\n"John Doe"'
      const result = parseCsv(csv)
      expect(result.rows[0]?.name).toBe('John Doe')
    })

    it('handles quoted strings with commas', () => {
      const csv = 'address\n"123 Main St, Apt 4"'
      const result = parseCsv(csv)
      expect(result.rows[0]?.address).toBe('123 Main St, Apt 4')
    })

    it('handles escaped quotes', () => {
      const csv = 'quote\n"He said ""Hello"""'
      const result = parseCsv(csv)
      expect(result.rows[0]?.quote).toBe('He said "Hello"')
    })

    it('handles newlines in quoted values', () => {
      const csv = 'text\n"Line 1\nLine 2"'
      const result = parseCsv(csv)
      expect(result.rows[0]?.text).toContain('Line 1')
    })
  })

  describe('options', () => {
    it('uses custom delimiter', () => {
      const csv = 'name;age\nJohn;30'
      const result = parseCsv(csv, { delimiter: ';' })
      
      expect(result.rows[0]).toEqual({ name: 'John', age: 30 })
    })

    it('handles no header row', () => {
      const csv = 'John,30\nJane,25'
      const result = parseCsv(csv, { hasHeader: false })
      
      expect(result.headers).toEqual(['column1', 'column2'])
      expect(result.rows).toHaveLength(2)
    })

    it('skips empty lines by default', () => {
      const csv = 'name\n\nJohn\n\nJane'
      const result = parseCsv(csv)
      expect(result.rows).toHaveLength(2)
    })

    it('can include empty lines', () => {
      const csv = 'name\n\nJohn'
      const result = parseCsv(csv, { skipEmptyLines: false })
      // The empty line would produce a row with empty values
      expect(result.rows.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('edge cases', () => {
    it('handles missing values', () => {
      const csv = 'a,b,c\n1,,3'
      const result = parseCsv(csv)
      expect(result.rows[0]?.b).toBe('')
    })

    it('handles extra columns', () => {
      const csv = 'a,b\n1,2,3'
      const result = parseCsv(csv)
      // Extra column should be ignored
      expect(Object.keys(result.rows[0] ?? {})).toHaveLength(2)
    })

    it('generates column names for empty headers', () => {
      const csv = 'name,,age\nJohn,,30'
      const result = parseCsv(csv)
      expect(result.headers).toContain('column2')
    })
  })
})

describe('stringifyCsv', () => {
  describe('basic stringification', () => {
    it('converts array of objects to CSV', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ]
      const csv = stringifyCsv(data)
      
      expect(csv).toContain('name')
      expect(csv).toContain('age')
      expect(csv).toContain('John')
      expect(csv).toContain('30')
    })

    it('handles empty array', () => {
      expect(stringifyCsv([])).toBe('')
    })

    it('handles single item', () => {
      const data = [{ name: 'John' }]
      const csv = stringifyCsv(data)
      expect(csv).toContain('name')
      expect(csv).toContain('John')
    })
  })

  describe('options', () => {
    it('uses custom delimiter', () => {
      const data = [{ a: 1, b: 2 }]
      const csv = stringifyCsv(data, { delimiter: ';' })
      expect(csv).toContain(';')
    })

    it('can exclude header', () => {
      const data = [{ name: 'John' }]
      const csv = stringifyCsv(data, { includeHeader: false })
      expect(csv).not.toContain('name\n')
      expect(csv).toBe('John')
    })

    it('flattens nested objects by default', () => {
      const data = [{ user: { name: 'John' } }]
      const csv = stringifyCsv(data)
      expect(csv).toContain('user.name')
    })

    it('can disable object flattening', () => {
      const data = [{ user: { name: 'John' } }]
      const csv = stringifyCsv(data, { flattenObjects: false })
      expect(csv).toContain('user')
      expect(csv).toContain('{')
    })
  })

  describe('value formatting', () => {
    it('escapes values with commas', () => {
      const data = [{ address: '123 Main St, Apt 4' }]
      const csv = stringifyCsv(data)
      expect(csv).toContain('"123 Main St, Apt 4"')
    })

    it('escapes values with quotes', () => {
      const data = [{ quote: 'He said "Hello"' }]
      const csv = stringifyCsv(data)
      expect(csv).toContain('""')
    })

    it('handles null values', () => {
      const data = [{ value: null }]
      const csv = stringifyCsv(data)
      expect(csv.split('\n')[1]).toBe('')
    })

    it('handles boolean values', () => {
      const data = [{ active: true, enabled: false }]
      const csv = stringifyCsv(data)
      expect(csv).toContain('true')
      expect(csv).toContain('false')
    })

    it('handles arrays', () => {
      const data = [{ tags: ['a', 'b', 'c'] }]
      const csv = stringifyCsv(data)
      // Arrays are JSON stringified by default
      expect(csv).toContain('[')
    })

    it('can flatten arrays', () => {
      const data = [{ tags: ['a', 'b', 'c'] }]
      const csv = stringifyCsv(data, { flattenArrays: true })
      expect(csv).toContain('a; b; c')
    })
  })

  describe('all unique keys', () => {
    it('includes all keys from all objects', () => {
      const data = [
        { a: 1 },
        { b: 2 },
        { a: 3, c: 4 },
      ]
      const csv = stringifyCsv(data)
      expect(csv).toContain('a')
      expect(csv).toContain('b')
      expect(csv).toContain('c')
    })
  })
})

describe('looksLikeCsv', () => {
  it('returns true for CSV content', () => {
    expect(looksLikeCsv('a,b,c\n1,2,3')).toBe(true)
    expect(looksLikeCsv('name;age\nJohn;30')).toBe(true)
  })

  it('returns false for single line', () => {
    expect(looksLikeCsv('a,b,c')).toBe(false)
  })

  it('returns false for inconsistent columns', () => {
    expect(looksLikeCsv('a,b,c\n1,2')).toBe(false)
  })

  it('returns false for JSON', () => {
    expect(looksLikeCsv('{"name": "John"}')).toBe(false)
  })

  it('returns false for plain text', () => {
    expect(looksLikeCsv('Hello world\nHow are you?')).toBe(false)
  })
})
