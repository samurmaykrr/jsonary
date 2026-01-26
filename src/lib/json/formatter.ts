import type { JsonValue } from '@/types';
import { repairJson } from './repair';

/**
 * Formatting options
 */
export interface FormatOptions {
  indent?: number | 'tab';
  maxLineLength?: number;
  /**
   * Whether to preserve template syntax (Jinja2, Handlebars, Mustache, etc.)
   * @default true
   */
  preserveTemplates?: boolean;
  /**
   * Whether to automatically repair invalid JSON before formatting
   * @default true
   */
  autoRepair?: boolean;
}

/**
 * Template placeholder tracking information
 */
interface TemplatePlaceholder {
  placeholder: string;
  original: string;
}

/**
 * Regular expressions for detecting template syntax patterns
 */
const TEMPLATE_PATTERNS = [
  // Jinja2 variable: {{ variable }}
  /\{\{\s*[^}]+\s*\}\}/g,
  // Jinja2 statement: {% statement %}
  /\{%\s*[^%]+\s*%\}/g,
  // Jinja2 comment: {# comment #}
  /\{#\s*[^#]*\s*#\}/g,
  // Handlebars/Mustache comment: {{! comment }} or {{!-- comment --}}
  /\{\{!--[\s\S]*?--\}\}/g,
  /\{\{![^}]*\}\}/g,
];

/**
 * Extract template syntax and replace with placeholders
 * 
 * Handles both quoted and unquoted templates:
 * - "{{ var }}" → "__TEMPLATE_0__" (template inside string)
 * - {{ var }} → "__TEMPLATE_0__" (unquoted template)
 */
function extractTemplates(input: string): {
  processed: string;
  placeholders: TemplatePlaceholder[];
} {
  let processed = input;
  const placeholders: TemplatePlaceholder[] = [];
  let placeholderIndex = 0;

  for (const pattern of TEMPLATE_PATTERNS) {
    // First, handle quoted templates: "{{ ... }}"
    const quotedPattern = new RegExp(`"(${pattern.source})"`, pattern.flags);
    processed = processed.replace(quotedPattern, (fullMatch) => {
      const placeholder = `__TEMPLATE_${placeholderIndex}__`;
      placeholders.push({
        placeholder: `"${placeholder}"`,
        original: fullMatch, // Store the full match including quotes
      });
      placeholderIndex++;
      return `"${placeholder}"`;
    });

    // Then, handle unquoted templates: {{ ... }} 
    const regex = new RegExp(pattern.source, pattern.flags);
    processed = processed.replace(regex, (match) => {
      const placeholder = `__TEMPLATE_${placeholderIndex}__`;
      placeholders.push({
        placeholder: `"${placeholder}"`,
        original: match, // Store without quotes
      });
      placeholderIndex++;
      return `"${placeholder}"`;
    });
  }

  return { processed, placeholders };
}

/**
 * Restore template syntax from placeholders
 */
function restoreTemplates(
  processed: string,
  placeholders: TemplatePlaceholder[]
): string {
  let result = processed;

  for (let i = placeholders.length - 1; i >= 0; i--) {
    const { placeholder, original } = placeholders[i]!;
    // Remove quotes around placeholder and restore original
    result = result.replace(new RegExp(placeholder, 'g'), original);
  }

  return result;
}

/**
 * Check if input contains template syntax
 * 
 * Note: We create fresh regex instances to avoid issues with global flag state
 * 
 * @param input - The input string to check for template syntax
 * @returns true if template syntax is detected, false otherwise
 * 
 * @example
 * hasTemplateSyntax('{"name": "{{ user.name }}"}'); // true
 * hasTemplateSyntax('{"name": "John"}'); // false
 */
export function hasTemplateSyntax(input: string): boolean {
  return TEMPLATE_PATTERNS.some((pattern) => {
    // Create a fresh regex instance to avoid lastIndex issues with global flag
    const regex = new RegExp(pattern.source, pattern.flags);
    return regex.test(input);
  });
}

/**
 * Format JSON with indentation
 * 
 * Formats JSON with proper indentation while optionally preserving template syntax.
 * Template expressions (Jinja2, Handlebars, etc.) are temporarily replaced during
 * formatting and restored afterward to prevent them from being treated as invalid JSON.
 * 
 * @param input - The JSON string to format
 * @param options - Formatting options
 * @returns Formatted JSON string
 * 
 * @example
 * // Without templates
 * formatJson('{"name":"John","age":30}', { indent: 2 })
 * // Returns:
 * // {
 * //   "name": "John",
 * //   "age": 30
 * // }
 * 
 * // With templates
 * formatJson('{"name":"{{ user.name }}","active":true}', { indent: 2, preserveTemplates: true })
 * // Returns:
 * // {
 * //   "name": "{{ user.name }}",
 * //   "active": true
 * // }
 */
