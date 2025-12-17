import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  Warning,
  ClipboardText,
  Play,
  ArrowRight,
  GlobeSimple,
  CircleNotch,
  PushPin,
  FloppyDisk,
  Trash,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button, Input } from '@/components/ui';
import { parseJson, validateJsonSchema, isValidSchema, formatPath } from '@/lib/json';
import { useSetValidationErrors, useActiveDocumentSchema, useSetDocumentSchema } from '@/store/documentStore';
import type { JsonSchema, ValidationError, SchemaSource } from '@/types';

interface SchemaValidatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

export function SchemaValidatorModal({
  isOpen,
  onClose,
  content,
}: SchemaValidatorModalProps) {
  const setDocValidationErrors = useSetValidationErrors();
  const { schema: savedSchema, source: savedSchemaSource } = useActiveDocumentSchema();
  const setDocumentSchema = useSetDocumentSchema();
  const [schemaText, setSchemaText] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [hasValidated, setHasValidated] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [schemaUrl, setSchemaUrl] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  
  // Parse the JSON content to validate
  const parsedContent = useMemo(() => {
    const result = parseJson(content);
    return result.error ? null : result.value;
  }, [content]);
  
  // Check if content is valid JSON
  const contentError = useMemo(() => {
    const result = parseJson(content);
    return result.error?.message ?? null;
  }, [content]);
  
  // Parse the schema
  const parsedSchema = useMemo(() => {
    if (!schemaText.trim()) return null;
    const result = parseJson(schemaText);
    if (result.error) {
      return { error: result.error.message };
    }
    if (!isValidSchema(result.value)) {
      return { error: 'Invalid JSON Schema structure' };
    }
    return { schema: result.value as JsonSchema };
  }, [schemaText]);
  
  // Load saved schema when modal opens
  useEffect(() => {
    if (isOpen) {
      setHasValidated(false);
      setValidationErrors([]);
      setShowUrlInput(false);
      setUrlError(null);
      
      // Load saved schema if present
      if (savedSchema) {
        setSchemaText(JSON.stringify(savedSchema, null, 2));
        if (savedSchemaSource?.type === 'url') {
          setSchemaUrl(savedSchemaSource.url);
        }
      }
    }
  }, [isOpen, savedSchema, savedSchemaSource]);
  
  // Handle validation
  const handleValidate = useCallback(() => {
    if (!parsedContent) {
      setSchemaError('Cannot validate: JSON content has syntax errors');
      return;
    }
    
    if (!parsedSchema) {
      setSchemaError('Please enter a JSON Schema');
      return;
    }
    
    if ('error' in parsedSchema) {
      setSchemaError(parsedSchema.error ?? null);
      return;
    }
    
    setSchemaError(null);
    const errors = validateJsonSchema(parsedContent, parsedSchema.schema);
    setValidationErrors(errors);
    setHasValidated(true);
  }, [parsedContent, parsedSchema]);
  
  // Load schema from URL
  const handleLoadFromUrl = useCallback(async () => {
    if (!schemaUrl.trim()) {
      setUrlError('Please enter a URL');
      return;
    }
    
    // Validate URL format
    let url: URL;
    try {
      url = new URL(schemaUrl);
    } catch {
      setUrlError('Invalid URL format');
      return;
    }
    
    setIsLoadingUrl(true);
    setUrlError(null);
    
    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json, application/schema+json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      
      // Validate it's valid JSON
      const parseResult = parseJson(text);
      if (parseResult.error) {
        throw new Error('Response is not valid JSON');
      }
      
      // Validate it looks like a schema
      if (!isValidSchema(parseResult.value)) {
        throw new Error('Response does not appear to be a valid JSON Schema');
      }
      
      // Format and set
      setSchemaText(JSON.stringify(parseResult.value, null, 2));
      setShowUrlInput(false);
      setSchemaUrl('');
      setHasValidated(false);
      setValidationErrors([]);
      setSchemaError(null);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setUrlError('Failed to fetch: Network error or CORS restriction');
      } else if (err instanceof Error) {
        setUrlError(err.message);
      } else {
        setUrlError('Failed to load schema');
      }
    } finally {
      setIsLoadingUrl(false);
    }
  }, [schemaUrl]);
  
  // Load sample schema
  const loadSampleSchema = useCallback(() => {
    const sampleSchema: JsonSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        description: { type: 'string' },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          uniqueItems: true,
        },
        author: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
          required: ['name'],
        },
      },
      required: ['name', 'version'],
    };
    setSchemaText(JSON.stringify(sampleSchema, null, 2));
    setHasValidated(false);
    setValidationErrors([]);
    setSchemaError(null);
    setShowUrlInput(false);
  }, []);
  
  // Handle paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setSchemaText(text);
      setHasValidated(false);
      setValidationErrors([]);
      setSchemaError(null);
      setShowUrlInput(false);
    } catch {
      // Clipboard access denied
    }
  }, []);
  
  // Keyboard shortcuts: Cmd/Ctrl+Enter to validate, Esc to close
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (schemaText.trim() && !contentError) {
          handleValidate();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, schemaText, contentError, handleValidate]);
  
  if (!isOpen) return null;
  
  const isValid = hasValidated && validationErrors.length === 0 && !schemaError;
  const hasErrors = hasValidated && (validationErrors.length > 0 || schemaError);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-bg-elevated rounded-lg shadow-xl border border-border-default max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-text-primary">JSON Schema Validator</h2>
            {savedSchema && (
              <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded-full flex items-center gap-1">
                <FloppyDisk size={12} />
                Schema saved
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-7 w-7">
            <X size={16} />
          </Button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Content error warning */}
          {contentError && (
            <div className="p-3 bg-error/10 border border-error/30 rounded-lg flex items-start gap-2">
              <XCircle size={18} className="text-error flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-error">JSON Content Has Errors</p>
                <p className="text-xs text-text-secondary mt-0.5">{contentError}</p>
              </div>
            </div>
          )}
          
          {/* Schema Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs text-text-secondary">JSON Schema</label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className={cn("h-6 px-2 text-xs", showUrlInput && "bg-bg-hover")}
                >
                  <GlobeSimple size={14} className="mr-1" />
                  From URL
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePaste}
                  className="h-6 px-2 text-xs"
                >
                  <ClipboardText size={14} className="mr-1" />
                  Paste
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadSampleSchema}
                  className="h-6 px-2 text-xs"
                >
                  Load Sample
                </Button>
              </div>
            </div>
            
            {/* URL Input Section */}
            {showUrlInput && (
              <div className="mb-2 p-3 bg-bg-base border border-border-default rounded-lg space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={schemaUrl}
                    onChange={(e) => {
                      setSchemaUrl(e.target.value);
                      setUrlError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isLoadingUrl) {
                        handleLoadFromUrl();
                      }
                    }}
                    placeholder="https://json-schema.org/draft-07/schema"
                    className="flex-1 h-8 text-xs"
                    disabled={isLoadingUrl}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleLoadFromUrl}
                    disabled={isLoadingUrl || !schemaUrl.trim()}
                    className="h-8 px-3"
                  >
                    {isLoadingUrl ? (
                      <CircleNotch size={14} className="animate-spin" />
                    ) : (
                      'Load'
                    )}
                  </Button>
                </div>
                {urlError && (
                  <p className="text-xs text-error">{urlError}</p>
                )}
                <p className="text-xs text-text-muted">
                  Enter a URL to a JSON Schema. Note: CORS restrictions may prevent loading from some URLs.
                </p>
              </div>
            )}
            
            <textarea
              value={schemaText}
              onChange={(e) => {
                setSchemaText(e.target.value);
                setHasValidated(false);
                setSchemaError(null);
              }}
              placeholder='{\n  "type": "object",\n  "properties": { ... },\n  "required": [ ... ]\n}'
              className="w-full h-48 px-3 py-2 text-sm font-mono bg-bg-base border border-border-default rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
            />
            {parsedSchema && 'error' in parsedSchema && (
              <p className="mt-1 text-xs text-error">{parsedSchema.error}</p>
            )}
          </div>
          
          {/* Validate Button */}
          <div className="flex justify-center">
            <Button
              variant="primary"
              onClick={handleValidate}
              disabled={!schemaText.trim() || !!contentError}
              className="flex items-center gap-2"
            >
              <Play size={16} />
              Validate JSON
              <ArrowRight size={14} />
            </Button>
          </div>
          
          {/* Results */}
          {hasValidated && (
            <div className="space-y-3">
              {/* Status */}
              <div className={cn(
                'p-3 rounded-lg flex items-center gap-2',
                isValid && 'bg-success/10 border border-success/30',
                hasErrors && 'bg-error/10 border border-error/30',
              )}>
                {isValid ? (
                  <>
                    <CheckCircle size={20} className="text-success" weight="fill" />
                    <span className="text-sm font-medium text-success">
                      JSON is valid according to the schema
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={20} className="text-error" weight="fill" />
                    <span className="text-sm font-medium text-error">
                      {schemaError
                        ? 'Schema Error'
                        : `Found ${validationErrors.length} validation error${validationErrors.length === 1 ? '' : 's'}`
                      }
                    </span>
                  </>
                )}
              </div>
              
              {/* Schema Error */}
              {schemaError && (
                <div className="p-3 bg-bg-base border border-border-default rounded">
                  <p className="text-sm text-error">{schemaError}</p>
                </div>
              )}
              
              {/* Validation Errors List */}
              {validationErrors.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs text-text-secondary">Validation Errors</label>
                  <div className="max-h-48 overflow-auto space-y-2">
                    {validationErrors.map((error, index) => (
                      <div
                        key={index}
                        className="p-2 bg-bg-base border border-border-default rounded flex items-start gap-2"
                      >
                        <Warning size={16} className="text-warning flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary">{error.message}</p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            Path: <code className="font-mono text-accent">{formatPath(error.path)}</code>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-between gap-2 px-4 py-3 border-t border-border-default">
          <div className="flex gap-2">
            {/* Show in Editor button */}
            {hasValidated && validationErrors.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  setDocValidationErrors(validationErrors);
                }}
                className="flex items-center gap-2"
              >
                <PushPin size={14} />
                Show in Editor
              </Button>
            )}
            {hasValidated && validationErrors.length === 0 && !schemaError && (
              <Button
                variant="secondary"
                onClick={() => {
                  setDocValidationErrors([]);
                }}
                className="flex items-center gap-2 text-success"
              >
                <CheckCircle size={14} />
                Clear Editor Markers
              </Button>
            )}
            
            {/* Save/Remove Schema buttons */}
            {parsedSchema && 'schema' in parsedSchema && parsedSchema.schema && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const schema = parsedSchema.schema;
                    if (!schema) return;
                    const source: SchemaSource = schemaUrl 
                      ? { type: 'url', url: schemaUrl }
                      : { type: 'inline', schema };
                    setDocumentSchema(schema, source);
                  }}
                  className="flex items-center gap-2"
                  title="Associate this schema with the current document"
                >
                  <FloppyDisk size={14} />
                  Save Schema
                </Button>
              </>
            )}
            {savedSchema && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDocumentSchema(null, null);
                  setDocValidationErrors([]);
                }}
                className="flex items-center gap-2 text-error hover:text-error"
                title="Remove schema association from this document"
              >
                <Trash size={14} />
                Remove
              </Button>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
