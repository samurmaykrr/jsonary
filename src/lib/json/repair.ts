/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * JSON REPAIR MODULE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Comprehensive JSON repair system that automatically fixes 30+ types of broken
 * JSON patterns. Built on top of the `jsonrepair` library with custom preprocessing
 * for edge cases.
 *
 * CAPABILITIES:
 *
 * 1. QUOTES & STRINGS
 *    ✓ Unquoted keys: {name: "John"} → {"name": "John"}
 *    ✓ Single quotes: {'name': 'John'} → {"name": "John"}
 *    ✓ Smart/curly quotes: {"name": "John"} → {"name": "John"}
 *    ✓ Stringified JSON: "{\"key\":\"value\"}" → {"key":"value"}
 *    ✓ Literal newlines/tabs → properly escaped sequences
 *
 * 2. MISSING ELEMENTS
 *    ✓ Missing commas: {"a": 1 "b": 2} → {"a": 1, "b": 2}
 *    ✓ Missing quotes: {name: John} → {"name": "John"}
 *    ✓ Missing closing brackets: [1, 2, 3 → [1, 2, 3]
 *    ✓ Truncated JSON: completes cut-off documents
 *
 * 3. EXTRA ELEMENTS
 *    ✓ Trailing commas: [1, 2, 3,] → [1, 2, 3]
 *    ✓ Line comments: // comment
 *    ✓ Block comments: /* comment *\/
 *    ✓ Ellipsis: [1, 2, ...] → [1, 2]
 *
 * 4. FORMAT WRAPPERS
 *    ✓ Markdown code fences: ```json {...} ``` → {...}
 *    ✓ JSONP: callback({...}) → {...}
 *    ✓ NDJSON: newline-delimited → array
 *    ✓ Multiple objects: "a": {...}, {...} → "a": [{...}, {...}]
 *
 * 5. LANGUAGE-SPECIFIC
 *    ✓ Python literals: True/False/None → true/false/null
 *    ✓ JavaScript undefined → null
 *    ✓ MongoDB types: NumberLong(2), ISODate("...")
 *    ✓ Numeric keys: {1: "one"} → {"1": "one"}
 *    ✓ Special whitespace: non-breaking spaces, etc.
 *
 * 6. NUMBER FORMATS
 *    ✓ Hexadecimal: 0xFF → string
 *    ✓ NaN/Infinity → strings
 *
 * ARCHITECTURE:
 *
 * Repair Pipeline:
 *   Input → Unescape Stringified → Wrap Multiple Objects → jsonrepair → Output
 *
 * 1. unescapeStringifiedJson() - Detects and unescapes double-escaped JSON
 * 2. fixMultipleObjects() - Wraps multiple root objects in an array
 * 3. jsonrepair() - Applies 25+ general repair patterns
 *
 * Each stage is optional and configurable via RepairOptions.
 *
 * USAGE:
 *
 * ```typescript
 * // Basic repair
 * const result = repairJson(brokenJson);
 * if (result.wasRepaired) {
 *   console.log(result.output); // Fixed JSON
 * }
 *
 * // With options and change tracking
 * const result = repairJson(brokenJson, {
 *   unescapeStringified: true,
 *   wrapMultipleObjects: true,
 *   trackChanges: true
 * });
 *
 * console.log(result.changes); // List of repairs made
 *
 * // Get suggestions without repairing
 * const suggestions = suggestRepairs(brokenJson);
 * // ["Replace single quotes", "Remove trailing commas", ...]
 *
 * // Full diagnostics
 * const { result, suggestions, canRepair } = repairJsonWithDiagnostics(brokenJson);
 * ```
 *
 * TESTING:
 * - 55 comprehensive test cases in tests/lib/json/repair.test.ts
 * - Covers all 30+ repair patterns
 * - Tests for options, suggestions, and diagnostics APIs
 *
 * DEPENDENCIES:
 * - jsonrepair@3.13.1 - Core repair engine with streaming support
 *
 * @module repair
 * @see https://github.com/josdejong/jsonrepair
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { jsonrepair } from 'jsonrepair';

/**
 * Result returned from JSON repair operations
 *
 * @property output - The repaired JSON string (or original if repair failed)
 * @property wasRepaired - Whether any repairs were made
 * @property error - Error message if repair failed, null otherwise
 * @property changes - List of changes made (only if trackChanges option was true)
 */
export interface RepairResult {
  output: string;
  wasRepaired: boolean;
  error: string | null;
  changes?: RepairChange[];
}

/**
 * Describes a change made during repair
 */
export interface RepairChange {
  type: 'unescaped_stringified' | 'wrapped_multiple_objects' | 'general_repair';
  description: string;
}

/**
 * Options for JSON repair
 */
export interface RepairOptions {
  /**
   * Whether to unescape stringified JSON (e.g., "{\\"key\\":\\"value\\"}")
   * @default true
   */
  unescapeStringified?: boolean;

  /**
   * Whether to wrap multiple objects at the same level in an array
   * @default true
   */
  wrapMultipleObjects?: boolean;

  /**
   * Whether to track changes made during repair
   * @default false
   */
  trackChanges?: boolean;
}

/**
 * Fix JSON with multiple objects/arrays at the same level by wrapping them in an array
 * Handles cases like: "a": {...}, {...} -> "a": [{...}, {...}]
 */
function fixMultipleObjects(input: string): string {
  // Parse character by character to handle nested structures
  let result = '';
  let i = 0;
  let inString = false;
  let escape = false;

  // Track where we are: object depth, after colon, etc.
  const stack: Array<{ type: 'object' | 'array'; depth: number }> = [];
  let afterColon = false;
  let colonPos = -1;

  while (i < input.length) {
    const char = input[i]!;

    // Handle escape in strings
    if (escape) {
      result += char;
      escape = false;
      i++;
      continue;
    }

    if (inString && char === '\\') {
      result += char;
      escape = true;
      i++;
      continue;
    }

    // Handle string boundaries
    if (char === '"') {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    if (inString) {
      result += char;
      i++;
      continue;
    }

    // Track object/array depth
    if (char === '{') {
      if (afterColon && colonPos >= 0) {
        // Check if we need to wrap: look ahead for }, {pattern
        const needsWrapping = checkNeedsArrayWrapping(input, i);
        if (needsWrapping) {
          result += '[';
        }
        afterColon = false;
      }
      stack.push({ type: 'object', depth: stack.length });
      result += char;
      i++;
      continue;
    }

    if (char === '[') {
      afterColon = false;
      stack.push({ type: 'array', depth: stack.length });
      result += char;
      i++;
      continue;
    }

    if (char === '}') {
      const ctx = stack.pop();
      result += char;

      // Check if we need to close an array we inserted
      if (ctx?.type === 'object') {
        const needsClosing = checkNeedsArrayClosing(result, colonPos);
        if (needsClosing) {
          result += ']';
        }
      }
      i++;
      continue;
    }

    if (char === ']') {
      stack.pop();
      result += char;
      i++;
      continue;
    }

    if (char === ':') {
      colonPos = result.length;
      afterColon = true;
      result += char;
      i++;
      continue;
    }

    if (char === ',') {
      afterColon = false;
      result += char;
      i++;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Check if we need to wrap the upcoming value in an array
 * Detects pattern: {...}, {...} or {...}, [...]
 */
function checkNeedsArrayWrapping(input: string, startPos: number): boolean {
  let depth = 0;
  let i = startPos;
  let foundFirstClose = false;

  while (i < input.length) {
    const char = input[i]!;

    if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0 && !foundFirstClose) {
        foundFirstClose = true;
      } else if (depth === 0 && foundFirstClose) {
        return false;
      }
    } else if (char === ',' && depth === 0 && foundFirstClose) {
      // Found comma after first object/array closes
      // Check if next non-whitespace is { or [
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j]!)) {
        j++;
      }
      if (j < input.length && (input[j] === '{' || input[j] === '[')) {
        return true;
      }
      return false;
    }

    i++;
  }

  return false;
}

