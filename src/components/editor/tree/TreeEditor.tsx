import { useState, useMemo, useCallback, useRef } from 'react';
import { 
  CaretRight, 
  CaretDown,
  CaretLeft,
  CaretDoubleLeft,
  CaretDoubleRight,
  Hash,
  TextT,
  ToggleLeft,
  Placeholder,
  BracketsCurly,
  BracketsSquare,
  Copy,
  ClipboardText,
  Trash,
  PencilSimple,
  Plus,
  CopySimple,
  Check,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { parseJson } from '@/lib/json';
import { useCurrentDocument, useUpdateCurrentContent } from '@/store/useDocumentStore';
import { ContextMenu, useContextMenu, InlineEditor, type ContextMenuItem } from '@/components/ui';
import type { JsonValue, JsonObject } from '@/types';

// Maximum items to show per page in large arrays
const ARRAY_PAGE_SIZE = 100;

interface TreeNodeProps {
  keyName: string | number | null;
  value: JsonValue;
  path: string;
  depth: number;
  expandedPaths: Set<string>;
  editingPath: string | null;
  selectedPath: string | null;
  arrayPageMap: Map<string, number>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, value: JsonValue, keyName: string | number | null) => void;
  onStartEdit: (path: string) => void;
  onSaveEdit: (path: string, newValue: JsonValue) => void;
  onCancelEdit: () => void;
  onArrayPageChange: (path: string, page: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

function getTypeIcon(value: JsonValue) {
  if (value === null) return <Placeholder className="w-3.5 h-3.5 text-syntax-null" />;
  if (typeof value === 'boolean') return <ToggleLeft className="w-3.5 h-3.5 text-syntax-boolean" />;
  if (typeof value === 'number') return <Hash className="w-3.5 h-3.5 text-syntax-number" />;
  if (typeof value === 'string') return <TextT className="w-3.5 h-3.5 text-syntax-string" />;
  if (Array.isArray(value)) return <BracketsSquare className="w-3.5 h-3.5 text-syntax-bracket" />;
  return <BracketsCurly className="w-3.5 h-3.5 text-syntax-bracket" />;
}

function TreeNode({ 
  keyName, 
  value, 
  path, 
  depth, 
  expandedPaths, 
  editingPath,
  selectedPath,
  arrayPageMap,
  onToggle,
  onSelect,
  onContextMenu,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onArrayPageChange,
  onKeyDown,
  nodeRefs,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(path);
  const isExpandable = value !== null && typeof value === 'object';
  const hasChildren = isExpandable && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0);
  const isPrimitive = value === null || typeof value !== 'object';
  const isEditing = editingPath === path;
  const isSelected = selectedPath === path;
  
  const childCount = isExpandable 
    ? Array.isArray(value) ? value.length : Object.keys(value).length
    : 0;
  
  // Array pagination
  const isLargeArray = Array.isArray(value) && value.length > ARRAY_PAGE_SIZE;
  const currentPage = arrayPageMap.get(path) ?? 0;
  const pageStart = currentPage * ARRAY_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + ARRAY_PAGE_SIZE, Array.isArray(value) ? value.length : 0);
  
  const handleToggle = useCallback(() => {
    if (hasChildren) {
      onToggle(path);
    }
  }, [hasChildren, onToggle, path]);
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(path);
  }, [onSelect, path]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(path);
    onContextMenu(e, path, value, keyName);
  }, [onContextMenu, path, value, keyName, onSelect]);
  
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPrimitive) {
      onStartEdit(path);
    } else if (hasChildren) {
      onToggle(path);
    }
  }, [isPrimitive, hasChildren, onStartEdit, onToggle, path]);
  
  const handleSave = useCallback((newValue: JsonValue) => {
    onSaveEdit(path, newValue);
  }, [onSaveEdit, path]);
  
  // Register ref for keyboard navigation
  const nodeRefsMap = nodeRefs.current;
  const nodeRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      nodeRefsMap.set(path, el);
    } else {
      nodeRefsMap.delete(path);
    }
  }, [path, nodeRefsMap]);
  
  const renderValue = () => {
    // Show inline editor if editing this node
    if (isEditing) {
      return (
        <InlineEditor
          value={value}
          onSave={handleSave}
          onCancel={onCancelEdit}
        />
      );
    }
    
    if (value === null) {
      return <span className="text-syntax-null">null</span>;
    }
    if (typeof value === 'boolean') {
      return <span className="text-syntax-boolean">{String(value)}</span>;
    }
    if (typeof value === 'number') {
      return <span className="text-syntax-number">{value}</span>;
    }
    if (typeof value === 'string') {
      const displayValue = value.length > 100 ? value.slice(0, 100) + '...' : value;
      return <span className="text-syntax-string">"{displayValue}"</span>;
    }
    if (Array.isArray(value)) {
      return (
        <span className="text-text-tertiary">
          [{childCount} {childCount === 1 ? 'item' : 'items'}]
        </span>
      );
    }
    return (
      <span className="text-text-tertiary">
        {'{' + childCount + ' ' + (childCount === 1 ? 'key' : 'keys') + '}'}
      </span>
    );
  };
  
  const renderChildren = () => {
    if (!isExpanded || !isExpandable) return null;
    
    if (Array.isArray(value)) {
      // For large arrays, render pagination controls and only the current page
      if (isLargeArray) {
        const totalPages = Math.ceil(value.length / ARRAY_PAGE_SIZE);
        const visibleItems = value.slice(pageStart, pageEnd);
        
        return (
          <div>
            {/* Pagination controls */}
            <div 
              className="flex items-center gap-2 py-1 px-2 mx-2 my-1 bg-bg-surface rounded border border-border-subtle"
              style={{ marginLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              <button
                onClick={() => onArrayPageChange(path, 0)}
                disabled={currentPage === 0}
                className={cn(
                  'p-1 rounded transition-colors',
                  currentPage === 0 
                    ? 'text-text-muted cursor-not-allowed' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                )}
                title="First page"
              >
                <CaretDoubleLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onArrayPageChange(path, currentPage - 1)}
                disabled={currentPage === 0}
                className={cn(
                  'p-1 rounded transition-colors',
                  currentPage === 0 
                    ? 'text-text-muted cursor-not-allowed' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                )}
                title="Previous page"
              >
                <CaretLeft className="w-3.5 h-3.5" />
              </button>
              
              <span className="text-xs text-text-secondary px-2">
                Items {pageStart} - {pageEnd - 1} of {value.length}
              </span>
              
              <button
                onClick={() => onArrayPageChange(path, currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className={cn(
                  'p-1 rounded transition-colors',
                  currentPage >= totalPages - 1 
                    ? 'text-text-muted cursor-not-allowed' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                )}
                title="Next page"
              >
                <CaretRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onArrayPageChange(path, totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
                className={cn(
                  'p-1 rounded transition-colors',
                  currentPage >= totalPages - 1 
                    ? 'text-text-muted cursor-not-allowed' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                )}
                title="Last page"
              >
                <CaretDoubleRight className="w-3.5 h-3.5" />
              </button>
              
              {/* Jump to page */}
              <select
                value={currentPage}
                onChange={(e) => onArrayPageChange(path, parseInt(e.target.value, 10))}
                className="text-xs bg-bg-primary text-text-primary border border-border-subtle rounded px-1 py-0.5 ml-2"
              >
                {Array.from({ length: totalPages }, (_, i) => (
                  <option key={i} value={i}>
                    Page {i + 1} ({i * ARRAY_PAGE_SIZE}-{Math.min((i + 1) * ARRAY_PAGE_SIZE - 1, value.length - 1)})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Render visible items */}
            {visibleItems.map((item, localIndex) => {
              const actualIndex = pageStart + localIndex;
              return (
                <TreeNode
                  key={actualIndex}
                  keyName={actualIndex}
                  value={item}
                  path={`${path}[${actualIndex}]`}
                  depth={depth + 1}
                  expandedPaths={expandedPaths}
                  editingPath={editingPath}
                  selectedPath={selectedPath}
                  arrayPageMap={arrayPageMap}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onContextMenu={onContextMenu}
                  onStartEdit={onStartEdit}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                  onArrayPageChange={onArrayPageChange}
                  onKeyDown={onKeyDown}
                  nodeRefs={nodeRefs}
                />
              );
            })}
          </div>
        );
      }
      
      // Small array - render all items
      return value.map((item, index) => (
        <TreeNode
          key={index}
          keyName={index}
          value={item}
          path={`${path}[${index}]`}
          depth={depth + 1}
          expandedPaths={expandedPaths}
          editingPath={editingPath}
          selectedPath={selectedPath}
          arrayPageMap={arrayPageMap}
          onToggle={onToggle}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          onStartEdit={onStartEdit}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onArrayPageChange={onArrayPageChange}
          onKeyDown={onKeyDown}
          nodeRefs={nodeRefs}
        />
      ));
    }
    
    return Object.entries(value as JsonObject).map(([key, val]) => (
      <TreeNode
        key={key}
        keyName={key}
        value={val}
        path={path ? `${path}.${key}` : key}
        depth={depth + 1}
        expandedPaths={expandedPaths}
        editingPath={editingPath}
        selectedPath={selectedPath}
        arrayPageMap={arrayPageMap}
        onToggle={onToggle}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
        onStartEdit={onStartEdit}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        onArrayPageChange={onArrayPageChange}
        onKeyDown={onKeyDown}
        nodeRefs={nodeRefs}
      />
    ));
  };
  
  return (
    <div className="select-none">
      <div
        ref={nodeRef}
        data-path={path}
        tabIndex={isSelected ? 0 : -1}
        className={cn(
          'flex items-center gap-1 py-0.5 px-2 rounded cursor-pointer group',
          'transition-colors outline-none',
          isSelected 
            ? 'bg-accent/20 ring-1 ring-accent/50' 
            : 'hover:bg-bg-hover',
          isEditing && 'bg-bg-hover'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={onKeyDown}
      >
        {/* Expand/Collapse Arrow */}
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleToggle(); }}
              className="hover:bg-bg-active rounded"
            >
              {isExpanded ? (
                <CaretDown className="w-3 h-3 text-text-tertiary" />
              ) : (
                <CaretRight className="w-3 h-3 text-text-tertiary" />
              )}
            </button>
          ) : null}
        </span>
        
        {/* Type Icon */}
        <span className="flex-shrink-0">
          {getTypeIcon(value)}
        </span>
        
        {/* Key */}
        {keyName !== null && (
          <>
            <span className={cn(
              'font-medium',
              typeof keyName === 'number' ? 'text-syntax-number' : 'text-syntax-key'
            )}>
              {typeof keyName === 'number' ? `[${keyName}]` : `"${keyName}"`}
            </span>
            <span className="text-text-muted">:</span>
          </>
        )}
        
        {/* Value */}
        <span className={cn('truncate', isPrimitive && !isEditing && 'cursor-text')}>
          {renderValue()}
        </span>
        
        {/* Edit hint for primitive values */}
        {isPrimitive && !isEditing && (
          <span className="opacity-0 group-hover:opacity-100 text-text-tertiary text-xs ml-2 transition-opacity">
            double-click to edit
          </span>
        )}
      </div>
      
      {/* Children */}
      {renderChildren()}
    </div>
  );
}

/**
 * Helper to set value at a JSON path
 */
function setValueAtPath(obj: JsonValue, path: string, newValue: JsonValue): JsonValue {
  if (path === '$') return newValue;
  
  const parts = path
    .replace(/^\$\.?/, '')
    .split(/\.|\[|\]/)
    .filter(Boolean);
  
  // Deep clone the object
  const result = JSON.parse(JSON.stringify(obj)) as JsonValue;
  let current: JsonValue = result;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (current === null || typeof current !== 'object') break;
    if (Array.isArray(current)) {
      const next = current[parseInt(part, 10)];
      if (next !== undefined) current = next;
    } else {
      const next = (current as JsonObject)[part];
      if (next !== undefined) current = next;
    }
  }
  
  const lastPart = parts[parts.length - 1]!;
  if (current !== null && typeof current === 'object') {
    if (Array.isArray(current)) {
      current[parseInt(lastPart, 10)] = newValue;
    } else {
      (current as JsonObject)[lastPart] = newValue;
    }
  }
  
  return result;
}

/**
 * Helper to delete value at a JSON path
 */
function deleteAtPath(obj: JsonValue, path: string): JsonValue {
  if (path === '$') return null;
  
  const parts = path
    .replace(/^\$\.?/, '')
    .split(/\.|\[|\]/)
    .filter(Boolean);
  
  // Deep clone the object
  const result = JSON.parse(JSON.stringify(obj)) as JsonValue;
  let current: JsonValue = result;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (current === null || typeof current !== 'object') break;
    if (Array.isArray(current)) {
      const next = current[parseInt(part, 10)];
      if (next !== undefined) current = next;
    } else {
      const next = (current as JsonObject)[part];
      if (next !== undefined) current = next;
    }
  }
  
  const lastPart = parts[parts.length - 1]!;
  if (current !== null && typeof current === 'object') {
    if (Array.isArray(current)) {
      current.splice(parseInt(lastPart, 10), 1);
    } else {
      delete (current as JsonObject)[lastPart];
    }
  }
  
  return result;
}

/**
 * Helper to get value at a JSON path
 */
function getValueAtPath(obj: JsonValue, path: string): JsonValue | undefined {
  if (path === '$') return obj;
  
  const parts = path
    .replace(/^\$\.?/, '')
    .split(/\.|\[|\]/)
    .filter(Boolean);
  
  let current: JsonValue | undefined = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    if (Array.isArray(current)) {
      current = current[parseInt(part, 10)];
    } else {
      current = (current as JsonObject)[part];
    }
    if (current === undefined) return undefined;
  }
  
  return current;
}

