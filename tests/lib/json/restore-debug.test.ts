import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('restoreTemplates debug', () => {
  const filePath = join(process.cwd(), 'long-af-json.json')
  let input: string

  try {
    input = readFileSync(filePath, 'utf8')
  } catch {
    input = ''
  }

  const hasFile = input.length > 0

  it('should debug restoreTemplates', () => {
    if (!hasFile) return
    
    // Simulate extraction
    const placeholder = '"__TEMPLATE_0__"'
    const original = '{{data.payload.lastName}}'
    
    // Create a fake processed string
    const processed = '{"name": "__TEMPLATE_0__", "age": 30}'
    
    console.log('\n=== RESTORE DEBUG ===')
    console.log('Placeholder:', placeholder)
    console.log('Original:', original)
    console.log('Processed:', processed)
    
    // Try the restore regex
    const regex = new RegExp(placeholder, 'g')
    console.log('Regex:', regex)
    
    const result = processed.replace(regex, original)
    console.log('Result:', result)
    console.log('Replaced:', result !== processed)
    
    // Try with the actual placeholder pattern
    const placeholder2 = '"__TEMPLATE_0__"'
    const regex2 = new RegExp(placeholder2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    console.log('\nWith escaped regex:')
    console.log('Escaped regex:', regex2)
    const result2 = processed.replace(regex2, original)
    console.log('Result:', result2)
    
    expect(true).toBe(true)
  })
})