/**
 * Check if we opened an array wrapper that needs closing
 */
function checkNeedsArrayClosing(result: string, colonPos: number): boolean {
  if (colonPos < 0) return false;

  // Look backwards from current position to find if we inserted a [
  let depth = 0;
  let foundOpenBracket = false;

  for (let i = result.length - 1; i > colonPos; i--) {
    const char = result[i]!;

    if (char === '}' || char === ']') {
      depth++;
    } else if (char === '{' || char === '[') {
      depth--;
      if (depth < 0 && char === '[') {
        foundOpenBracket = true;
        break;
      }
    }
  }

  return foundOpenBracket;
}

/**
 * Detect and unescape stringified JSON
 * Handles cases like: "{\\"key\\":\\"value\\"}" -> {"key":"value"}
 */
function unescapeStringifiedJson(input: string): string {
  const trimmed = input.trim();

  // Check if the entire input is a quoted string
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      // Try to parse it as a string first
      const unescaped = JSON.parse(trimmed);

      // If it's a string and looks like JSON, return the unescaped version
      if (typeof unescaped === 'string') {
        const innerTrimmed = unescaped.trim();
        if (
          (innerTrimmed.startsWith('{') && innerTrimmed.endsWith('}')) ||
          (innerTrimmed.startsWith('[') && innerTrimmed.endsWith(']'))
        ) {
          return unescaped;
        }
      }
    } catch {
      // Not a valid string literal, continue with original
    }
  }

  return input;
}