export function formatJson(input: string, options: FormatOptions = {}): string {
  const { indent = 2, preserveTemplates = true, autoRepair = true } = options;
  
  let processedInput = input;
  let templatePlaceholders: TemplatePlaceholder[] = [];
  
  // Extract templates if preservation is enabled
  if (preserveTemplates && hasTemplateSyntax(input)) {
    const extracted = extractTemplates(input);
    processedInput = extracted.processed;
    templatePlaceholders = extracted.placeholders;
  }
  
  try {
    const parsed = JSON.parse(processedInput) as JsonValue;
    const indentStr = indent === 'tab' ? '\t' : ' '.repeat(indent);
    let formatted = JSON.stringify(parsed, null, indentStr);
    
    // Restore templates if they were extracted
    if (preserveTemplates && templatePlaceholders.length > 0) {
      formatted = restoreTemplates(formatted, templatePlaceholders);
    }
    
    return formatted;
  } catch {
    // If JSON is invalid and autoRepair is enabled, try to repair first
    if (autoRepair) {
      const repaired = repairJson(input, { preserveTemplates });
      
      if (!repaired.error) {
        // Check if repair just added quotes around a plain string (not useful repair)
        // This happens when repairJson receives something like 'not json' 
        // and converts it to '"not json"'
        try {
          const parsed = JSON.parse(repaired.output);
          // If the repaired output is a primitive string that equals the input,
          // it means we just wrapped the input in quotes - not a useful repair
          if (typeof parsed === 'string' && parsed === input) {
            return input;
          }
        } catch {
          // Failed to parse repaired output, continue with formatting
        }
        
        // Successfully repaired, now format the repaired JSON
        return formatJson(repaired.output, { ...options, autoRepair: false });
      }
    }
    
    // Return original if invalid JSON and repair failed or disabled
    return input;
  }
}

/**
 * Compact JSON (minify)
 * 
 * Minifies JSON by removing all whitespace while optionally preserving template syntax.
 * 
 * @param input - The JSON string to compact
 * @param options - Formatting options (only preserveTemplates is used)
 * @returns Compacted JSON string
 */
export function compactJson(input: string, options: FormatOptions = {}): string {
  const { preserveTemplates = true } = options;
  
  let processedInput = input;
  let templatePlaceholders: TemplatePlaceholder[] = [];
  
  // Extract templates if preservation is enabled
  if (preserveTemplates && hasTemplateSyntax(input)) {
    const extracted = extractTemplates(input);
    processedInput = extracted.processed;
    templatePlaceholders = extracted.placeholders;
  }
  
  try {
    const parsed = JSON.parse(processedInput) as JsonValue;
    let compacted = JSON.stringify(parsed);
    
    // Restore templates if they were extracted
    if (preserveTemplates && templatePlaceholders.length > 0) {
      compacted = restoreTemplates(compacted, templatePlaceholders);
    }
    
    return compacted;
  } catch {
    return input;
  }
}

/**
 * Smart format - keeps small arrays/objects inline
 * 
 * Formats JSON intelligently, keeping small structures inline while preserving templates.
 * 
 * @param input - The JSON string to format
 * @param options - Formatting options
 * @returns Formatted JSON string
 */
export function smartFormatJson(input: string, options: FormatOptions = {}): string {
  const { indent = 2, maxLineLength = 80, preserveTemplates = true } = options;
  
  let processedInput = input;
  let templatePlaceholders: TemplatePlaceholder[] = [];
  
  // Extract templates if preservation is enabled
  if (preserveTemplates && hasTemplateSyntax(input)) {
    const extracted = extractTemplates(input);
    processedInput = extracted.processed;
    templatePlaceholders = extracted.placeholders;
  }
  
  try {
    const parsed = JSON.parse(processedInput) as JsonValue;
    const indentStr = indent === 'tab' ? '\t' : ' '.repeat(indent);
    let formatted = smartStringify(parsed, indentStr, maxLineLength, 0);
    
    // Restore templates if they were extracted
    if (preserveTemplates && templatePlaceholders.length > 0) {
      formatted = restoreTemplates(formatted, templatePlaceholders);
    }
    
    return formatted;
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
 * 
 * Sorts all object keys alphabetically while preserving template syntax.
 * 
 * @param input - The JSON string to sort
 * @param options - Formatting options
 * @returns JSON with sorted keys
 */
export function sortJsonKeys(input: string, options: FormatOptions = {}): string {
  const { preserveTemplates = true } = options;
  
  let processedInput = input;
  let templatePlaceholders: TemplatePlaceholder[] = [];
  
  // Extract templates if preservation is enabled
  if (preserveTemplates && hasTemplateSyntax(input)) {
    const extracted = extractTemplates(input);
    processedInput = extracted.processed;
    templatePlaceholders = extracted.placeholders;
  }
  
  try {
    const parsed = JSON.parse(processedInput) as JsonValue;
    const sorted = sortKeysDeep(parsed);
    // Don't use formatJson here as it will try to extract templates again
    const { indent = 2 } = options;
    const indentStr = indent === 'tab' ? '\t' : ' '.repeat(indent);
    let formatted = JSON.stringify(sorted, null, indentStr);
    
    // Restore templates if they were extracted
    if (preserveTemplates && templatePlaceholders.length > 0) {
      formatted = restoreTemplates(formatted, templatePlaceholders);
    }
    
    return formatted;
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
