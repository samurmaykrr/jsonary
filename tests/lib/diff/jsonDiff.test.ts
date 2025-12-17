import { describe, it, expect } from 'vitest'
import { 
  diffJson, 
  diffLines, 
  formatDiffEntry, 
  getDiffSummary 
} from '../../../src/lib/diff/jsonDiff'

describe('diffJson', () => {
  describe('identical values', () => {
    it('returns empty array for identical objects', () => {
      const obj = { name: 'John', age: 30 }
      expect(diffJson(obj, obj)).toEqual([])
    })

    it('returns empty array for identical arrays', () => {
      const arr = [1, 2, 3]
      expect(diffJson(arr, arr)).toEqual([])
    })

    it('returns empty array for identical primitives', () => {
      expect(diffJson('hello', 'hello')).toEqual([])
      expect(diffJson(42, 42)).toEqual([])
      expect(diffJson(true, true)).toEqual([])
      expect(diffJson(null, null)).toEqual([])
    })
  })

  describe('type changes', () => {
    it('detects type change from object to array', () => {
      const diffs = diffJson({}, [])
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.type).toBe('changed')
    })

    it('detects type change from string to number', () => {
      const diffs = diffJson('42', 42)
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.type).toBe('changed')
    })

    it('detects type change from null to object', () => {
      const diffs = diffJson(null, {})
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.type).toBe('changed')
    })
  })

  describe('object differences', () => {
    it('detects added keys', () => {
      const old = { a: 1 }
      const new_ = { a: 1, b: 2 }
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.type).toBe('added')
      expect(diffs[0]?.path).toBe('b')
      expect(diffs[0]?.newValue).toBe(2)
    })

    it('detects removed keys', () => {
      const old = { a: 1, b: 2 }
      const new_ = { a: 1 }
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.type).toBe('removed')
      expect(diffs[0]?.path).toBe('b')
      expect(diffs[0]?.oldValue).toBe(2)
    })

    it('detects changed values', () => {
      const old = { a: 1 }
      const new_ = { a: 2 }
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.type).toBe('changed')
      expect(diffs[0]?.path).toBe('a')
      expect(diffs[0]?.oldValue).toBe(1)
      expect(diffs[0]?.newValue).toBe(2)
    })

    it('handles nested objects', () => {
      const old = { user: { name: 'John' } }
      const new_ = { user: { name: 'Jane' } }
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.path).toBe('user.name')
      expect(diffs[0]?.type).toBe('changed')
    })

    it('detects multiple differences', () => {
      const old = { a: 1, b: 2, c: 3 }
      const new_ = { a: 1, b: 5, d: 4 }
      const diffs = diffJson(old, new_)
      
      const summary = getDiffSummary(diffs)
      expect(summary.changed).toBe(1) // b changed
      expect(summary.removed).toBe(1) // c removed
      expect(summary.added).toBe(1)   // d added
    })
  })

  describe('array differences', () => {
    it('detects added items', () => {
      const old = [1, 2]
      const new_ = [1, 2, 3]
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.type).toBe('added')
      expect(diffs[0]?.path).toBe('[2]')
    })

    it('detects removed items', () => {
      const old = [1, 2, 3]
      const new_ = [1, 2]
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.type).toBe('removed')
      expect(diffs[0]?.path).toBe('[2]')
    })

    it('detects changed items', () => {
      const old = [1, 2, 3]
      const new_ = [1, 5, 3]
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.type).toBe('changed')
      expect(diffs[0]?.path).toBe('[1]')
    })

    it('handles nested arrays', () => {
      const old = [[1, 2], [3, 4]]
      const new_ = [[1, 2], [3, 5]]
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.path).toBe('[1][1]')
    })

    it('handles arrays of objects', () => {
      const old = [{ id: 1, name: 'John' }]
      const new_ = [{ id: 1, name: 'Jane' }]
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.path).toBe('[0].name')
    })
  })

  describe('complex structures', () => {
    it('handles deep nesting', () => {
      const old = { a: { b: { c: { d: 1 } } } }
      const new_ = { a: { b: { c: { d: 2 } } } }
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.path).toBe('a.b.c.d')
    })

    it('handles mixed structures', () => {
      const old = {
        users: [
          { name: 'John', tags: ['admin'] },
        ],
      }
      const new_ = {
        users: [
          { name: 'John', tags: ['admin', 'user'] },
        ],
      }
      const diffs = diffJson(old, new_)
      
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.type).toBe('added')
    })
  })
})

