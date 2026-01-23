import Ajv, { type ErrorObject } from 'ajv';
import type { JsonSchema, ValidationError } from '@/types';

// Create singleton Ajv instance with commonly used options
const ajv = new Ajv({
  allErrors: true,      // Report all errors, not just the first one
  verbose: true,        // Include schema and data in error objects
  strict: false,        // Allow unknown keywords for draft-06/07 compatibility
});

/**
 * Validate JSON data against a JSON Schema
 */
export function validateJsonSchema(
  data: unknown,
  schema: JsonSchema
): ValidationError[] {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  
  if (valid) {
    return [];
  }
  
  return (validate.errors ?? []).map(errorToValidationError);
}

/**
 * Convert Ajv error to our ValidationError format
 */
function errorToValidationError(error: ErrorObject): ValidationError {
  const path = error.instancePath || '/';
  const schemaPath = error.schemaPath;
  
  // Generate human-readable message
  let message = error.message ?? 'Validation error';
  
  switch (error.keyword) {
    case 'type':
      message = `Expected ${error.params.type}, got ${typeof error.data}`;
      break;
    case 'required':
      message = `Missing required property: ${error.params.missingProperty}`;
      break;
    case 'additionalProperties':
      message = `Unknown property: ${error.params.additionalProperty}`;
      break;
    case 'enum':
      message = `Value must be one of: ${error.params.allowedValues?.join(', ')}`;
      break;
    case 'minLength':
      message = `String must be at least ${error.params.limit} characters`;
      break;
    case 'maxLength':
      message = `String must be at most ${error.params.limit} characters`;
      break;
    case 'minimum':
      message = `Value must be >= ${error.params.limit}`;
      break;
    case 'maximum':
      message = `Value must be <= ${error.params.limit}`;
      break;
    case 'pattern':
      message = `String does not match pattern: ${error.params.pattern}`;
      break;
    case 'format':
      message = `Invalid format: expected ${error.params.format}`;
      break;
    case 'minItems':
      message = `Array must have at least ${error.params.limit} items`;
      break;
    case 'maxItems':
      message = `Array must have at most ${error.params.limit} items`;
      break;
    case 'uniqueItems':
      message = `Array items must be unique`;
      break;
  }
  
  return {
    path,
    message,
    keyword: error.keyword,
    params: error.params as Record<string, unknown>,
    schemaPath,
  };
}

/**
 * Check if a schema is valid
 */
export function isValidSchema(schema: unknown): schema is JsonSchema {
  try {
    ajv.compile(schema as JsonSchema);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get human-readable path from JSON pointer
 */
export function formatPath(path: string): string {
  if (!path || path === '/') return 'root';
  
  return path
    .split('/')
    .filter(Boolean)
    .map(segment => {
      // Check if it's an array index
      if (/^\d+$/.test(segment)) {
        return `[${segment}]`;
      }
      return `.${segment}`;
    })
    .join('')
    .replace(/^\./, '');
}

/**
 * Map a JSON pointer path to a line number in the source JSON string
 * Returns the line number (1-indexed) where the path's value is located
 */
export function pathToLineNumber(jsonString: string, path: string): number | null {
  if (!path || path === '/') return 1;
  
  // Parse the path segments
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return 1;
  
  // We'll scan through the JSON to find the path
  // This is a simplified approach that works for well-formatted JSON
  const lines = jsonString.split('\n');
  
  const pathStack: string[] = [];
  let inString = false;
  let lastKeyLine = 1;
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? '';
    const lineNum = lineIndex + 1;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : '';
      
      // Handle string state
      if (char === '"' && prevChar !== '\\') {
       if (inString) {
           // End of string - check if it was a key
           const restOfLine = line.slice(i + 1).trim();
            if (restOfLine.startsWith(':')) {
              lastKeyLine = lineNum;
            }
         }
         inString = !inString;
         continue;
       }
       
       if (inString) {
         continue;
      }
      
      // Handle structural characters
      if (char === '}' || char === ']') {
        pathStack.pop();
      } else if (char === ',') {
        // Array index tracking - increment last array index
        // This is simplified and may not work for all cases
      }
      
      // Check if current path matches target
      const currentPath = '/' + pathStack.join('/');
      if (currentPath === path) {
        return lastKeyLine;
      }
    }
  }
  
  return null;
}

/**
 * Enhanced path to line mapping using regex-based search
 * More reliable for finding the line where a JSON path's key is defined
 */
export function findPathLine(jsonString: string, path: string): number | null {
  if (!path || path === '/') return 1;

  // Get the last segment of the path (the key we're looking for)
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return 1;

  const targetKey = segments[segments.length - 1];

  // If it's an array index, we need special handling
  if (targetKey && /^\d+$/.test(targetKey)) {
    return findArrayIndexLine(jsonString, segments);
  }

  // For object keys, find the line with the matching key
  // We'll look for the pattern "key": at the appropriate nesting level
  const lines = jsonString.split('\n');

  // Build a regex for the key
  const keyPattern = new RegExp(`^\\s*"${escapeRegex(targetKey ?? '')}"\\s*:`);

  // For simple single-key paths or paths where all parents are array indices,
  // just find the first occurrence
  const parentSegments = segments.slice(0, -1);
  const allParentsAreArrays = parentSegments.every(seg => /^\d+$/.test(seg));

  if (parentSegments.length === 0 || allParentsAreArrays) {
    // Simple case: no parents or all parents are array indices
    // Just find the first matching key
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex] ?? '';
      if (keyPattern.test(line)) {
        return lineIndex + 1;
      }
    }
    return null;
  }

  // Complex case: has object parents
  let parentMatched = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? '';
    const lineNum = lineIndex + 1;

    // Check for parent path match
    if (!parentMatched) {
      for (const seg of parentSegments) {
        if (!/^\d+$/.test(seg)) {
          const parentPattern = new RegExp(`"${escapeRegex(seg)}"\\s*:`);
          if (parentPattern.test(line)) {
            parentMatched = true;
            break;
          }
        }
      }
    }

    // Check for target key at appropriate depth
    if (keyPattern.test(line)) {
      if (parentMatched) {
        return lineNum;
      }
    }
  }

  return null;
}