/**
 * Helper to add a new item to an array or object at a path
 */
function addItemAtPath(obj: JsonValue, path: string, key: string | null, value: JsonValue): JsonValue {
  const result = JSON.parse(JSON.stringify(obj)) as JsonValue;
  const parent = getValueAtPath(result, path);
  
  if (parent === null || typeof parent !== 'object') return result;
  
  if (Array.isArray(parent)) {
    parent.push(value);
  } else if (key) {
    (parent as JsonObject)[key] = value;
  }
  
  return result;
}

/**
 * Helper to get the parent path
 */
function getParentPath(path: string): string {
  if (path === '$') return '$';
  
  // Handle array index like $[0] or $.foo[0]
  const lastBracket = path.lastIndexOf('[');
  const lastDot = path.lastIndexOf('.');
  
  if (lastBracket > lastDot) {
    const parentPath = path.substring(0, lastBracket);
    return parentPath || '$';
  } else if (lastDot > 0) {
    return path.substring(0, lastDot);
  }
  
  return '$';
}

/**
 * Collect all visible paths in order for keyboard navigation (with pagination support)
 */
function collectVisiblePathsPaginated(
  value: JsonValue, 
  path: string, 
  expandedPaths: Set<string>,
  arrayPageMap: Map<string, number>
): string[] {
  const paths: string[] = [path];
  
  if (value !== null && typeof value === 'object' && expandedPaths.has(path)) {
    if (Array.isArray(value)) {
      // Apply pagination for large arrays
      const isLargeArray = value.length > ARRAY_PAGE_SIZE;
      const currentPage = arrayPageMap.get(path) ?? 0;
      const startIndex = isLargeArray ? currentPage * ARRAY_PAGE_SIZE : 0;
      const endIndex = isLargeArray ? Math.min(startIndex + ARRAY_PAGE_SIZE, value.length) : value.length;
      
      for (let i = startIndex; i < endIndex; i++) {
        paths.push(...collectVisiblePathsPaginated(value[i]!, `${path}[${i}]`, expandedPaths, arrayPageMap));
      }
    } else {
      Object.entries(value).forEach(([key, val]) => {
        paths.push(...collectVisiblePathsPaginated(val, path ? `${path}.${key}` : key, expandedPaths, arrayPageMap));
      });
    }
  }
  
  return paths;
}

