import { encode } from '@toon-format/toon';
import { parseJson } from '../json/parser';

/**
 * Convert JSON string to TOON format
 * TOON (Token-Oriented Object Notation) is a compact, human-readable format
 * designed for LLM prompts that reduces token usage by 30-60%
 */
export function jsonToToon(jsonString: string): { toon: string } | { error: string } {
  try {
    // First parse the JSON
    const parsed = parseJson(jsonString);

    if (parsed.error) {
      return { error: `Invalid JSON: ${parsed.error.message}` };
    }

    // Convert to TOON
    const toonString = encode(parsed.value);

    return { toon: toonString };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to convert to TOON'
    };
  }
}

/**
 * Check if a string looks like TOON format
 */
export function looksLikeToon(content: string): boolean {
  const trimmed = content.trim();

  // Empty string is not TOON
  if (!trimmed) return false;

  // TOON typically starts with a key and uses compact notation
  // Example: name=John|age=30|city=NYC
  // or multi-line with indentation for nested objects

  // Check for TOON-like patterns
  const toonIndicators = [
    /^[\w-]+=/m,                   // Key-value with =
    /\|[\w-]+=/,                   // Pipe separator
    /^\s+[\w-]+=/m,                // Indented key-value
  ];

  // If it starts with { or [, it's probably JSON
  if (/^[{[]/.test(trimmed)) return false;

  // Check if it has any TOON indicators
  return toonIndicators.some(regex => regex.test(trimmed));
}
