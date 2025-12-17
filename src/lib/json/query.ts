/**
 * JSONPath Query Engine
 * Simple implementation supporting common JSONPath expressions
 */

import type { JsonValue } from '@/types';

export interface QueryResult {
  value: JsonValue;
  path: string;
}

/**
 * Evaluate a JSONPath expression against a JSON value
 * 
 * Supported syntax:
 * - $ - root object
 * - .property - child property
 * - [n] - array index
 * - [*] - all array elements
 * - .* - all properties
 * - ..property - recursive descent (deep search)
 * - [start:end] - array slice
 * - [?(@.property == value)] - filter expression (basic)
 * 
 * Examples:
 * - $.store.book[0].title
 * - $.store.book[*].author
 * - $..author (all authors anywhere)
 * - $.store.book[?(@.price < 10)]
 */
export function queryJsonPath(data: JsonValue, path: string): QueryResult[] {
  if (!path.startsWith('$')) {
    throw new Error('JSONPath must start with $');
  }
  
  const results: QueryResult[] = [];
  evaluatePath(data, path.slice(1), '$', results);
  return results;
}

function evaluatePath(
  current: JsonValue,
  remainingPath: string,
  currentPath: string,
  results: QueryResult[]
): void {
  // No more path to process - add current value to results
  if (!remainingPath || remainingPath === '') {
    results.push({ value: current, path: currentPath });
    return;
  }
  
  // Handle recursive descent (..)
  if (remainingPath.startsWith('..')) {
    const rest = remainingPath.slice(2);
    const propertyMatch = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    
    if (propertyMatch && propertyMatch[1]) {
      const property = propertyMatch[1];
      const afterProperty = rest.slice(property.length);
      recursiveSearch(current, property, currentPath, afterProperty, results);
    }
    return;
  }
  
  // Handle property access (.property or ['property'])
  if (remainingPath.startsWith('.')) {
    const rest = remainingPath.slice(1);
    
    // Wildcard property (.*)
    if (rest.startsWith('*')) {
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        for (const [key, value] of Object.entries(current)) {
          evaluatePath(value, rest.slice(1), `${currentPath}.${key}`, results);
        }
      }
      return;
    }
    
    // Named property
    const propertyMatch = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (propertyMatch && propertyMatch[1]) {
      const property = propertyMatch[1];
      const afterProperty = rest.slice(property.length);
      
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        const value = (current as Record<string, JsonValue>)[property];
        if (value !== undefined) {
          evaluatePath(value, afterProperty, `${currentPath}.${property}`, results);
        }
      }
    }
    return;
  }
  
  // Handle bracket notation ([...])
  if (remainingPath.startsWith('[')) {
    const closeBracket = findMatchingBracket(remainingPath);
    if (closeBracket === -1) {
      throw new Error('Unmatched bracket in JSONPath');
    }
    
    const bracketContent = remainingPath.slice(1, closeBracket);
    const afterBracket = remainingPath.slice(closeBracket + 1);
    
    // Array wildcard [*]
    if (bracketContent === '*') {
      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          evaluatePath(item, afterBracket, `${currentPath}[${index}]`, results);
        });
      }
      return;
    }
    
    // Array index [n]
    const indexMatch = bracketContent.match(/^(-?\d+)$/);
    if (indexMatch && indexMatch[1]) {
      const index = parseInt(indexMatch[1], 10);
      if (Array.isArray(current)) {
        const actualIndex = index < 0 ? current.length + index : index;
        if (actualIndex >= 0 && actualIndex < current.length) {
          evaluatePath(
            current[actualIndex] as JsonValue,
            afterBracket,
            `${currentPath}[${actualIndex}]`,
            results
          );
        }
      }
      return;
    }
    
    // Array slice [start:end]
    const sliceMatch = bracketContent.match(/^(-?\d*):(-?\d*)$/);
    if (sliceMatch) {
      if (Array.isArray(current)) {
        const start = sliceMatch[1] ? parseInt(sliceMatch[1], 10) : 0;
        const end = sliceMatch[2] ? parseInt(sliceMatch[2], 10) : current.length;
        const actualStart = start < 0 ? current.length + start : start;
        const actualEnd = end < 0 ? current.length + end : end;
        
        for (let i = Math.max(0, actualStart); i < Math.min(current.length, actualEnd); i++) {
          evaluatePath(
            current[i] as JsonValue,
            afterBracket,
            `${currentPath}[${i}]`,
            results
          );
        }
      }
      return;
    }
    
    // Property name in brackets ['property'] or ["property"]
    const quotedMatch = bracketContent.match(/^['"]([^'"]+)['"]$/);
    if (quotedMatch && quotedMatch[1]) {
      const property = quotedMatch[1];
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        const value = (current as Record<string, JsonValue>)[property];
        if (value !== undefined) {
          evaluatePath(value, afterBracket, `${currentPath}['${property}']`, results);
        }
      }
      return;
    }
    
    // Filter expression [?(@.property == value)]
    const filterMatch = bracketContent.match(/^\?\(@\.([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|<|>|<=|>=)\s*(.+)\)$/);
    if (filterMatch && filterMatch[1] && filterMatch[2] && filterMatch[3]) {
      if (Array.isArray(current)) {
        const property = filterMatch[1];
        const operator = filterMatch[2];
        const rawValue = filterMatch[3];
        const compareValue = parseFilterValue(rawValue);
        
        current.forEach((item, index) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            const itemValue = (item as Record<string, JsonValue>)[property];
            if (itemValue !== undefined && compareValues(itemValue, operator, compareValue)) {
              evaluatePath(item, afterBracket, `${currentPath}[${index}]`, results);
            }
          }
        });
      }
      return;
    }
  }
}