/**
 * Attempt to repair malformed JSON with comprehensive pattern support
 *
 * Handles Common Broken Patterns:
 *
 * **Quotes & Strings:**
 * - Unquoted keys: {name: "John"} → {"name": "John"}
 * - Single quotes: {'name': 'John'} → {"name": "John"}
 * - Smart/curly quotes: {"name": "John"} → {"name": "John"}
 * - Stringified JSON: "{\"key\":\"value\"}" → {"key":"value"}
 * - Literal newlines/tabs: converts to proper escape sequences
 *
 * **Missing Elements:**
 * - Missing commas: {"a": 1 "b": 2} → {"a": 1, "b": 2}
 * - Missing quotes: {name: John} → {"name": "John"}
 * - Missing closing brackets: [1, 2, 3 → [1, 2, 3]
 * - Truncated JSON: completes cut-off documents
 *
 * **Extra Elements:**
 * - Trailing commas: [1, 2, 3,] → [1, 2, 3]
 * - Comments: // and slash-star star-slash style
 * - Ellipsis: [1, 2, etc.] → [1, 2]
 *
 * **Format Wrappers:**
 * - Markdown code fences: ```json {...} ``` → {...}
 * - JSONP: callback({...}) → {...}
 * - NDJSON: converts newline-delimited to array
 * - Multiple objects: "a": {...}, {...} → "a": [{...}, {...}]
 *
 * **Language-Specific:**
 * - Python literals: True/False/None → true/false/null
 * - JavaScript undefined → null
 * - MongoDB types: NumberLong(2), ISODate("...")
 * - Numeric keys: {1: "one"} → {"1": "one"}
 * - Special whitespace: non-breaking spaces, etc.
 *
 * **Number Formats:**
 * - Hexadecimal: 0xFF (converted to string)
 * - NaN/Infinity: converted to strings
 *
 * **Edge Cases:**
 * - Mixed quote types in same document
 * - Deeply nested structures
 * - Large documents (streaming support)
 */
export function repairJson(input: string, options?: RepairOptions): RepairResult {
  const opts: Required<RepairOptions> = {
    unescapeStringified: options?.unescapeStringified ?? true,
    wrapMultipleObjects: options?.wrapMultipleObjects ?? true,
    trackChanges: options?.trackChanges ?? false,
  };

  let preprocessed = input;
  const changes: RepairChange[] = [];

  // Try to detect and fix stringified JSON (e.g., "{\\"key\\":\\"value\\"}")
  if (opts.unescapeStringified) {
    const unescaped = unescapeStringifiedJson(preprocessed);
    if (unescaped !== preprocessed) {
      preprocessed = unescaped;
      if (opts.trackChanges) {
        changes.push({
          type: 'unescaped_stringified',
          description: 'Unescaped stringified JSON (removed double-escaping)',
        });
      }
    }
  }

  // Check if it's already valid after unescaping
  try {
    JSON.parse(preprocessed);
    return {
      output: preprocessed,
      wasRepaired: preprocessed !== input,
      error: null,
      changes: opts.trackChanges ? changes : undefined,
    };
  } catch {
    // Not valid, continue to repair
  }

  // Pre-process to fix multiple objects at same level
  if (opts.wrapMultipleObjects) {
    const wrapped = fixMultipleObjects(preprocessed);
    if (wrapped !== preprocessed) {
      preprocessed = wrapped;
      if (opts.trackChanges) {
        changes.push({
          type: 'wrapped_multiple_objects',
          description: 'Wrapped multiple objects at same level in an array',
        });
      }
    }
  }

  try {
    const output = jsonrepair(preprocessed);
    const wasGeneralRepair = output !== preprocessed;

    if (wasGeneralRepair && opts.trackChanges) {
      changes.push({
        type: 'general_repair',
        description: 'Applied general JSON repairs (quotes, commas, brackets, etc.)',
      });
    }

    return {
      output,
      wasRepaired: output !== input,
      error: null,
      changes: opts.trackChanges ? changes : undefined,
    };
  } catch (e) {
    return {
      output: input,
      wasRepaired: false,
      error: e instanceof Error ? e.message : 'Unknown repair error',
      changes: opts.trackChanges ? changes : undefined,
    };
  }
}

