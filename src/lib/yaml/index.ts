import yaml from 'js-yaml';
import { parseJson } from '../json/parser';

/**
 * Convert JSON string to YAML
 */
export function jsonToYaml(jsonString: string): { yaml: string } | { error: string } {
  try {
    // First parse the JSON
    const parsed = parseJson(jsonString);

    if (parsed.error) {
      return { error: `Invalid JSON: ${parsed.error.message}` };
    }

    // Convert to YAML
    const yamlString = yaml.dump(parsed.value, {
      indent: 2,
      lineWidth: 120,
      noRefs: true, // Don't use anchors and aliases
      sortKeys: false, // Preserve key order
    });

    return { yaml: yamlString };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to convert to YAML'
    };
  }
}

/**
 * Convert YAML string to JSON
 */
export function yamlToJson(yamlString: string): { json: string } | { error: string } {
  try {
    // Parse YAML
    const parsed = yaml.load(yamlString);

    // Convert to JSON string
    const jsonString = JSON.stringify(parsed, null, 2);

    return { json: jsonString };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to parse YAML'
    };
  }
}

/**
 * Check if a string looks like YAML
 */
export function looksLikeYaml(content: string): boolean {
  const trimmed = content.trim();

  // Empty string is not YAML
  if (!trimmed) return false;

  // Check for common YAML indicators
  const yamlIndicators = [
    /^---\s*$/m,                    // Document separator
    /^\w+:\s*[\w\d]/m,              // Key-value pairs
    /^-\s+\w+/m,                    // List items
    /^[\w\s]+:\s*$/m,               // Keys without values
    /^[\s]*[\w-]+:\s+[^{[\n]/m,   // Simple key-value (not JSON object/array)
  ];

  // If it starts with { or [, it's probably JSON
  if (/^[{[]/.test(trimmed)) return false;

  // Check if it has any YAML indicators
  return yamlIndicators.some(regex => regex.test(trimmed));
}
