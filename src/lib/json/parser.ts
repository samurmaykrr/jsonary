import type { JsonValue } from '@/types';

/**
 * Parse error with location information
 */
export interface ParseError {
  message: string;
  line: number;
  column: number;
  offset: number;
}

/**
 * Parse result with value and errors
 */
export interface ParseResult {
  value: JsonValue | null;
  error: ParseError | null;
}

/**
 * Parse JSON string with detailed error information
 */
export function parseJson(input: string): ParseResult {
  try {
    const value = JSON.parse(input) as JsonValue;
    return { value, error: null };
  } catch (e) {
    const error = e as SyntaxError;
    const { line, column, offset } = getErrorLocation(input, error);
    
    return {
      value: null,
      error: {
        message: error.message,
        line,
        column,
        offset,
      },
    };
  }
}

/**
 * Extract line and column from JSON parse error
 */
function getErrorLocation(input: string, error: SyntaxError): { line: number; column: number; offset: number } {
  // Try to extract position from error message
  // Different browsers format this differently
  const match = error.message.match(/position\s+(\d+)/i) 
    ?? error.message.match(/at\s+(\d+)/i)
    ?? error.message.match(/column\s+(\d+)/i);
  
  let offset = 0;
  if (match?.[1]) {
    offset = parseInt(match[1], 10);
  }
  
  // Calculate line and column from offset
  let line = 1;
  let column = 1;
  
  for (let i = 0; i < offset && i < input.length; i++) {
    if (input[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  
  return { line, column, offset };
}

/**
 * Validate JSON without parsing (faster for large documents)
 */
export function isValidJson(input: string): boolean {
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the type of a JSON value as a string
 */
export function getValueType(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Get a preview string for a JSON value
 */
export function getValuePreview(value: JsonValue, maxLength: number = 50): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value.length <= maxLength - 2) return `"${value}"`;
    return `"${value.slice(0, maxLength - 5)}..."`;
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return `Object(${keys.length})`;
  }
  return String(value);
}
