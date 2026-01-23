import * as TOML from '@iarna/toml';
import { parseJson } from '../json/parser';

/**
 * Convert JSON string to TOML
 */
export function jsonToToml(jsonString: string): { toml: string } | { error: string } {
  try {
    // First parse the JSON
    const parsed = parseJson(jsonString);

    if (parsed.error) {
      return { error: `Invalid JSON: ${parsed.error.message}` };
    }

    // TOML can only represent objects at the top level
    if (typeof parsed.value !== 'object' || parsed.value === null || Array.isArray(parsed.value)) {
      return {
        error: 'TOML requires an object at the top level (not array, string, number, etc.)'
      };
    }

    // Convert to TOML
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tomlString = TOML.stringify(parsed.value as any);

    return { toml: tomlString };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to convert to TOML'
    };
  }
}

/**
 * Convert TOML string to JSON
 */
export function tomlToJson(tomlString: string): { json: string } | { error: string } {
  try {
    // Parse TOML
    const parsed = TOML.parse(tomlString);

    // Convert to JSON string
    const jsonString = JSON.stringify(parsed, null, 2);

    return { json: jsonString };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to parse TOML'
    };
  }
}

/**
 * Check if a string looks like TOML
 */
export function looksLikeToml(content: string): boolean {
  const trimmed = content.trim();

  // Empty string is not TOML
  if (!trimmed) return false;

  // Check for common TOML indicators
  const tomlIndicators = [
    /^\[[\w.-]+\]/m,              // Section headers like [section]
    /^[\w-]+\s*=\s*.+$/m,          // Key-value pairs with =
    /^#.*$/m,                       // Comments
    /^\[\[[\w.-]+\]\]/m,          // Array of tables
  ];

  // If it starts with { or [, it's probably JSON
  if (/^[{[]/.test(trimmed)) return false;

  // TOML typically uses = for assignment
  if (/=/.test(trimmed)) {
    // Check if it has any TOML indicators
    return tomlIndicators.some(regex => regex.test(trimmed));
  }

  return false;
}