/**
 * Find the matching closing bracket
 */
function findMatchingBracket(str: string): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (inString) {
      if (char === stringChar && str[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }
    
    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }
    
    if (char === '[') {
      depth++;
    } else if (char === ']') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  
  return -1;
}

/**
 * Recursive descent search for a property
 */
function recursiveSearch(
  current: JsonValue,
  property: string,
  currentPath: string,
  afterProperty: string,
  results: QueryResult[]
): void {
  if (current && typeof current === 'object') {
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        recursiveSearch(item, property, `${currentPath}[${index}]`, afterProperty, results);
      });
    } else {
      for (const [key, value] of Object.entries(current)) {
        if (key === property) {
          evaluatePath(value, afterProperty, `${currentPath}.${key}`, results);
        }
        recursiveSearch(value, property, `${currentPath}.${key}`, afterProperty, results);
      }
    }
  }
}

/**
 * Parse a filter value from string
 */
function parseFilterValue(rawValue: string): JsonValue {
  const trimmed = rawValue.trim();
  
  // String (quoted)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  
  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  
  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  
  // Null
  if (trimmed === 'null') return null;
  
  // Treat as string
  return trimmed;
}

/**
 * Compare two values with an operator
 */
function compareValues(a: JsonValue, operator: string, b: JsonValue): boolean {
  switch (operator) {
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    case '<':
      return typeof a === 'number' && typeof b === 'number' && a < b;
    case '>':
      return typeof a === 'number' && typeof b === 'number' && a > b;
    case '<=':
      return typeof a === 'number' && typeof b === 'number' && a <= b;
    case '>=':
      return typeof a === 'number' && typeof b === 'number' && a >= b;
    default:
      return false;
  }
}

/**
 * Get all unique property paths from a JSON value (for autocomplete)
 */
export function getAllPaths(data: JsonValue, maxDepth = 5): string[] {
  const paths: Set<string> = new Set();
  
  function traverse(value: JsonValue, currentPath: string, depth: number): void {
    if (depth > maxDepth) return;
    
    paths.add(currentPath);
    
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          paths.add(`${currentPath}[*]`);
          // Sample the first item for structure
          traverse(value[0] as JsonValue, `${currentPath}[0]`, depth + 1);
        }
      } else {
        for (const [key, val] of Object.entries(value)) {
          const safePath = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
            ? `${currentPath}.${key}`
            : `${currentPath}['${key}']`;
          traverse(val, safePath, depth + 1);
        }
      }
    }
  }
  
  traverse(data, '$', 0);
  return Array.from(paths).sort();
}

/**
 * Sort an array by a property path
 */
export function sortArray(
  data: JsonValue[],
  propertyPath: string,
  direction: 'asc' | 'desc' = 'asc',
  sortType: 'auto' | 'string' | 'number' | 'natural' = 'auto'
): JsonValue[] {
  const sorted = [...data];
  
  sorted.sort((a, b) => {
    const valueA = getValueByPath(a, propertyPath);
    const valueB = getValueByPath(b, propertyPath);
    
    let comparison: number;
    
    switch (sortType) {
      case 'string':
        comparison = String(valueA).localeCompare(String(valueB));
        break;
      case 'number':
        comparison = (Number(valueA) || 0) - (Number(valueB) || 0);
        break;
      case 'natural':
        comparison = naturalCompare(String(valueA), String(valueB));
        break;
      case 'auto':
      default:
        comparison = autoCompare(valueA, valueB);
        break;
    }
    
    return direction === 'desc' ? -comparison : comparison;
  });
  
  return sorted;
}

