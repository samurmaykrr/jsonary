import { parseJson } from '../json/parser';

/**
 * Generate JSON Schema from a JSON value
 */
export function generateJsonSchema(jsonString: string): { schema: string } | { error: string } {
  try {
    // First parse the JSON
    const parsed = parseJson(jsonString);

    if (parsed.error) {
      return { error: `Invalid JSON: ${parsed.error.message}` };
    }

    // Generate schema from the parsed value
    const schema = inferSchema(parsed.value);

    // Convert schema to formatted JSON string
    const schemaString = JSON.stringify(schema, null, 2);

    return { schema: schemaString };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to generate schema'
    };
  }
}

/**
 * Infer JSON Schema from a value
 */
function inferSchema(value: unknown): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    $schema: 'http://json-schema.org/draft-07/schema#',
  };

  if (value === null) {
    schema.type = 'null';
  } else if (Array.isArray(value)) {
    schema.type = 'array';

    if (value.length > 0) {
      // Try to infer a common schema from array items
      const itemSchemas = value.map(item => inferSchemaForValue(item));

      // If all items have the same type, use that as the item schema
      const types = itemSchemas.map(s => s.type);
      const allSameType = types.every(t => t === types[0]);

      if (allSameType) {
        schema.items = itemSchemas[0];
      } else {
        // Mixed types - use anyOf
        const uniqueSchemas = deduplicateSchemas(itemSchemas);
        if (uniqueSchemas.length === 1) {
          schema.items = uniqueSchemas[0];
        } else {
          schema.items = {
            anyOf: uniqueSchemas,
          };
        }
      }
    }
  } else if (typeof value === 'object') {
    schema.type = 'object';
    schema.properties = {};
    const required: string[] = [];

    for (const [key, val] of Object.entries(value)) {
      (schema.properties as Record<string, unknown>)[key] = inferSchemaForValue(val);
      required.push(key); // Consider all existing properties as required
    }

    if (required.length > 0) {
      schema.required = required;
    }
  } else {
    // Primitive types
    Object.assign(schema, inferSchemaForValue(value));
  }

  return schema;
}

/**
 * Infer schema for a single value (without $schema)
 */
function inferSchemaForValue(value: unknown): Record<string, unknown> {
  if (value === null) {
    return { type: 'null' };
  }

  if (Array.isArray(value)) {
    const schema: Record<string, unknown> = { type: 'array' };

    if (value.length > 0) {
      const itemSchemas = value.map(item => inferSchemaForValue(item));
      const types = itemSchemas.map(s => s.type);
      const allSameType = types.every(t => t === types[0]);

      if (allSameType) {
        schema.items = itemSchemas[0];
      } else {
        const uniqueSchemas = deduplicateSchemas(itemSchemas);
        if (uniqueSchemas.length === 1) {
          schema.items = uniqueSchemas[0];
        } else {
          schema.items = {
            anyOf: uniqueSchemas,
          };
        }
      }
    }

    return schema;
  }

  if (typeof value === 'object') {
    const schema: Record<string, unknown> = {
      type: 'object',
      properties: {},
    };
    const required: string[] = [];

    for (const [key, val] of Object.entries(value)) {
      (schema.properties as Record<string, unknown>)[key] = inferSchemaForValue(val);
      required.push(key);
    }

    if (required.length > 0) {
      schema.required = required;
    }

    return schema;
  }

  // Primitive types
  const type = typeof value;

  if (type === 'string') {
    return { type: 'string' };
  }

  if (type === 'number') {
    return {
      type: Number.isInteger(value as number) ? 'integer' : 'number',
    };
  }

  if (type === 'boolean') {
    return { type: 'boolean' };
  }

  return { type: 'string' }; // Default fallback
}

/**
 * Deduplicate schemas by converting to string and comparing
 */
function deduplicateSchemas(schemas: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const unique: Record<string, unknown>[] = [];

  for (const schema of schemas) {
    const key = JSON.stringify(schema);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(schema);
    }
  }

  return unique;
}