/**
 * Check if JSON can be repaired
 */
export function canRepairJson(input: string): boolean {
  try {
    JSON.parse(input);
    return false; // Already valid
  } catch {
    try {
      jsonrepair(input);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Analyze JSON and suggest what repairs might be needed
 */
export function suggestRepairs(input: string): string[] {
  const suggestions: string[] = [];

  // Check for stringified JSON first (before parse check)
  if (input.trim().startsWith('"') && input.trim().endsWith('"')) {
    try {
      const unescaped = JSON.parse(input);
      if (typeof unescaped === 'string' && (unescaped.trim().startsWith('{') || unescaped.trim().startsWith('['))) {
        suggestions.push('Unescape stringified JSON');
        // Continue checking for other issues
      }
    } catch {
      // Not a valid string
    }
  }

  // Check if already valid
  try {
    JSON.parse(input);
    if (suggestions.length === 0) {
      return ['JSON is already valid'];
    }
    // If we have suggestions (like unescape), return them
    return suggestions;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : '';

    // Analyze common error patterns
    if (errorMsg.includes('Unexpected token') || errorMsg.includes('Expected')) {
      // Check for common issues
      if (input.includes("'")) {
        suggestions.push('Replace single quotes with double quotes');
      }
      if (/[,\s]\s*[}\]]/.test(input)) {
        suggestions.push('Remove trailing commas');
      }
      if (/[{[]\s*,/.test(input)) {
        suggestions.push('Remove leading commas');
      }
      if (/"\s*[}\]]\s*"/.test(input)) {
        suggestions.push('Add missing commas between elements');
      }
      if (/{[^:}"]*}/.test(input) && !/"[^"]*":/g.test(input)) {
        suggestions.push('Add quotes around object keys');
      }
    }

    if (errorMsg.includes('Unterminated string')) {
      suggestions.push('Fix unterminated strings (missing closing quote)');
    }

    if (errorMsg.includes('Unexpected end')) {
      suggestions.push('Add missing closing brackets or braces');
    }

    // Check for Python-style values
    if (/\b(True|False|None)\b/.test(input)) {
      suggestions.push('Convert Python literals (True/False/None) to JSON (true/false/null)');
    }

    // Check for comments
    if (/\/\/|\/\*/.test(input)) {
      suggestions.push('Remove comments');
    }

    // Check for markdown code fences
    if (/```.*?\n/.test(input)) {
      suggestions.push('Remove markdown code fence markers');
    }

    // Check for JSONP
    if (/^\w+\s*\(/.test(input.trim())) {
      suggestions.push('Remove JSONP wrapper function');
    }

    // Check for multiple root objects
    if (/}\s*,?\s*{/.test(input)) {
      suggestions.push('Wrap multiple root objects in an array');
    }

    // Try repair to see if it works
    try {
      const result = repairJson(input, { trackChanges: true });
      if (result.wasRepaired && result.changes && result.changes.length > 0) {
        suggestions.push(`Auto-repair available (${result.changes.length} fixes)`);
      }
    } catch {
      // Can't repair
    }

    if (suggestions.length === 0) {
      suggestions.push('Unable to automatically repair this JSON');
    }

    return suggestions;
  }
}

/**
 * Try to repair JSON and return a detailed result with diagnostics
 */
export function repairJsonWithDiagnostics(input: string): {
  result: RepairResult;
  suggestions: string[];
  canRepair: boolean;
} {
  const suggestions = suggestRepairs(input);
  const result = repairJson(input, { trackChanges: true });
  const canRepair = result.wasRepaired || !result.error;

  return {
    result,
    suggestions,
    canRepair,
  };
}
