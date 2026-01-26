import { describe, it, expect } from 'vitest'
import { 
  formatJson, 
  compactJson, 
  smartFormatJson, 
  sortJsonKeys 
} from '../../../src/lib/json/formatter'

describe('formatJson', () => {
  describe('with default options', () => {
    it('formats a simple object with 2-space indent', () => {
      const input = '{"name":"John","age":30}'
      const result = formatJson(input)
      expect(result).toBe('{\n  "name": "John",\n  "age": 30\n}')
    })

    it('formats a simple array', () => {
      const input = '[1,2,3]'
      const result = formatJson(input)
      expect(result).toBe('[\n  1,\n  2,\n  3\n]')
    })

    it('formats nested objects', () => {
      const input = '{"user":{"name":"John"}}'
      const result = formatJson(input)
      expect(result).toContain('  "user"')
      expect(result).toContain('    "name"')
    })

    it('returns original string for invalid JSON', () => {
      const input = '{invalid}'
      const result = formatJson(input)
      expect(result).toBe(input)
    })
  })

  describe('with custom indent', () => {
    it('formats with 4-space indent', () => {
      const input = '{"name":"John"}'
      const result = formatJson(input, { indent: 4 })
      expect(result).toBe('{\n    "name": "John"\n}')
    })

    it('formats with tab indent', () => {
      const input = '{"name":"John"}'
      const result = formatJson(input, { indent: 'tab' })
      expect(result).toBe('{\n\t"name": "John"\n}')
    })

    it('formats with no indent (0) produces compact output', () => {
      const input = '{"name":"John"}'
      const result = formatJson(input, { indent: 0 })
      // indent: 0 with JSON.stringify produces compact output
      expect(result).toBe('{"name":"John"}')
    })
  })

  describe('edge cases', () => {
    it('formats null', () => {
      expect(formatJson('null')).toBe('null')
    })

    it('formats boolean', () => {
      expect(formatJson('true')).toBe('true')
      expect(formatJson('false')).toBe('false')
    })

    it('formats number', () => {
      expect(formatJson('42')).toBe('42')
      expect(formatJson('3.14')).toBe('3.14')
    })

    it('formats string', () => {
      expect(formatJson('"hello"')).toBe('"hello"')
    })

    it('formats empty object', () => {
      expect(formatJson('{}')).toBe('{}')
    })

    it('formats empty array', () => {
      expect(formatJson('[]')).toBe('[]')
    })
  })
})

describe('compactJson', () => {
  it('removes all whitespace from formatted JSON', () => {
    const input = `{
      "name": "John",
      "age": 30
    }`
    const result = compactJson(input)
    expect(result).toBe('{"name":"John","age":30}')
  })

  it('compacts arrays', () => {
    const input = '[\n  1,\n  2,\n  3\n]'
    const result = compactJson(input)
    expect(result).toBe('[1,2,3]')
  })

  it('compacts nested structures', () => {
    const input = `{
      "users": [
        {"name": "John"},
        {"name": "Jane"}
      ]
    }`
    const result = compactJson(input)
    expect(result).toBe('{"users":[{"name":"John"},{"name":"Jane"}]}')
  })

  it('returns original string for invalid JSON', () => {
    const input = '{invalid}'
    const result = compactJson(input)
    expect(result).toBe(input)
  })

  it('handles primitives', () => {
    expect(compactJson('null')).toBe('null')
    expect(compactJson('true')).toBe('true')
    expect(compactJson('42')).toBe('42')
    expect(compactJson('"hello"')).toBe('"hello"')
  })
})

describe('smartFormatJson', () => {
  describe('inline formatting for small values', () => {
    it('keeps small arrays inline', () => {
      const input = '{"nums":[1,2,3]}'
      const result = smartFormatJson(input)
      expect(result).toContain('[1, 2, 3]')
    })

    it('keeps small objects inline', () => {
      const input = '{"point":{"x":1,"y":2}}'
      const result = smartFormatJson(input)
      // Small object should stay inline
      expect(result).toMatch(/\{ "x": 1, "y": 2 \}/)
    })

    it('keeps empty arrays inline', () => {
      const input = '{"items":[]}'
      const result = smartFormatJson(input)
      expect(result).toContain('[]')
    })

    it('keeps empty objects inline', () => {
      const input = '{"config":{}}'
      const result = smartFormatJson(input)
      expect(result).toContain('{}')
    })
  })

  describe('multi-line formatting for large values', () => {
    it('breaks long arrays across lines', () => {
      const input = '{"data":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]}'
      const result = smartFormatJson(input)
      expect(result).toContain('\n')
    })

    it('breaks objects with many keys across lines', () => {
      const input = '{"a":1,"b":2,"c":3,"d":4,"e":5,"f":6,"g":7,"h":8,"i":9,"j":10}'
      const result = smartFormatJson(input)
      expect(result).toContain('\n')
    })
  })

  describe('with custom maxLineLength', () => {
    it('respects shorter maxLineLength', () => {
      const input = '{"nums":[1,2,3]}'
      const result = smartFormatJson(input, { maxLineLength: 10 })
      expect(result).toContain('\n')
    })

    it('respects longer maxLineLength', () => {
      const input = '{"nums":[1,2,3,4,5]}'
      const result = smartFormatJson(input, { maxLineLength: 100 })
      // Should stay inline with high maxLineLength
      expect(result.split('\n').length).toBeLessThanOrEqual(3)
    })
  })

  describe('edge cases', () => {
    it('returns original string for invalid JSON', () => {
      const input = '{invalid}'
      const result = smartFormatJson(input)
      expect(result).toBe(input)
    })

    it('formats primitives correctly', () => {
      expect(smartFormatJson('null')).toBe('null')
      expect(smartFormatJson('true')).toBe('true')
      expect(smartFormatJson('42')).toBe('42')
      expect(smartFormatJson('"hello"')).toBe('"hello"')
    })
  })
})