describe('diffLines', () => {
  it('returns empty for identical text', () => {
    const text = 'line 1\nline 2'
    const diffs = diffLines(text, text)
    expect(diffs.every(d => d.type === 'unchanged')).toBe(true)
  })

  it('detects added lines', () => {
    const old = 'line 1\nline 2'
    const new_ = 'line 1\nline 2\nline 3'
    const diffs = diffLines(old, new_)
    
    const added = diffs.filter(d => d.type === 'added')
    expect(added).toHaveLength(1)
    expect(added[0]?.content).toBe('line 3')
  })

  it('detects removed lines', () => {
    const old = 'line 1\nline 2\nline 3'
    const new_ = 'line 1\nline 2'
    const diffs = diffLines(old, new_)
    
    const removed = diffs.filter(d => d.type === 'removed')
    expect(removed).toHaveLength(1)
    expect(removed[0]?.content).toBe('line 3')
  })

  it('detects changed lines', () => {
    const old = 'line 1\nline 2'
    const new_ = 'line 1\nLINE 2'
    const diffs = diffLines(old, new_)
    
    // A changed line shows as removed then added
    const removed = diffs.filter(d => d.type === 'removed')
    const added = diffs.filter(d => d.type === 'added')
    expect(removed.length).toBeGreaterThan(0)
    expect(added.length).toBeGreaterThan(0)
  })
})

describe('formatDiffEntry', () => {
  it('formats added entry', () => {
    const entry = { path: 'name', type: 'added' as const, newValue: 'John' }
    expect(formatDiffEntry(entry)).toBe('+ name: "John"')
  })

  it('formats removed entry', () => {
    const entry = { path: 'name', type: 'removed' as const, oldValue: 'John' }
    expect(formatDiffEntry(entry)).toBe('- name: "John"')
  })

  it('formats changed entry', () => {
    const entry = { 
      path: 'age', 
      type: 'changed' as const, 
      oldValue: 30, 
      newValue: 31 
    }
    expect(formatDiffEntry(entry)).toBe('~ age: 30 → 31')
  })

  it('formats unchanged entry', () => {
    const entry = { path: 'name', type: 'unchanged' as const }
    expect(formatDiffEntry(entry)).toBe('  name')
  })
})

describe('getDiffSummary', () => {
  it('counts added entries', () => {
    const diffs = [
      { path: 'a', type: 'added' as const, newValue: 1 },
      { path: 'b', type: 'added' as const, newValue: 2 },
    ]
    const summary = getDiffSummary(diffs)
    expect(summary.added).toBe(2)
    expect(summary.total).toBe(2)
  })

  it('counts removed entries', () => {
    const diffs = [
      { path: 'a', type: 'removed' as const, oldValue: 1 },
    ]
    const summary = getDiffSummary(diffs)
    expect(summary.removed).toBe(1)
  })

  it('counts changed entries', () => {
    const diffs = [
      { path: 'a', type: 'changed' as const, oldValue: 1, newValue: 2 },
      { path: 'b', type: 'changed' as const, oldValue: 3, newValue: 4 },
    ]
    const summary = getDiffSummary(diffs)
    expect(summary.changed).toBe(2)
  })

  it('handles mixed diffs', () => {
    const diffs = [
      { path: 'a', type: 'added' as const, newValue: 1 },
      { path: 'b', type: 'removed' as const, oldValue: 2 },
      { path: 'c', type: 'changed' as const, oldValue: 3, newValue: 4 },
    ]
    const summary = getDiffSummary(diffs)
    expect(summary.added).toBe(1)
    expect(summary.removed).toBe(1)
    expect(summary.changed).toBe(1)
    expect(summary.total).toBe(3)
  })

  it('handles empty diffs', () => {
    const summary = getDiffSummary([])
    expect(summary.added).toBe(0)
    expect(summary.removed).toBe(0)
    expect(summary.changed).toBe(0)
    expect(summary.total).toBe(0)
  })
})
