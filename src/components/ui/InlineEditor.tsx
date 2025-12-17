import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { JsonValue } from '@/types';

type JsonPrimitiveType = 'string' | 'number' | 'boolean' | 'null';

interface InlineEditorProps {
  value: JsonValue;
  onSave: (newValue: JsonValue) => void;
  onCancel: () => void;
  className?: string;
  /** When true, the input fills the container width instead of using fixed 120px width */
  fitContainer?: boolean;
}

/**
 * Detect the type of a JSON primitive value
 */
function detectType(value: JsonValue): JsonPrimitiveType {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

/**
 * Parse string input into appropriate JSON value based on type
 */
function parseValue(input: string, type: JsonPrimitiveType): JsonValue {
  switch (type) {
    case 'null':
      return null;
    case 'boolean':
      return input.toLowerCase() === 'true';
    case 'number': {
      const num = parseFloat(input);
      return isNaN(num) ? 0 : num;
    }
    case 'string':
    default:
      return input;
  }
}

/**
 * Convert JSON value to display string for editing
 */
function valueToString(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  return String(value);
}

/**
 * Inline editor for JSON primitive values
 * Supports string, number, boolean, and null types
 */
export function InlineEditor({ value, onSave, onCancel, className, fitContainer = false }: InlineEditorProps) {
  const [editValue, setEditValue] = useState(valueToString(value));
  const [valueType, setValueType] = useState<JsonPrimitiveType>(detectType(value));
  const [isReady, setIsReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boolSelectRef = useRef<HTMLSelectElement>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  
  // Focus input on mount, but delay setting ready state to prevent immediate blur
  useEffect(() => {
    const timer = setTimeout(() => {
      if (valueType === 'boolean') {
        boolSelectRef.current?.focus();
      } else if (valueType !== 'null') {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      // Mark as ready after focus is established
      setIsReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [valueType]);
  
  // Handle save
  const handleSave = useCallback(() => {
    const newValue = parseValue(editValue, valueType);
    onSave(newValue);
  }, [editValue, valueType, onSave]);
  
  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation(); // Prevent event from bubbling to parent TreeNode
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave, onCancel]);
  
  // Handle type change
  const handleTypeChange = useCallback((newType: JsonPrimitiveType) => {
    setValueType(newType);
    
    // Set appropriate default value for the new type
    switch (newType) {
      case 'null':
        setEditValue('null');
        break;
      case 'boolean':
        setEditValue('true');
        break;
      case 'number':
        setEditValue('0');
        break;
      case 'string':
        setEditValue('');
        break;
    }
    
    // Focus appropriate element after type change
    setTimeout(() => {
      if (newType === 'boolean') {
        boolSelectRef.current?.focus();
      } else if (newType !== 'null') {
        inputRef.current?.focus();
      }
    }, 0);
  }, []);
  
  // Handle blur - save on blur unless cancelled
  // Only process blur events after the editor is ready (focus established)
  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!isReady) return; // Ignore blur events during initialization
    
    // Check if the focus is moving to another element within the inline editor
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('.inline-editor-container')) {
      return;
    }
    handleSave();
  }, [handleSave, isReady]);
  
  // Render different input based on type
  const renderInput = () => {
    const inputWidthClass = fitContainer ? 'flex-1 min-w-0' : 'w-[120px]';
    
    if (valueType === 'null') {
      return (
        <span className={cn('text-syntax-null px-1 inline-block', inputWidthClass)}>null</span>
      );
    }
    
    if (valueType === 'boolean') {
      return (
        <select
          ref={boolSelectRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={cn(
            'h-6 px-1 text-sm bg-bg-base border border-accent rounded',
            'text-syntax-boolean outline-none',
            inputWidthClass
          )}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }
    
    return (
      <input
        ref={inputRef}
        type={valueType === 'number' ? 'number' : 'text'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        step={valueType === 'number' ? 'any' : undefined}
        className={cn(
          'h-6 px-1 text-sm bg-bg-base border border-accent rounded',
          'outline-none focus:ring-1 focus:ring-accent/50',
          valueType === 'string' && 'text-syntax-string',
          valueType === 'number' && 'text-syntax-number',
          inputWidthClass
        )}
      />
    );
  };
  
  return (
    <div 
      className={cn(
        'inline-editor-container inline-flex items-center gap-1',
        fitContainer && 'w-full',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {renderInput()}
      
      {/* Type selector */}
      <select
        ref={typeSelectRef}
        value={valueType}
        onChange={(e) => handleTypeChange(e.target.value as JsonPrimitiveType)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          'h-6 px-1 text-xs bg-bg-surface border border-border-default rounded flex-shrink-0',
          'text-text-secondary outline-none cursor-pointer'
        )}
        title="Change value type"
      >
        <option value="string">string</option>
        <option value="number">number</option>
        <option value="boolean">boolean</option>
        <option value="null">null</option>
      </select>
    </div>
  );
}
