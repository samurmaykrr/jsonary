/**
 * Formatter Worker
 * Offloads JSON formatting to a separate thread for large documents
 */

import type { JsonValue } from '../types';

// Types for messages
interface FormatMessage {
  type: 'format';
  id: string;
  input: string;
  options: FormatOptions;
}

interface CompactMessage {
  type: 'compact';
  id: string;
  input: string;
}

interface SmartFormatMessage {
  type: 'smart-format';
  id: string;
  input: string;
  options: FormatOptions;
}

interface SortKeysMessage {
  type: 'sort-keys';
  id: string;
  input: string;
  options: FormatOptions;
}

interface FormatOptions {
  indent?: number | 'tab';
  maxLineLength?: number;
}

interface FormatResponse {
  type: 'format-result' | 'compact-result' | 'smart-format-result' | 'sort-keys-result';
  id: string;
  output: string;
  error: string | null;
}

type WorkerMessage = FormatMessage | CompactMessage | SmartFormatMessage | SortKeysMessage;

/**
 * Format JSON with indentation
 */
function formatJson(input: string, options: FormatOptions = {}): string {
  const { indent = 2 } = options;
  const parsed = JSON.parse(input) as JsonValue;
  const indentStr = indent === 'tab' ? '\t' : ' '.repeat(indent);
  return JSON.stringify(parsed, null, indentStr);
}

/**
 * Compact JSON (minify)
 */
function compactJson(input: string): string {
  const parsed = JSON.parse(input) as JsonValue;
  return JSON.stringify(parsed);
}

/**
 * Smart format - keeps small arrays/objects inline
 */
function smartFormatJson(input: string, options: FormatOptions = {}): string {
  const { indent = 2, maxLineLength = 80 } = options;
  const parsed = JSON.parse(input) as JsonValue;
  const indentStr = indent === 'tab' ? '\t' : ' '.repeat(indent);
  return smartStringify(parsed, indentStr, maxLineLength, 0);
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
function sortJsonKeys(input: string, options: FormatOptions = {}): string {
  const parsed = JSON.parse(input) as JsonValue;
  const sorted = sortKeysDeep(parsed);
  return formatJson(JSON.stringify(sorted), options);
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

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  
  switch (message.type) {
    case 'format': {
      try {
        const output = formatJson(message.input, message.options);
        const response: FormatResponse = {
          type: 'format-result',
          id: message.id,
          output,
          error: null,
        };
        self.postMessage(response);
      } catch (e) {
        const response: FormatResponse = {
          type: 'format-result',
          id: message.id,
          output: message.input,
          error: e instanceof Error ? e.message : 'Format failed',
        };
        self.postMessage(response);
      }
      break;
    }
    
    case 'compact': {
      try {
        const output = compactJson(message.input);
        const response: FormatResponse = {
          type: 'compact-result',
          id: message.id,
          output,
          error: null,
        };
        self.postMessage(response);
      } catch (e) {
        const response: FormatResponse = {
          type: 'compact-result',
          id: message.id,
          output: message.input,
          error: e instanceof Error ? e.message : 'Compact failed',
        };
        self.postMessage(response);
      }
      break;
    }
    
    case 'smart-format': {
      try {
        const output = smartFormatJson(message.input, message.options);
        const response: FormatResponse = {
          type: 'smart-format-result',
          id: message.id,
          output,
          error: null,
        };
        self.postMessage(response);
      } catch (e) {
        const response: FormatResponse = {
          type: 'smart-format-result',
          id: message.id,
          output: message.input,
          error: e instanceof Error ? e.message : 'Smart format failed',
        };
        self.postMessage(response);
      }
      break;
    }
    
    case 'sort-keys': {
      try {
        const output = sortJsonKeys(message.input, message.options);
        const response: FormatResponse = {
          type: 'sort-keys-result',
          id: message.id,
          output,
          error: null,
        };
        self.postMessage(response);
      } catch (e) {
        const response: FormatResponse = {
          type: 'sort-keys-result',
          id: message.id,
          output: message.input,
          error: e instanceof Error ? e.message : 'Sort keys failed',
        };
        self.postMessage(response);
      }
      break;
    }
  }
};

export {};
