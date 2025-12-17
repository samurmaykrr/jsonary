import type { JsonValue } from '@/types';

/**
 * Formatting options
 */
export interface FormatOptions {
  indent?: number | 'tab';
  maxLineLength?: number;
}

/**
 * Format JSON with indentation
 */
export function formatJson(input: string, options: FormatOptions = {}): string {
  const { indent = 2 } = options;
  
  try {
    const parsed = JSON.parse(input) as JsonValue;
    const indentStr = indent === 'tab' ? '\t' : ' '.repeat(indent);
    return JSON.stringify(parsed, null, indentStr);
  } catch {
    // Return original if invalid JSON
    return input;
  }
}

/**
 * Compact JSON (minify)
 */
export function compactJson(input: string): string {
  try {
    const parsed = JSON.parse(input) as JsonValue;
    return JSON.stringify(parsed);
  } catch {
    return input;
  }
}

/**
 * Smart format - keeps small arrays/objects inline
 */
export function smartFormatJson(input: string, options: FormatOptions = {}): string {
  const { indent = 2, maxLineLength = 80 } = options;
  
  try {
    const parsed = JSON.parse(input) as JsonValue;
    const indentStr = indent === 'tab' ? '\t' : ' '.repeat(indent);
    return smartStringify(parsed, indentStr, maxLineLength, 0);
  } catch {
    return input;
  }
}

/**
 * Smart stringify with inline small values
 */
function smartStringify(
  value: JsonValue,
  indentStr: string,
  maxLineLength: number,
  depth: number
): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  
  const currentIndent = indentStr.repeat(depth);
  const nextIndent = indentStr.repeat(depth + 1);
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    
    // Try inline first
    const inline = '[' + value.map(v => smartStringify(v, indentStr, maxLineLength, depth + 1)).join(', ') + ']';
    if (inline.length <= maxLineLength && !inline.includes('\n')) {
      return inline;
    }
    
    // Multi-line
    const items = value.map(v => nextIndent + smartStringify(v, indentStr, maxLineLength, depth + 1));
    return '[\n' + items.join(',\n') + '\n' + currentIndent + ']';
  }
  
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    
    // Try inline first
    const inlineParts = keys.map(k => `${JSON.stringify(k)}: ${smartStringify(value[k] as JsonValue, indentStr, maxLineLength, depth + 1)}`);
    const inline = '{ ' + inlineParts.join(', ') + ' }';
    if (inline.length <= maxLineLength && !inline.includes('\n')) {
      return inline;
    }
    
    // Multi-line
    const items = keys.map(k => {
      const formattedValue = smartStringify(value[k] as JsonValue, indentStr, maxLineLength, depth + 1);
      return `${nextIndent}${JSON.stringify(k)}: ${formattedValue}`;
    });
    return '{\n' + items.join(',\n') + '\n' + currentIndent + '}';
  }
  
  return String(value);
}

/**
 * Sort object keys alphabetically
 */
export function sortJsonKeys(input: string, options: FormatOptions = {}): string {
  try {
    const parsed = JSON.parse(input) as JsonValue;
    const sorted = sortKeysDeep(parsed);
    return formatJson(JSON.stringify(sorted), options);
  } catch {
    return input;
  }
}

/**
 * Recursively sort object keys
 */
function sortKeysDeep(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  
  const sorted: Record<string, JsonValue> = {};
  const keys = Object.keys(value).sort();
  
  for (const key of keys) {
    sorted[key] = sortKeysDeep(value[key] as JsonValue);
  }
  
  return sorted;
}