/**
 * Breadcrumb component - inline version with copy
 */
function Breadcrumbs({ 
  path, 
  onNavigate 
}: { 
  path: string; 
  onNavigate: (path: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  
  const parts = useMemo(() => {
    if (path === '$') return [{ label: 'root', path: '$' }];
    
    const segments: { label: string; path: string }[] = [{ label: 'root', path: '$' }];
    let currentPath = '$';
    
    // Parse the path to extract segments
    const pathWithoutRoot = path.replace(/^\$\.?/, '');
    const tokens = pathWithoutRoot.match(/[^.[\]]+|\[\d+\]/g) || [];
    
    for (const token of tokens) {
      if (token.startsWith('[')) {
        currentPath += token;
        segments.push({ label: token, path: currentPath });
      } else {
        currentPath += (currentPath === '$' ? '' : '.') + token;
        segments.push({ label: token, path: currentPath });
      }
    }
    
    return segments;
  }, [path]);
  
  const handleCopyPath = useCallback(async () => {
    await navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [path]);
  
  return (
    <div className="flex items-center gap-1 text-xs overflow-x-auto">
      <span className="text-text-muted flex-shrink-0">Path:</span>
      {parts.map((part, index) => (
        <span key={part.path} className="flex items-center gap-0.5">
          {index > 0 && (
            <CaretRight className="w-3 h-3 text-text-muted flex-shrink-0" />
          )}
          <button
            onClick={() => onNavigate(part.path)}
            className={cn(
              'px-1 py-0.5 rounded hover:bg-bg-hover transition-colors whitespace-nowrap',
              index === parts.length - 1 
                ? 'text-accent font-medium' 
                : 'text-text-secondary'
            )}
          >
            {part.label}
          </button>
        </span>
      ))}
      <button
        onClick={handleCopyPath}
        className={cn(
          'ml-1 p-1 rounded transition-colors flex-shrink-0',
          copied 
            ? 'text-success bg-success/10' 
            : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
        )}
        title={copied ? 'Copied!' : 'Copy path'}
      >
        {copied ? (
          <Check className="w-3 h-3" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}

export function TreeEditor() {
  const doc = useCurrentDocument();
  const updateContent = useUpdateCurrentContent();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['$']));
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>('$');
  const [arrayPageMap, setArrayPageMap] = useState<Map<string, number>>(() => new Map());
  const { isOpen, x, y, items, openMenu, closeMenu } = useContextMenu();
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  const content = doc?.content ?? '{}';
  
  // Parse the JSON content
  const { value: parsedValue, error: parseError } = useMemo(
    () => parseJson(content),
    [content]
  );
  
  // Collect visible paths for navigation (with pagination support)
  const visiblePaths = useMemo(() => {
    if (!parsedValue) return ['$'];
    return collectVisiblePathsPaginated(parsedValue, '$', expandedPaths, arrayPageMap);
  }, [parsedValue, expandedPaths, arrayPageMap]);
  
  const handleArrayPageChange = useCallback((path: string, page: number) => {
    setArrayPageMap(prev => {
      const next = new Map(prev);
      next.set(path, page);
      return next;
    });
  }, []);
  
  const handleToggle = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);
  
  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path);
    // Ensure expanded to show selected node
    setExpandedPaths(prev => {
      const next = new Set(prev);
      let currentPath = '$';
      const parts = path.replace(/^\$\.?/, '').split(/\.|\[|\]/).filter(Boolean);
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        if (part.match(/^\d+$/)) {
          currentPath += `[${part}]`;
        } else {
          currentPath += (currentPath === '$' ? '' : '.') + part;
        }
        next.add(currentPath);
      }
      return next;
    });
  }, []);
  
  const handleStartEdit = useCallback((path: string) => {
    setEditingPath(path);
  }, []);
  
  const handleSaveEdit = useCallback((path: string, newValue: JsonValue) => {
    if (!parsedValue) return;
    const updatedValue = setValueAtPath(parsedValue, path, newValue);
    updateContent(JSON.stringify(updatedValue, null, 2));
    setEditingPath(null);
  }, [parsedValue, updateContent]);
  
  const handleCancelEdit = useCallback(() => {
    setEditingPath(null);
  }, []);
  
  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't handle keyboard when editing
    if (editingPath) return;
    
    const currentIndex = selectedPath ? visiblePaths.indexOf(selectedPath) : 0;
    
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (currentIndex < visiblePaths.length - 1) {
          const nextPath = visiblePaths[currentIndex + 1]!;
          setSelectedPath(nextPath);
          nodeRefs.current.get(nextPath)?.scrollIntoView({ block: 'nearest' });
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (currentIndex > 0) {
          const prevPath = visiblePaths[currentIndex - 1]!;
          setSelectedPath(prevPath);
          nodeRefs.current.get(prevPath)?.scrollIntoView({ block: 'nearest' });
        }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (selectedPath && parsedValue) {
          const value = getValueAtPath(parsedValue, selectedPath);
          if (value !== null && typeof value === 'object') {
            if (!expandedPaths.has(selectedPath)) {
              handleToggle(selectedPath);
            } else {
              // Move to first child
              const nextIndex = currentIndex + 1;
              if (nextIndex < visiblePaths.length) {
                const nextPath = visiblePaths[nextIndex]!;
                if (nextPath.startsWith(selectedPath)) {
                  setSelectedPath(nextPath);
                  nodeRefs.current.get(nextPath)?.scrollIntoView({ block: 'nearest' });
                }
              }
            }
          }
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (selectedPath && parsedValue) {
          if (expandedPaths.has(selectedPath)) {
            handleToggle(selectedPath);
          } else {
            // Move to parent
            const parentPath = getParentPath(selectedPath);
            if (parentPath !== selectedPath) {
              setSelectedPath(parentPath);
              nodeRefs.current.get(parentPath)?.scrollIntoView({ block: 'nearest' });
            }
          }
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (selectedPath && parsedValue) {
          const value = getValueAtPath(parsedValue, selectedPath);
          if (value === null || typeof value !== 'object') {
            // Edit primitive
            handleStartEdit(selectedPath);
          } else {
            // Toggle expand
            handleToggle(selectedPath);
          }
        }
        break;
      }
      case 'Home': {
        e.preventDefault();
        setSelectedPath('$');
        nodeRefs.current.get('$')?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastPath = visiblePaths[visiblePaths.length - 1]!;
        setSelectedPath(lastPath);
        nodeRefs.current.get(lastPath)?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'Delete':
      case 'Backspace': {
        if (selectedPath && selectedPath !== '$' && parsedValue) {
          e.preventDefault();
          const newValue = deleteAtPath(parsedValue, selectedPath);
          updateContent(JSON.stringify(newValue, null, 2));
          // Select parent after delete
          setSelectedPath(getParentPath(selectedPath));
        }
        break;
      }
      case 'c': {
        if ((e.metaKey || e.ctrlKey) && selectedPath && parsedValue) {
          const value = getValueAtPath(parsedValue, selectedPath);
          navigator.clipboard.writeText(JSON.stringify(value, null, 2));
        }
        break;
      }
    }
  }, [selectedPath, visiblePaths, expandedPaths, editingPath, parsedValue, handleToggle, handleStartEdit, updateContent]);
  
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    path: string,
    value: JsonValue,
    // keyName parameter kept for API compatibility but not used in this handler
  ) => {
    const isRoot = path === '$';
    const isPrimitive = value === null || typeof value !== 'object';
    const isArray = Array.isArray(value);
    const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
    
    // Get parent to determine if we can duplicate
    const parentPath = getParentPath(path);
    const parentValue = parsedValue ? getValueAtPath(parsedValue, parentPath) : null;
    const canDuplicate = !isRoot && parentValue !== null && typeof parentValue === 'object';
    
    const menuItems: ContextMenuItem[] = [
      {
        id: 'copy-value',
        label: 'Copy Value',
        icon: <Copy size={14} />,
        shortcut: 'Ctrl+C',
        onClick: async () => {
          const valueToCopy = JSON.stringify(value, null, 2);
          await navigator.clipboard.writeText(valueToCopy);
        },
      },
      {
        id: 'copy-path',
        label: 'Copy Path',
        icon: <ClipboardText size={14} />,
        onClick: async () => {
          await navigator.clipboard.writeText(path);
        },
      },
      { id: 'sep1', label: '', separator: true },
    ];
    
    // Add item options for arrays and objects
    if (isArray || isObject) {
      menuItems.push({
        id: 'add-item',
        label: isArray ? 'Add Item' : 'Add Property',
        icon: <Plus size={14} />,
        onClick: () => {
          if (!parsedValue) return;
          if (isArray) {
            const newValue = addItemAtPath(parsedValue, path, null, null);
            updateContent(JSON.stringify(newValue, null, 2));
            // Expand to show new item
            setExpandedPaths(prev => new Set([...prev, path]));
          } else {
            // For objects, need to prompt for key name - use a simple approach
            const key = prompt('Enter property name:');
            if (key) {
              const newValue = addItemAtPath(parsedValue, path, key, null);
              updateContent(JSON.stringify(newValue, null, 2));
              setExpandedPaths(prev => new Set([...prev, path]));
            }
          }
        },
      });
      
      menuItems.push({ id: 'sep-add', label: '', separator: true });
    }
    
    menuItems.push({
      id: 'edit',
      label: 'Edit Value',
      icon: <PencilSimple size={14} />,
      shortcut: 'Enter',
      disabled: !isPrimitive,
      onClick: () => {
        handleStartEdit(path);
      },
    });
    
    if (canDuplicate) {
      menuItems.push({
        id: 'duplicate',
        label: 'Duplicate',
        icon: <CopySimple size={14} />,
        onClick: () => {
          if (!parsedValue) return;
          const valueToDuplicate = getValueAtPath(parsedValue, path);
          
          if (Array.isArray(parentValue)) {
            // For arrays, add after current item
            const newValue = addItemAtPath(parsedValue, parentPath, null, JSON.parse(JSON.stringify(valueToDuplicate)));
            updateContent(JSON.stringify(newValue, null, 2));
          } else if (typeof parentValue === 'object' && parentValue !== null) {
            // For objects, need new key
            const originalKey = path.split('.').pop() || 'copy';
            const newKey = `${originalKey}_copy`;
            const newValue = addItemAtPath(parsedValue, parentPath, newKey, JSON.parse(JSON.stringify(valueToDuplicate)));
            updateContent(JSON.stringify(newValue, null, 2));
          }
        },
      });
    }
    
    menuItems.push(
      { id: 'sep2', label: '', separator: true },
      {
        id: 'delete',
        label: isRoot ? 'Clear Document' : 'Delete',
        icon: <Trash size={14} />,
        shortcut: 'Del',
        danger: true,
        onClick: () => {
          if (!parsedValue) return;
          const newValue = isRoot ? {} : deleteAtPath(parsedValue, path);
          updateContent(JSON.stringify(newValue, null, 2));
          if (!isRoot) {
            setSelectedPath(parentPath);
          }
        },
      }
    );
    
    openMenu(e, menuItems);
  }, [parsedValue, updateContent, openMenu, handleStartEdit]);
  
  const handleExpandAll = useCallback(() => {
    if (!parsedValue) return;
    
    const paths = new Set<string>();
    
    function collectPaths(value: JsonValue, path: string) {
      paths.add(path);
      if (value !== null && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            collectPaths(item, `${path}[${index}]`);
          });
        } else {
          Object.entries(value).forEach(([key, val]) => {
            collectPaths(val, path ? `${path}.${key}` : key);
          });
        }
      }
    }
    
    collectPaths(parsedValue, '$');
    setExpandedPaths(paths);
  }, [parsedValue]);
  
  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set(['$']));
  }, []);
  
  const handleBreadcrumbNavigate = useCallback((path: string) => {
    setSelectedPath(path);
    // Ensure path is visible
    setExpandedPaths(prev => {
      const next = new Set(prev);
      let currentPath = '$';
      const parts = path.replace(/^\$\.?/, '').split(/\.|\[|\]/).filter(Boolean);
      for (const part of parts) {
        if (part.match(/^\d+$/)) {
          currentPath += `[${part}]`;
        } else {
          currentPath += (currentPath === '$' ? '' : '.') + part;
        }
        next.add(currentPath);
      }
      return next;
    });
    nodeRefs.current.get(path)?.scrollIntoView({ block: 'center' });
  }, []);
  
  if (parseError) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="text-error text-lg font-medium mb-2">Invalid JSON</div>
        <div className="text-text-secondary text-sm mb-1">
          Line {parseError.line}, Column {parseError.column}
        </div>
        <div className="text-text-tertiary text-sm max-w-md">
          {parseError.message}
        </div>
      </div>
    );
  }
  
  if (parsedValue === null && !parseError) {
    return (
      <div className="h-full flex items-center justify-center text-text-tertiary">
        Empty document
      </div>
    );
  }
  
  return (
    <>
      <div 
        ref={containerRef}
        className="h-full flex flex-col bg-editor-bg focus:outline-none" 
        tabIndex={-1}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle">
          <button
            onClick={handleExpandAll}
            className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 hover:bg-bg-hover rounded transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 hover:bg-bg-hover rounded transition-colors"
          >
            Collapse All
          </button>
          
          {/* Separator */}
          <div className="w-px h-4 bg-border-subtle mx-1" />
          
          {/* Breadcrumbs inline */}
          {selectedPath && (
            <Breadcrumbs path={selectedPath} onNavigate={handleBreadcrumbNavigate} />
          )}
          
          <div className="flex-1" />
          <span className="text-xs text-text-muted">
            {visiblePaths.length} nodes
          </span>
        </div>
        
        {/* Tree Content */}
        <div 
          className="flex-1 overflow-auto py-2"
          style={{ 
            fontFamily: 'var(--editor-font-family)', 
            fontSize: 'var(--editor-font-size)' 
          }}
        >
          <TreeNode
            keyName={null}
            value={parsedValue as JsonValue}
            path="$"
            depth={0}
            expandedPaths={expandedPaths}
            editingPath={editingPath}
            selectedPath={selectedPath}
            arrayPageMap={arrayPageMap}
            onToggle={handleToggle}
            onSelect={handleSelect}
            onContextMenu={handleContextMenu}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onArrayPageChange={handleArrayPageChange}
            onKeyDown={handleKeyDown}
            nodeRefs={nodeRefs}
          />
        </div>
        
        {/* Keyboard shortcuts hint */}
        <div className="px-3 py-1 border-t border-border-subtle text-xs text-text-muted flex items-center gap-4">
          <span><kbd className="px-1 py-0.5 bg-bg-surface rounded text-[10px]">Arrow</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 bg-bg-surface rounded text-[10px]">Enter</kbd> Edit/Toggle</span>
          <span><kbd className="px-1 py-0.5 bg-bg-surface rounded text-[10px]">Del</kbd> Delete</span>
          <span><kbd className="px-1 py-0.5 bg-bg-surface rounded text-[10px]">Right-click</kbd> More options</span>
        </div>
      </div>
      
      {/* Context Menu */}
      {isOpen && (
        <ContextMenu items={items} x={x} y={y} onClose={closeMenu} />
      )}
    </>
  );
}