describe('sortJsonKeys', () => {
  it('sorts object keys alphabetically', () => {
    const input = '{"zebra":1,"apple":2,"mango":3}'
    const result = sortJsonKeys(input)
    const parsed = JSON.parse(result)
    expect(Object.keys(parsed)).toEqual(['apple', 'mango', 'zebra'])
  })

  it('sorts nested object keys', () => {
    const input = '{"outer":{"zebra":1,"apple":2}}'
    const result = sortJsonKeys(input)
    const parsed = JSON.parse(result)
    expect(Object.keys(parsed.outer)).toEqual(['apple', 'zebra'])
  })

  it('sorts keys in objects within arrays', () => {
    const input = '[{"b":1,"a":2},{"d":3,"c":4}]'
    const result = sortJsonKeys(input)
    const parsed = JSON.parse(result)
    expect(Object.keys(parsed[0])).toEqual(['a', 'b'])
    expect(Object.keys(parsed[1])).toEqual(['c', 'd'])
  })

  it('does not affect array order', () => {
    const input = '[3,1,2]'
    const result = sortJsonKeys(input)
    const parsed = JSON.parse(result)
    expect(parsed).toEqual([3, 1, 2])
  })

  it('handles deeply nested structures', () => {
    const input = '{"z":{"y":{"x":{"b":1,"a":2}}}}'
    const result = sortJsonKeys(input)
    const parsed = JSON.parse(result)
    expect(Object.keys(parsed.z.y.x)).toEqual(['a', 'b'])
  })

  it('preserves primitives', () => {
    expect(JSON.parse(sortJsonKeys('null'))).toBe(null)
    expect(JSON.parse(sortJsonKeys('true'))).toBe(true)
    expect(JSON.parse(sortJsonKeys('42'))).toBe(42)
    expect(JSON.parse(sortJsonKeys('"hello"'))).toBe('hello')
  })

  it('returns original string for invalid JSON', () => {
    const input = '{invalid}'
    const result = sortJsonKeys(input)
    expect(result).toBe(input)
  })

  it('applies formatting options', () => {
    const input = '{"b":1,"a":2}'
    const result = sortJsonKeys(input, { indent: 4 })
    expect(result).toContain('    ')
  })
})

describe('formatJson with autoRepair', () => {
  it('automatically repairs invalid JSON with templates before formatting', () => {
    const input = '{"data": {{ data | tojson }}, "count": 5}';
    const result = formatJson(input, { indent: 2, preserveTemplates: true, autoRepair: true });
    
    // Should be formatted with newlines
    expect(result).toMatch(/\n/);
    // Should preserve the template
    expect(result).toContain('{{ data | tojson }}');
    // Should be valid JSON structure (with template preserved)
    expect(result).toContain('"data"');
    expect(result).toContain('"count"');
  });

  it('repairs missing quotes on keys', () => {
    const input = '{name: {{ user_name }}, age: 30}';
    const result = formatJson(input, { indent: 2, autoRepair: true });
    
    expect(result).toContain('"name"');
    expect(result).toContain('"age"');
    expect(result).toContain('{{ user_name }}');
  });

  it('repairs trailing commas', () => {
    const input = '{"name": {{ user }}, "age": 30,}';
    const result = formatJson(input, { indent: 2, autoRepair: true });
    
    expect(result).not.toMatch(/,\s*}/);
    expect(result).toContain('{{ user }}');
  });

  it('can disable autoRepair', () => {
    const input = '{invalid json}';
    const result = formatJson(input, { autoRepair: false });
    
    // Should return original when autoRepair is disabled
    expect(result).toBe(input);
  });

  it('returns original if repair fails', () => {
    const input = 'completely broken { [ }';
    const result = formatJson(input, { autoRepair: true });
    
    // Should return original if repair completely fails
    expect(result).toBe(input);
  });
});