/**
 * Sort object keys alphabetically
 */
export function sortObjectKeys(
  data: JsonValue,
  direction: 'asc' | 'desc' = 'asc',
  recursive = true
): JsonValue {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return recursive
      ? data.map(item => sortObjectKeys(item, direction, recursive))
      : data;
  }
  
  const keys = Object.keys(data);
  keys.sort((a, b) => {
    const comparison = a.localeCompare(b);
    return direction === 'desc' ? -comparison : comparison;
  });
  
  const sorted: Record<string, JsonValue> = {};
  for (const key of keys) {
    const value = (data as Record<string, JsonValue>)[key];
    if (value !== undefined) {
      sorted[key] = recursive ? sortObjectKeys(value, direction, recursive) : value;
    }
  }
  
  return sorted;
}

/**
 * Get a value by dot-notation path
 */
function getValueByPath(data: JsonValue, path: string): JsonValue | null {
  const parts = path.split('.').filter(Boolean);
  let current: JsonValue | undefined = data;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      current = (current as Record<string, JsonValue>)[part];
    } else {
      return null;
    }
  }
  
  return current ?? null;
}

/**
 * Natural sort comparison (handles numbers in strings)
 */
function naturalCompare(a: string, b: string): number {
  const re = /(\d+)/g;
  const aParts = a.split(re);
  const bParts = b.split(re);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] ?? '';
    const bPart = bParts[i] ?? '';
    
    // Check if both parts are numbers
    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      const comparison = aPart.localeCompare(bPart);
      if (comparison !== 0) return comparison;
    }
  }
  
  return 0;
}

/**
 * Auto-detect comparison based on types
 */
function autoCompare(a: JsonValue, b: JsonValue): number {
  // Handle nulls
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  
  // Both numbers
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  
  // Both strings
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }
  
  // Both booleans
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? 1 : -1;
  }
  
  // Mixed types - convert to string
  return String(a).localeCompare(String(b));
}

/**
 * Filter an array based on conditions
 */
export interface FilterCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'isEmpty' | 'isNotEmpty';
  value?: JsonValue;
}

export function filterArray(
  data: JsonValue[],
  conditions: FilterCondition[],
  logic: 'and' | 'or' = 'and'
): JsonValue[] {
  return data.filter(item => {
    const results = conditions.map(condition => evaluateCondition(item, condition));
    return logic === 'and'
      ? results.every(r => r)
      : results.some(r => r);
  });
}

function evaluateCondition(item: JsonValue, condition: FilterCondition): boolean {
  const value = getValueByPath(item, condition.field);
  
  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'notEquals':
      return value !== condition.value;
    case 'contains':
      return typeof value === 'string' && typeof condition.value === 'string'
        && value.toLowerCase().includes(condition.value.toLowerCase());
    case 'notContains':
      return typeof value === 'string' && typeof condition.value === 'string'
        && !value.toLowerCase().includes(condition.value.toLowerCase());
    case 'startsWith':
      return typeof value === 'string' && typeof condition.value === 'string'
        && value.toLowerCase().startsWith(condition.value.toLowerCase());
    case 'endsWith':
      return typeof value === 'string' && typeof condition.value === 'string'
        && value.toLowerCase().endsWith(condition.value.toLowerCase());
    case 'gt':
      return typeof value === 'number' && typeof condition.value === 'number'
        && value > condition.value;
    case 'gte':
      return typeof value === 'number' && typeof condition.value === 'number'
        && value >= condition.value;
    case 'lt':
      return typeof value === 'number' && typeof condition.value === 'number'
        && value < condition.value;
    case 'lte':
      return typeof value === 'number' && typeof condition.value === 'number'
        && value <= condition.value;
    case 'isEmpty':
      return value === null || value === undefined || value === '' 
        || (Array.isArray(value) && value.length === 0);
    case 'isNotEmpty':
      return value !== null && value !== undefined && value !== ''
        && !(Array.isArray(value) && value.length === 0);
    default:
      return true;
  }
}