/**
 * Helper function to find the first content line inside an object or array
 * Returns the line number of the first key or value, not the opening brace/bracket
 */
function findFirstContentLine(lines: string[], startIndex: number): number | null {
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Check if this line has content (not just closing braces)
    if (trimmed.startsWith('}') || trimmed.startsWith(']')) {
      return null; // Empty object/array
    }

    // This line has actual content
    return i + 1; // Return 1-indexed line number
  }

  return null;
}

/**
 * Find the line number for an array index in the JSON
 * For objects and arrays, returns the first key/value inside rather than the opening brace/bracket
 */
function findArrayIndexLine(jsonString: string, segments: string[]): number | null {
  const lines = jsonString.split('\n');
  const targetIndex = parseInt(segments[segments.length - 1] ?? '0', 10);
  const parentKey = segments.length > 1 ? segments[segments.length - 2] : null;

  // For root-level arrays (no parent key), use a simpler approach
  if (!parentKey) {
    let depth = 0;
    let itemCount = 0;
    let inArray = false;
    let foundItemLine: number | null = null;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex] ?? '';
      const lineNum = lineIndex + 1;
      const trimmedLine = line.trim();

      // Start of root array
      if (trimmedLine.startsWith('[') && depth === 0) {
        inArray = true;
        depth = 1;
        continue;
      }

      if (!inArray) continue;

      // Track depth changes
      const depthBefore = depth;
      for (const char of line) {
        if (char === '[' || char === '{') depth++;
        if (char === ']' || char === '}') depth--;
      }

      // If we're back at depth 0, we've exited the array
      if (depth === 0) break;

      // Look for array items at depth 1 (direct children of root array)
      if (depthBefore === 1 && (
        trimmedLine.startsWith('{') ||
        trimmedLine.startsWith('[') ||
        trimmedLine.startsWith('"') ||
        /^-?\d/.test(trimmedLine) ||
        trimmedLine.startsWith('true') ||
        trimmedLine.startsWith('false') ||
        trimmedLine.startsWith('null')
      )) {
        if (itemCount === targetIndex) {
          foundItemLine = lineNum;

          // If it's an object or array, look for the first content inside
          if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
            const firstContentLine = findFirstContentLine(lines, lineIndex);
            return firstContentLine ?? foundItemLine;
          }

          return foundItemLine;
        }
        itemCount++;
      }
    }

    return null;
  }

  // For nested arrays, use the original logic
  let inTargetArray = false;
  let arrayItemCount = 0;
  let depth = 0;
  let arrayDepth = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? '';
    const lineNum = lineIndex + 1;
    const trimmedLine = line.trim();

    // Track depth outside target array
    if (!inTargetArray) {
      for (const char of line) {
        if (char === '[' || char === '{') depth++;
        if (char === ']' || char === '}') depth--;
      }
    }

    // Look for the parent key's array
    if (!inTargetArray) {
      const keyPattern = new RegExp(`"${escapeRegex(parentKey)}"\\s*:\\s*\\[`);
      if (keyPattern.test(line)) {
        inTargetArray = true;
        arrayDepth = depth;
        arrayItemCount = 0;
        continue;
      }
    }

    if (inTargetArray) {
      // Track depth changes
      const depthBefore = depth;
      for (const char of line) {
        if (char === '[' || char === '{') depth++;
        if (char === ']' || char === '}') {
          depth--;
          if (depth <= arrayDepth && char === ']') {
            inTargetArray = false;
          }
        }
      }

      // Detect new array item
      if (depthBefore === arrayDepth + 1 && (
        trimmedLine.startsWith('{') ||
        trimmedLine.startsWith('[') ||
        trimmedLine.startsWith('"') ||
        /^-?\d/.test(trimmedLine) ||
        trimmedLine.startsWith('true') ||
        trimmedLine.startsWith('false') ||
        trimmedLine.startsWith('null')
      )) {
        if (arrayItemCount === targetIndex) {
          // If it's an object or array, look for the first content inside
          if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
            const firstContentLine = findFirstContentLine(lines, lineIndex);
            return firstContentLine ?? lineNum;
          }
          return lineNum;
        }
        arrayItemCount++;
      }
    }
  }

  return null;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse JSON and validate against schema in one step
 */
export function parseAndValidate(
  jsonString: string,
  schema: JsonSchema
): { data: unknown; errors: ValidationError[] } | { parseError: string } {
  try {
    const data = JSON.parse(jsonString);
    const errors = validateJsonSchema(data, schema);
    return { data, errors };
  } catch (e) {
    return { parseError: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}
