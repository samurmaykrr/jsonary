import { describe, it, expect } from 'vitest'
import { formatJson, compactJson, smartFormatJson, hasTemplateSyntax } from '../../../src/lib/json/formatter'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('formatter with long-af-json.json', () => {
  const filePath = join(process.cwd(), 'long-af-json.json')
  let input: string

  try {
    input = readFileSync(filePath, 'utf8')
  } catch {
    // Skip tests if file doesn't exist
    input = ''
  }

  const hasFile = input.length > 0

  it('should detect template syntax in the file', () => {
    if (!hasFile) return
    expect(hasTemplateSyntax(input)).toBe(true)
  })

  it('should format the JSON with proper indentation', () => {
    if (!hasFile) return
    const formatted = formatJson(input, { indent: 2 })
    expect(formatted).not.toBe(input) // Should be different (formatted)
    expect(formatted.split('\n').length).toBeGreaterThan(1) // Should have multiple lines
    expect(() => JSON.parse(formatted)).not.toThrow() // Should be valid JSON
  })

  it('should compact the JSON', () => {
    if (!hasFile) return
    const compacted = compactJson(input)
    expect(compacted.length).toBeLessThanOrEqual(input.length)
    expect(() => JSON.parse(compacted)).not.toThrow()
  })

  it('should smart format the JSON', () => {
    if (!hasFile) return
    const smartFormatted = smartFormatJson(input, { maxLineLength: 80 })
    expect(() => JSON.parse(smartFormatted)).not.toThrow()
  })

  it('should preserve Jinja templates after formatting', () => {
    if (!hasFile) return
    const formatted = formatJson(input, { indent: 2, preserveTemplates: true })
    // The file contains {{data.payload.firstName}}
    expect(formatted).toContain('{{')
    expect(formatted).toContain('}}')
  })
})
