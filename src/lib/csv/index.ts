/**
 * CSV Parser and Stringifier
 * Handles CSV import/export for JSON data
 */

export interface CsvParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  inferTypes?: boolean;
  skipEmptyLines?: boolean;
}

export interface CsvStringifyOptions {
  delimiter?: string;
  includeHeader?: boolean;
  flattenObjects?: boolean;
  flattenArrays?: boolean;
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, unknown>[];
  rawRows: string[][];
}

/**
 * Auto-detect CSV delimiter
 */
export function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] ?? '';
  
  // Count occurrences of common delimiters
  const delimiters = [',', ';', '\t', '|'];
  let maxCount = 0;
  let detected = ',';
  
  for (const d of delimiters) {
    const count = (firstLine.match(new RegExp(`\\${d}`, 'g')) ?? []).length;
    if (count > maxCount) {
      maxCount = count;
      detected = d;
    }
  }
  
  return detected;
}

/**
 * Parse a CSV string into structured data
 */
export function parseCsv(content: string, options: CsvParseOptions = {}): ParsedCsv {
  const {
    delimiter = detectDelimiter(content),
    hasHeader = true,
    inferTypes = true,
    skipEmptyLines = true,
  } = options;
  
  const lines = content.split(/\r?\n/);
  const rawRows: string[][] = [];
  
  for (const line of lines) {
    if (skipEmptyLines && line.trim() === '') continue;
    
    const row = parseCsvLine(line, delimiter);
    rawRows.push(row);
  }
  
  if (rawRows.length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }
  
  // Extract headers
  const headers = hasHeader
    ? (rawRows.shift() ?? []).map((h, i) => h.trim() || `column${i + 1}`)
    : rawRows[0]?.map((_, i) => `column${i + 1}`) ?? [];
  
  // Convert to objects
  const rows: Record<string, unknown>[] = rawRows.map(row => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (header === undefined) continue;
      let value: unknown = row[i] ?? '';
      
      if (inferTypes) {
        value = inferType(value as string);
      }
      
      obj[header] = value;
    }
    return obj;
  });
  
  return { headers, rows, rawRows };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted section
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted section
        inQuotes = true;
      } else if (char === delimiter) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  // Don't forget the last field
  result.push(current.trim());
  
  return result;
}

/**
 * Infer the type of a string value
 */
function inferType(value: string): unknown {
  const trimmed = value.trim();
  
  // Empty string
  if (trimmed === '') return '';
  
  // Null
  if (trimmed.toLowerCase() === 'null') return null;
  
  // Boolean
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  
  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = parseFloat(trimmed);
    if (!isNaN(num)) return num;
  }
  
  // JSON (for nested objects/arrays)
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not valid JSON, return as string
    }
  }
  
  return trimmed;
}

/**
 * Convert JSON array to CSV string
 */
export function stringifyCsv(
  data: unknown[],
  options: CsvStringifyOptions = {}
): string {
  const {
    delimiter = ',',
    includeHeader = true,
    flattenObjects = true,
    flattenArrays = false,
  } = options;
  
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  // Get all unique keys from all objects
  const keys = new Set<string>();
  for (const item of data) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const flattened = flattenObjects
        ? flattenObject(item as Record<string, unknown>)
        : item as Record<string, unknown>;
      Object.keys(flattened).forEach(k => keys.add(k));
    }
  }
  
  const headers = Array.from(keys);
  const lines: string[] = [];
  
  // Add header row
  if (includeHeader) {
    lines.push(headers.map(h => escapeCsvField(h, delimiter)).join(delimiter));
  }
  
  // Add data rows
  for (const item of data) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const flattened = flattenObjects
        ? flattenObject(item as Record<string, unknown>)
        : item as Record<string, unknown>;
      
      const row = headers.map(header => {
        const value = flattened[header];
        return escapeCsvField(formatValue(value, flattenArrays), delimiter);
      });
      
      lines.push(row.join(delimiter));
    } else {
      // Non-object item - just stringify it
      lines.push(escapeCsvField(formatValue(item, flattenArrays), delimiter));
    }
  }
  
  return lines.join('\n');
}

/**
 * Flatten a nested object into dot-notation keys
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Format a value for CSV output
 */
function formatValue(value: unknown, flattenArrays: boolean): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (Array.isArray(value)) {
    if (flattenArrays) {
      return value.map(v => formatValue(v, flattenArrays)).join('; ');
    }
    return JSON.stringify(value);
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}

/**
 * Escape a CSV field value
 */
function escapeCsvField(value: string, delimiter: string): string {
  // Check if escaping is needed
  if (value.includes('"') || value.includes(delimiter) || value.includes('\n') || value.includes('\r')) {
    // Escape quotes by doubling them
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Check if content looks like CSV
 */
export function looksLikeCsv(content: string): boolean {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return false;
  
  const delimiter = detectDelimiter(content);
  const firstLineFields = parseCsvLine(lines[0] ?? '', delimiter).length;
  const secondLineFields = parseCsvLine(lines[1] ?? '', delimiter).length;
  
  // CSV should have consistent field count
  return firstLineFields > 1 && firstLineFields === secondLineFields;
}
