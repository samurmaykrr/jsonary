import type { JsonValue, JsonSchema } from './json';

/**
 * Document source types
 */
export type DocumentSource = 
  | { type: 'new' }
  | { type: 'file'; path: string; name: string }
  | { type: 'url'; url: string }
  | { type: 'storage'; key: string };

/**
 * View mode for the editor
 */
export type ViewMode = 'text' | 'tree' | 'table';

/**
 * Schema source configuration
 */
export type SchemaSource = 
  | { type: 'inline'; schema: JsonSchema }
  | { type: 'url'; url: string }
  | { type: 'file'; path: string }
  | { type: 'document'; documentId: string };

/**
 * Parse error information
 */
export interface ParseError {
  message: string;
  line: number;
  column: number;
  offset: number;
  length: number;
}

/**
 * Validation error from schema validation
 */
export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
  schemaPath: string;
}

/**
 * Document state
 */
export interface Document {
  id: string;
  name: string;
  content: string;
  
  // Metadata
  createdAt: number;
  modifiedAt: number;
  savedAt: number | null;
  source: DocumentSource;
  
  // Editor state
  viewMode: ViewMode;
  
  // Schema
  schema: JsonSchema | null;
  schemaSource: SchemaSource | null;
  validationErrors: ValidationError[];
  
  // Flags
  isDirty: boolean;
  isValid: boolean;
  parseError: ParseError | null;
}

/**
 * Create a new empty document
 */
export function createDocument(
  id: string,
  name: string = 'Untitled',
  content: string = '{}'
): Document {
  const now = Date.now();
  return {
    id,
    name,
    content,
    createdAt: now,
    modifiedAt: now,
    savedAt: null,
    source: { type: 'new' },
    viewMode: 'text',
    schema: null,
    schemaSource: null,
    validationErrors: [],
    isDirty: false,
    isValid: true,
    parseError: null,
  };
}

/**
 * Cached parsed value for a document
 * This is stored separately from the document to avoid serialization issues
 */
export interface ParsedDocument {
  documentId: string;
  value: JsonValue | null;
  parseError: ParseError | null;
  parsedAt: number;
}
