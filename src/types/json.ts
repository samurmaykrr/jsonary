/**
 * JSON-related type definitions
 */

// JSON primitive types
export type JsonPrimitive = string | number | boolean | null;

// JSON value (recursive type)
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// JSON object type
export interface JsonObject {
  [key: string]: JsonValue;
}

// JSON array type
export type JsonArray = JsonValue[];

/**
 * JSON Schema types (subset of JSON Schema draft-07)
 */
export interface JsonSchema {
  $id?: string;
  $ref?: string;
  $schema?: string;
  title?: string;
  description?: string;
  type?: JsonSchemaType | JsonSchemaType[];
  enum?: JsonValue[];
  const?: JsonValue;
  
  // String validation
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  
  // Number validation
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  
  // Array validation
  items?: JsonSchema | JsonSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  contains?: JsonSchema;
  
  // Object validation
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  propertyNames?: JsonSchema;
  minProperties?: number;
  maxProperties?: number;
  patternProperties?: Record<string, JsonSchema>;
  dependencies?: Record<string, JsonSchema | string[]>;
  
  // Combining schemas
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
  
  // Conditional
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;
  
  // Metadata
  default?: JsonValue;
  examples?: JsonValue[];
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  
  // Custom extensions
  [key: string]: unknown;
}

export type JsonSchemaType = 
  | 'string' 
  | 'number' 
  | 'integer' 
  | 'boolean' 
  | 'null' 
  | 'array' 
  | 'object';

/**
 * Type guard functions
 */
export function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

export function isJsonPrimitive(value: JsonValue): value is JsonPrimitive {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Get the JSON type of a value
 */
export function getJsonType(value: JsonValue): JsonSchemaType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return 'string';
}
