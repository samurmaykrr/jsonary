import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  X,
  SortAscending,
  SortDescending,
  FunnelSimple,
  MagnifyingGlass,
  Plus,
  Trash,
  Play,
  ArrowsDownUp,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import type { JsonValue } from '@/types';
import { parseJson } from '@/lib/json';
import {
  queryJsonPath,
  sortArray,
  sortObjectKeys,
  filterArray,
  getAllPaths,
  type FilterCondition,
} from '@/lib/json/query';

interface TransformModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onApply: (result: string) => void;
}

type TabType = 'query' | 'sort' | 'filter';

export function TransformModal({
  isOpen,
  onClose,
  content,
  onApply,
}: TransformModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('query');
  
  // Parse the current content
  const parsedContent = useMemo(() => {
    const result = parseJson(content);
    return result.error ? null : result.value;
  }, [content]);
  
  // Get available paths for autocomplete
  const availablePaths = useMemo(() => {
    if (!parsedContent) return [];
    return getAllPaths(parsedContent);
  }, [parsedContent]);
  
  // Check if content is an array
  const isArray = Array.isArray(parsedContent);
  
  // Get sample field names for array of objects
  const fieldNames = useMemo(() => {
    if (!isArray || !parsedContent || parsedContent.length === 0) return [];
    const firstItem = parsedContent[0];
    if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
      return Object.keys(firstItem);
    }
    return [];
  }, [parsedContent, isArray]);
  
  // Keyboard shortcuts: Esc to close (Cmd/Ctrl+Enter handled in tabs)
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-bg-elevated rounded-lg shadow-xl border border-border-default max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-medium text-text-primary">Transform & Query</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-7 w-7">
            <X size={16} />
          </Button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-border-default">
          <button
            onClick={() => setActiveTab('query')}
            className={cn(
              'px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition-colors',
              activeTab === 'query'
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <MagnifyingGlass size={16} />
            JSONPath Query
          </button>
          <button
            onClick={() => setActiveTab('sort')}
            className={cn(
              'px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition-colors',
              activeTab === 'sort'
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <ArrowsDownUp size={16} />
            Sort
          </button>
          <button
            onClick={() => setActiveTab('filter')}
            className={cn(
              'px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition-colors',
              activeTab === 'filter'
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
          >
            <FunnelSimple size={16} />
            Filter
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'query' && (
            <QueryTab
              parsedContent={parsedContent}
              availablePaths={availablePaths}
              onApply={onApply}
              onClose={onClose}
            />
          )}
          {activeTab === 'sort' && (
            <SortTab
              parsedContent={parsedContent}
              isArray={isArray}
              fieldNames={fieldNames}
              onApply={onApply}
              onClose={onClose}
            />
          )}
          {activeTab === 'filter' && (
            <FilterTab
              parsedContent={parsedContent}
              isArray={isArray}
              fieldNames={fieldNames}
              onApply={onApply}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Query Tab
// ============================================

interface QueryTabProps {
  parsedContent: JsonValue | null;
  availablePaths: string[];
  onApply: (result: string) => void;
  onClose: () => void;
}

function QueryTab({ parsedContent, availablePaths, onApply, onClose }: QueryTabProps) {
  const [query, setQuery] = useState('$');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<JsonValue | null>(null);
  
  // Execute query on input change (debounced)
  useEffect(() => {
    if (!parsedContent || !query.trim()) {
      setPreview(null);
      setError(null);
      return;
    }
    
    const timer = setTimeout(() => {
      try {
        const results = queryJsonPath(parsedContent, query);
        if (results.length === 0) {
          setPreview(null);
          setError('No results found');
        } else if (results.length === 1) {
          setPreview(results[0]?.value ?? null);
          setError(null);
        } else {
          setPreview(results.map(r => r.value));
          setError(null);
        }
      } catch (e) {
        setError((e as Error).message);
        setPreview(null);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, parsedContent]);
  
  const handleApply = useCallback(() => {
    if (preview !== null) {
      onApply(JSON.stringify(preview, null, 2));
      onClose();
    }
  }, [preview, onApply, onClose]);
  
  // Keyboard shortcut: Cmd/Ctrl+Enter to apply
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (preview !== null) {
          handleApply();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preview, handleApply]);
  
  return (
    <div className="p-4 space-y-4">
      {/* Query Input */}
      <div>
        <label className="block text-xs text-text-secondary mb-1.5">JSONPath Expression</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="$.store.book[*].author"
          className="w-full px-3 py-2 text-sm font-mono bg-bg-base border border-border-default rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
      
      {/* Path Suggestions */}
      <div>
        <label className="block text-xs text-text-secondary mb-1.5">Available Paths</label>
        <div className="max-h-24 overflow-auto bg-bg-base border border-border-default rounded p-2">
          <div className="flex flex-wrap gap-1">
            {availablePaths.slice(0, 20).map((path) => (
              <button
                key={path}
                onClick={() => setQuery(path)}
                className="px-2 py-0.5 text-xs font-mono bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary rounded border border-border-subtle transition-colors"
              >
                {path}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Preview */}
      <div>
        <label className="block text-xs text-text-secondary mb-1.5">Preview</label>
        <pre className="max-h-48 overflow-auto bg-bg-base border border-border-default rounded p-3 text-xs font-mono text-text-primary">
          {preview !== null
            ? JSON.stringify(preview, null, 2)
            : 'No results'
          }
        </pre>
      </div>
      
      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleApply}
          disabled={preview === null}
          className="flex items-center gap-2"
        >
          <Play size={14} />
          Apply Query
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Sort Tab
// ============================================

interface SortTabProps {
  parsedContent: JsonValue | null;
  isArray: boolean;
  fieldNames: string[];
  onApply: (result: string) => void;
  onClose: () => void;
}

function SortTab({ parsedContent, isArray, fieldNames, onApply, onClose }: SortTabProps) {
  const [sortMode, setSortMode] = useState<'array' | 'keys'>('array');
  const [sortField, setSortField] = useState(fieldNames[0] ?? '');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [sortType, setSortType] = useState<'auto' | 'string' | 'number' | 'natural'>('auto');
  const [recursive, setRecursive] = useState(true);
  const [preview, setPreview] = useState<JsonValue | null>(null);
  
  // Update sort field when field names change
  useEffect(() => {
    if (fieldNames.length > 0 && !fieldNames.includes(sortField)) {
      setSortField(fieldNames[0] ?? '');
    }
  }, [fieldNames, sortField]);
  
  // Generate preview
  useEffect(() => {
    if (!parsedContent) {
      setPreview(null);
      return;
    }
    
    try {
      if (sortMode === 'array' && Array.isArray(parsedContent)) {
        const sorted = sortArray(parsedContent, sortField, sortDirection, sortType);
        setPreview(sorted);
      } else if (sortMode === 'keys') {
        const sorted = sortObjectKeys(parsedContent, sortDirection, recursive);
        setPreview(sorted);
      } else {
        setPreview(null);
      }
    } catch {
      setPreview(null);
    }
  }, [parsedContent, sortMode, sortField, sortDirection, sortType, recursive]);
  
  const handleApply = useCallback(() => {
    if (preview !== null) {
      onApply(JSON.stringify(preview, null, 2));
      onClose();
    }
  }, [preview, onApply, onClose]);
  
  // Keyboard shortcut: Cmd/Ctrl+Enter to apply
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (preview !== null) {
          handleApply();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preview, handleApply]);
  
  return (
    <div className="p-4 space-y-4">
      {/* Sort Mode */}
      <div>
        <label className="block text-xs text-text-secondary mb-1.5">Sort Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => setSortMode('array')}
            disabled={!isArray}
            className={cn(
              'flex-1 px-3 py-2 text-sm rounded border transition-colors',
              sortMode === 'array'
                ? 'bg-accent/10 border-accent text-text-primary'
                : 'bg-bg-base border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong',
              !isArray && 'opacity-50 cursor-not-allowed'
            )}
          >
            <SortAscending className="w-4 h-4 inline mr-2" />
            Sort Array
          </button>
          <button
            onClick={() => setSortMode('keys')}
            className={cn(
              'flex-1 px-3 py-2 text-sm rounded border transition-colors',
              sortMode === 'keys'
                ? 'bg-accent/10 border-accent text-text-primary'
                : 'bg-bg-base border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong'
            )}
          >
            <ArrowsDownUp className="w-4 h-4 inline mr-2" />
            Sort Object Keys
          </button>
        </div>
      </div>
      
      {/* Array Sort Options */}
      {sortMode === 'array' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Sort By Field</label>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-base border border-border-default rounded text-text-primary focus:outline-none focus:border-accent"
            >
              {fieldNames.map((field) => (
                <option key={field} value={field}>{field}</option>
              ))}
              <option value="">Custom path...</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Sort Type</label>
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value as 'auto' | 'string' | 'number' | 'natural')}
              className="w-full px-3 py-2 text-sm bg-bg-base border border-border-default rounded text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="auto">Auto-detect</option>
              <option value="string">Alphabetical</option>
              <option value="number">Numeric</option>
              <option value="natural">Natural (item1, item2, item10)</option>
            </select>
          </div>
        </div>
      )}
      
      {/* Object Sort Options */}
      {sortMode === 'keys' && (
        <div>
          <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) => setRecursive(e.target.checked)}
              className="w-4 h-4 rounded border-border-default text-accent focus:ring-accent"
            />
            Sort keys recursively (nested objects)
          </label>
        </div>
      )}
      
      {/* Direction */}
      <div>
        <label className="block text-xs text-text-secondary mb-1.5">Direction</label>
        <div className="flex gap-2">
          <button
            onClick={() => setSortDirection('asc')}
            className={cn(
              'flex-1 px-3 py-2 text-sm rounded border flex items-center justify-center gap-2 transition-colors',
              sortDirection === 'asc'
                ? 'bg-accent/10 border-accent text-text-primary'
                : 'bg-bg-base border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong'
            )}
          >
            <SortAscending className="w-4 h-4" />
            Ascending
          </button>
          <button
            onClick={() => setSortDirection('desc')}
            className={cn(
              'flex-1 px-3 py-2 text-sm rounded border flex items-center justify-center gap-2 transition-colors',
              sortDirection === 'desc'
                ? 'bg-accent/10 border-accent text-text-primary'
                : 'bg-bg-base border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong'
            )}
          >
            <SortDescending className="w-4 h-4" />
            Descending
          </button>
        </div>
      </div>
      
      {/* Preview */}
      <div>
        <label className="block text-xs text-text-secondary mb-1.5">Preview</label>
        <pre className="max-h-40 overflow-auto bg-bg-base border border-border-default rounded p-3 text-xs font-mono text-text-primary">
          {preview !== null
            ? JSON.stringify(preview, null, 2).slice(0, 2000) + (JSON.stringify(preview, null, 2).length > 2000 ? '\n...' : '')
            : 'No preview available'
          }
        </pre>
      </div>
      
      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleApply}
          disabled={preview === null}
          className="flex items-center gap-2"
        >
          <Play size={14} />
          Apply Sort
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Filter Tab
// ============================================

interface FilterTabProps {
  parsedContent: JsonValue | null;
  isArray: boolean;
  fieldNames: string[];
  onApply: (result: string) => void;
  onClose: () => void;
}

type OperatorType = FilterCondition['operator'];

const OPERATORS: { value: OperatorType; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'notEquals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'does not contain' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater than or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
];

function FilterTab({ parsedContent, isArray, fieldNames, onApply, onClose }: FilterTabProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { field: fieldNames[0] ?? '', operator: 'equals', value: '' },
  ]);
  const [logic, setLogic] = useState<'and' | 'or'>('and');
  const [preview, setPreview] = useState<JsonValue[] | null>(null);
  
  // Update conditions when field names change
  useEffect(() => {
    if (fieldNames.length > 0 && conditions.length === 1 && conditions[0]?.field === '') {
      setConditions([{ field: fieldNames[0] ?? '', operator: 'equals', value: '' }]);
    }
  }, [fieldNames, conditions]);
  
  // Generate preview
  useEffect(() => {
    if (!parsedContent || !isArray) {
      setPreview(null);
      return;
    }
    
    // Filter out incomplete conditions
    const validConditions = conditions.filter(c => 
      c.field && (c.operator === 'isEmpty' || c.operator === 'isNotEmpty' || c.value !== '')
    );
    
    if (validConditions.length === 0) {
      setPreview(parsedContent as JsonValue[]);
      return;
    }
    
    try {
      const filtered = filterArray(parsedContent as JsonValue[], validConditions, logic);
      setPreview(filtered);
    } catch {
      setPreview(null);
    }
  }, [parsedContent, isArray, conditions, logic]);
  
  const addCondition = useCallback(() => {
    setConditions(prev => [...prev, { field: fieldNames[0] ?? '', operator: 'equals', value: '' }]);
  }, [fieldNames]);
  
  const removeCondition = useCallback((index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const updateCondition = useCallback((index: number, updates: Partial<FilterCondition>) => {
    setConditions(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  }, []);
  
  const handleApply = useCallback(() => {
    if (preview !== null) {
      onApply(JSON.stringify(preview, null, 2));
      onClose();
    }
  }, [preview, onApply, onClose]);
  
  // Keyboard shortcut: Cmd/Ctrl+Enter to apply
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (preview !== null) {
          handleApply();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preview, handleApply]);
  
  if (!isArray) {
    return (
      <div className="p-4 text-center text-text-secondary">
        <FunnelSimple className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Filter is only available for JSON arrays.</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 space-y-4">
      {/* Logic Selector */}
      <div>
        <label className="block text-xs text-text-secondary mb-1.5">Match</label>
        <div className="flex gap-2">
          <button
            onClick={() => setLogic('and')}
            className={cn(
              'px-4 py-1.5 text-sm rounded border transition-colors',
              logic === 'and'
                ? 'bg-accent/10 border-accent text-text-primary'
                : 'bg-bg-base border-border-default text-text-secondary hover:text-text-primary'
            )}
          >
            All conditions (AND)
          </button>
          <button
            onClick={() => setLogic('or')}
            className={cn(
              'px-4 py-1.5 text-sm rounded border transition-colors',
              logic === 'or'
                ? 'bg-accent/10 border-accent text-text-primary'
                : 'bg-bg-base border-border-default text-text-secondary hover:text-text-primary'
            )}
          >
            Any condition (OR)
          </button>
        </div>
      </div>
      
      {/* Conditions */}
      <div className="space-y-2">
        <label className="block text-xs text-text-secondary">Conditions</label>
        {conditions.map((condition, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              value={condition.field}
              onChange={(e) => updateCondition(index, { field: e.target.value })}
              className="flex-1 px-2 py-1.5 text-sm bg-bg-base border border-border-default rounded text-text-primary focus:outline-none focus:border-accent"
            >
              {fieldNames.map((field) => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
            <select
              value={condition.operator}
              onChange={(e) => updateCondition(index, { operator: e.target.value as OperatorType })}
              className="w-40 px-2 py-1.5 text-sm bg-bg-base border border-border-default rounded text-text-primary focus:outline-none focus:border-accent"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            {condition.operator !== 'isEmpty' && condition.operator !== 'isNotEmpty' && (
              <input
                type="text"
                value={String(condition.value ?? '')}
                onChange={(e) => updateCondition(index, { value: e.target.value })}
                placeholder="Value"
                className="flex-1 px-2 py-1.5 text-sm bg-bg-base border border-border-default rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeCondition(index)}
              disabled={conditions.length === 1}
              className="p-1 h-7 w-7 text-text-muted hover:text-error"
            >
              <Trash size={14} />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={addCondition}
          className="text-text-secondary hover:text-text-primary flex items-center gap-1"
        >
          <Plus size={14} />
          Add Condition
        </Button>
      </div>
      
      {/* Preview */}
      <div>
        <label className="block text-xs text-text-secondary mb-1.5">
          Preview {preview && `(${preview.length} results)`}
        </label>
        <pre className="max-h-40 overflow-auto bg-bg-base border border-border-default rounded p-3 text-xs font-mono text-text-primary">
          {preview !== null
            ? JSON.stringify(preview, null, 2).slice(0, 2000) + (JSON.stringify(preview, null, 2).length > 2000 ? '\n...' : '')
            : 'No preview available'
          }
        </pre>
      </div>
      
      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleApply}
          disabled={preview === null}
          className="flex items-center gap-2"
        >
          <Play size={14} />
          Apply Filter
        </Button>
      </div>
    </div>
  );
}
