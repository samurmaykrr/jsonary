/**
 * Validate Worker
 * Offloads JSON schema validation to a separate thread for large documents
 * 
 * Note: This worker implements basic JSON validation. For full JSON Schema
 * validation, the main thread should be used with the ajv library since
 * ajv is too complex to bundle into a worker efficiently.
 */

import type { JsonValue } from '../types';

// Types for validation
interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
  schemaPath: string;
}

interface BasicSchema {
  type?: string | string[];
  properties?: Record<string, BasicSchema>;
  items?: BasicSchema | BasicSchema[];
  required?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  enum?: JsonValue[];
  pattern?: string;
}

// Message types
interface ValidateSyntaxMessage {
  type: 'validate-syntax';
  id: string;
  input: string;
}

interface ValidateBasicSchemaMessage {
  type: 'validate-basic-schema';
  id: string;
  data: JsonValue;
  schema: BasicSchema;
}

interface ValidateSyntaxResponse {
  type: 'validate-syntax-result';
  id: string;
  valid: boolean;
  error: { message: string; line: number; column: number; offset: number } | null;
}

interface ValidateBasicSchemaResponse {
  type: 'validate-basic-schema-result';
  id: string;
  valid: boolean;
  errors: ValidationError[];
}

type WorkerMessage = ValidateSyntaxMessage | ValidateBasicSchemaMessage;

/**
 * Extract line and column from JSON parse error
 */
function getErrorLocation(input: string, error: SyntaxError): { line: number; column: number; offset: number } {
  const match = error.message.match(/position\s+(\d+)/i) 
    ?? error.message.match(/at\s+(\d+)/i)
    ?? error.message.match(/column\s+(\d+)/i);
  
  let offset = 0;
  if (match?.[1]) {
    offset = parseInt(match[1], 10);
  }
  
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
 * Validate JSON syntax
 */
function validateSyntax(input: string): { valid: boolean; error: { message: string; line: number; column: number; offset: number } | null } {
  try {
    JSON.parse(input);
    return { valid: true, error: null };
  } catch (e) {
    const error = e as SyntaxError;
    const { line, column, offset } = getErrorLocation(input, error);
    return {
      valid: false,
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
 * Get JSON type
 */
function getJsonType(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Basic schema validation (subset of JSON Schema)
 * This is a simplified implementation that handles common cases
 */
function validateBasicSchema(
  data: JsonValue,
  schema: BasicSchema,
  path: string = ''
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Type validation
  if (schema.type) {
    const actualType = getJsonType(data);
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    
    // Handle 'integer' type
    const normalizedTypes = expectedTypes.map(t => t === 'integer' ? 'number' : t);
    
    if (!normalizedTypes.includes(actualType)) {
      // Special case for integer - check if number is whole
      if (expectedTypes.includes('integer') && actualType === 'number') {
        if (!Number.isInteger(data)) {
          errors.push({
            path: path || '/',
            message: `Expected integer, got ${data}`,
            keyword: 'type',
            params: { type: 'integer' },
            schemaPath: '#/type',
          });
        }
      } else {
        errors.push({
          path: path || '/',
          message: `Expected ${expectedTypes.join(' or ')}, got ${actualType}`,
          keyword: 'type',
          params: { type: schema.type },
          schemaPath: '#/type',
        });
        return errors; // Type mismatch, skip further validation
      }
    }
  }
  
  // String validations
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({
        path: path || '/',
        message: `String must be at least ${schema.minLength} characters`,
        keyword: 'minLength',
        params: { limit: schema.minLength },
        schemaPath: '#/minLength',
      });
    }
    
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({
        path: path || '/',
        message: `String must be at most ${schema.maxLength} characters`,
        keyword: 'maxLength',
        params: { limit: schema.maxLength },
        schemaPath: '#/maxLength',
      });
    }
    
    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        errors.push({
          path: path || '/',
          message: `String does not match pattern: ${schema.pattern}`,
          keyword: 'pattern',
          params: { pattern: schema.pattern },
          schemaPath: '#/pattern',
        });
      }
    }
  }
  
  // Number validations
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({
        path: path || '/',
        message: `Value must be >= ${schema.minimum}`,
        keyword: 'minimum',
        params: { limit: schema.minimum },
        schemaPath: '#/minimum',
      });
    }
    
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({
        path: path || '/',
        message: `Value must be <= ${schema.maximum}`,
        keyword: 'maximum',
        params: { limit: schema.maximum },
        schemaPath: '#/maximum',
      });
    }
  }
  
  // Array validations
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({
        path: path || '/',
        message: `Array must have at least ${schema.minItems} items`,
        keyword: 'minItems',
        params: { limit: schema.minItems },
        schemaPath: '#/minItems',
      });
    }
    
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({
        path: path || '/',
        message: `Array must have at most ${schema.maxItems} items`,
        keyword: 'maxItems',
        params: { limit: schema.maxItems },
        schemaPath: '#/maxItems',
      });
    }
    
    // Validate items
    if (schema.items) {
      if (Array.isArray(schema.items)) {
        // Tuple validation
        for (let i = 0; i < Math.min(data.length, schema.items.length); i++) {
          const itemSchema = schema.items[i];
          const item = data[i];
          if (itemSchema && item !== undefined) {
            errors.push(...validateBasicSchema(item, itemSchema, `${path}[${i}]`));
          }
        }
      } else {
        // All items validation
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if (item !== undefined) {
            errors.push(...validateBasicSchema(item, schema.items, `${path}[${i}]`));
          }
        }
      }
    }
  }
  
  // Object validations
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    // Required properties
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in data)) {
          errors.push({
            path: path || '/',
            message: `Missing required property: ${key}`,
            keyword: 'required',
            params: { missingProperty: key },
            schemaPath: '#/required',
          });
        }
      }
    }
    
    // Property validation
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          const value = (data as Record<string, JsonValue>)[key];
          if (value !== undefined) {
            const propPath = path ? `${path}.${key}` : key;
            errors.push(...validateBasicSchema(value, propSchema, propPath));
          }
        }
      }
    }
  }
  
  // Enum validation
  if (schema.enum !== undefined) {
    const found = schema.enum.some(v => JSON.stringify(v) === JSON.stringify(data));
    if (!found) {
      errors.push({
        path: path || '/',
        message: `Value must be one of: ${schema.enum.map(v => JSON.stringify(v)).join(', ')}`,
        keyword: 'enum',
        params: { allowedValues: schema.enum },
        schemaPath: '#/enum',
      });
    }
  }
  
  return errors;
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  
  switch (message.type) {
    case 'validate-syntax': {
      const result = validateSyntax(message.input);
      const response: ValidateSyntaxResponse = {
        type: 'validate-syntax-result',
        id: message.id,
        valid: result.valid,
        error: result.error,
      };
      self.postMessage(response);
      break;
    }
    
    case 'validate-basic-schema': {
      try {
        const errors = validateBasicSchema(message.data, message.schema);
        const response: ValidateBasicSchemaResponse = {
          type: 'validate-basic-schema-result',
          id: message.id,
          valid: errors.length === 0,
          errors,
        };
        self.postMessage(response);
      } catch (e) {
        const response: ValidateBasicSchemaResponse = {
          type: 'validate-basic-schema-result',
          id: message.id,
          valid: false,
          errors: [{
            path: '/',
            message: e instanceof Error ? e.message : 'Validation failed',
            keyword: 'error',
            params: {},
            schemaPath: '#',
          }],
        };
        self.postMessage(response);
      }
      break;
    }
  }
};

export {};
