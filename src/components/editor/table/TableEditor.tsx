import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { 
  CaretUp, 
  CaretDown, 
  Plus, 
  Trash, 
  CopySimple,
  DotsThreeVertical,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { parseJson, formatJson } from '@/lib/json';
import { useActiveDocument, useUpdateActiveContent } from '@/store/documentStore';
import { InlineEditor, ContextMenu, useContextMenu, type ContextMenuItem } from '@/components/ui';
import type { JsonValue, JsonObject } from '@/types';

// Row height in pixels
const ROW_HEIGHT = 34;
// Number of extra rows to render above/below viewport for smooth scrolling
const OVERSCAN_ROWS = 5;

interface EditingCell {
  rowIndex: number;
  column: string;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

interface ColumnWidths {
  [key: string]: number;
}

export function TableEditor() {
  const doc = useActiveDocument();
  const content = doc?.content ?? '[]';
  const updateContent = useUpdateActiveContent();
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const { isOpen, x, y, items, openMenu, closeMenu } = useContextMenu();
  
  // Parse the JSON content
  const { value: parsedValue, error: parseError } = useMemo(
    () => parseJson(content),
    [content]
  );
  
  // Check if we can render as a table (array of objects)
  const tableData = useMemo(() => {
    if (!parsedValue || !Array.isArray(parsedValue)) {
      return null;
    }
    
    // Get all unique keys from all objects
    const allKeys = new Set<string>();
    const rows: JsonObject[] = [];
    
    for (const item of parsedValue) {
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        rows.push(item as JsonObject);
        Object.keys(item).forEach(key => allKeys.add(key));
      } else {
        // Not all items are objects, can't render as table
        return null;
      }
    }
    
    if (rows.length === 0) {
      return null;
    }
    
    return {
      columns: Array.from(allKeys),
      rows,
    };
  }, [parsedValue]);
  
  // Sort rows if sorting is enabled
  const sortedRows = useMemo(() => {
    if (!tableData) return null;
    if (!sortConfig) return tableData.rows;
    
    const { column, direction } = sortConfig;
    return [...tableData.rows].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      
      // Handle null/undefined
      if (aVal === undefined || aVal === null) return direction === 'asc' ? -1 : 1;
      if (bVal === undefined || bVal === null) return direction === 'asc' ? 1 : -1;
      
      // Compare values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal);
      const bStr = String(bVal);
      return direction === 'asc' 
        ? aStr.localeCompare(bStr) 
        : bStr.localeCompare(aStr);
    });
  }, [tableData, sortConfig]);
  
  // Map sorted index back to original index
  const getOriginalIndex = useCallback((sortedIndex: number): number => {
    if (!sortConfig || !tableData || !sortedRows) return sortedIndex;
    
    const sortedRow = sortedRows[sortedIndex];
    if (!sortedRow) return sortedIndex;
    
    return tableData.rows.findIndex(row => row === sortedRow);
  }, [sortConfig, tableData, sortedRows]);
  
  // Calculate virtualization: which rows to render based on scroll position
  // Only virtualize for large tables (>100 rows) to avoid complexity for small tables
  const { renderedRowIndices, startOffset, totalHeight, isVirtualized } = useMemo(() => {
    const rows = sortedRows || [];
    const total = rows.length;
    const totalHeight = total * ROW_HEIGHT;
    
    // Don't virtualize small tables or when container height is not yet known
    const shouldVirtualize = total > 100 && containerHeight > 0;
    
    if (!shouldVirtualize) {
      // Return all row indices for non-virtualized rendering
      const allIndices: number[] = [];
      for (let i = 0; i < total; i++) {
        allIndices.push(i);
      }
      return { 
        renderedRowIndices: allIndices, 
        startOffset: 0, 
        totalHeight,
        isVirtualized: false
      };
    }
    
    // Calculate visible range
    const startRow = Math.floor(scrollTop / ROW_HEIGHT);
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT);
    
    // Add overscan for smooth scrolling
    const renderStart = Math.max(0, startRow - OVERSCAN_ROWS);
    const renderEnd = Math.min(total, startRow + visibleCount + OVERSCAN_ROWS);
    
    // Generate array of indices to render
    const renderedRowIndices: number[] = [];
    for (let i = renderStart; i < renderEnd; i++) {
      renderedRowIndices.push(i);
    }
    
    const startOffset = renderStart * ROW_HEIGHT;
    
    return { renderedRowIndices, startOffset, totalHeight, isVirtualized: true };
  }, [sortedRows, scrollTop, containerHeight]);
  
  // Track scroll position
  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
  }, []);
  
  // Track container height
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    
    observer.observe(container);
    setContainerHeight(container.clientHeight);
    
    return () => observer.disconnect();
  }, []);
  
  // Update cell value and propagate to document
  const handleCellEdit = useCallback((sortedRowIndex: number, column: string, newValue: JsonValue) => {
    if (!parsedValue || !Array.isArray(parsedValue)) return;
    
    const originalIndex = getOriginalIndex(sortedRowIndex);
    
    // Deep clone and update
    const newArray = parsedValue.map((item, idx) => {
      if (idx === originalIndex && item !== null && typeof item === 'object' && !Array.isArray(item)) {
        return { ...item, [column]: newValue };
      }
      return item;
    });
    
    const formatted = formatJson(JSON.stringify(newArray), { indent: 2 });
    updateContent(formatted);
    setEditingCell(null);
  }, [parsedValue, updateContent, getOriginalIndex]);
  
  // Add new row
  const handleAddRow = useCallback((afterIndex?: number) => {
    if (!parsedValue || !Array.isArray(parsedValue) || !tableData) return;
    
    // Create new row with all columns set to null
    const newRow: JsonObject = {};
    tableData.columns.forEach(col => {
      newRow[col] = null;
    });
    
    const newArray = [...parsedValue];
    if (afterIndex !== undefined) {
      const originalIndex = getOriginalIndex(afterIndex);
      newArray.splice(originalIndex + 1, 0, newRow);
    } else {
      newArray.push(newRow);
    }
    
    const formatted = formatJson(JSON.stringify(newArray), { indent: 2 });
    updateContent(formatted);
  }, [parsedValue, tableData, updateContent, getOriginalIndex]);
  
  // Delete row
  const handleDeleteRow = useCallback((sortedRowIndex: number) => {
    if (!parsedValue || !Array.isArray(parsedValue)) return;
    
    const originalIndex = getOriginalIndex(sortedRowIndex);
    const newArray = parsedValue.filter((_, idx) => idx !== originalIndex);
    
    const formatted = formatJson(JSON.stringify(newArray), { indent: 2 });
    updateContent(formatted);
    setSelectedRow(null);
  }, [parsedValue, updateContent, getOriginalIndex]);
  
  // Duplicate row
  const handleDuplicateRow = useCallback((sortedRowIndex: number) => {
    if (!parsedValue || !Array.isArray(parsedValue)) return;
    
    const originalIndex = getOriginalIndex(sortedRowIndex);
    const rowToDuplicate = parsedValue[originalIndex];
    if (!rowToDuplicate) return;
    
    const newArray = [...parsedValue];
    newArray.splice(originalIndex + 1, 0, JSON.parse(JSON.stringify(rowToDuplicate)));
    
    const formatted = formatJson(JSON.stringify(newArray), { indent: 2 });
    updateContent(formatted);
  }, [parsedValue, updateContent, getOriginalIndex]);
  
  // Handle sorting
  const handleSort = useCallback((column: string) => {
    setSortConfig(prev => {
      if (prev?.column === column) {
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        }
        // Third click clears sort
        return null;
      }
      return { column, direction: 'asc' };
    });
  }, []);
  
  // Check if a cell value is editable (primitive types only)
  const isEditable = (value: JsonValue | undefined): boolean => {
    if (value === undefined) return false;
    if (value === null) return true;
    const type = typeof value;
    return type === 'string' || type === 'number' || type === 'boolean';
  };
  
  // Handle row context menu
  const handleRowContextMenu = useCallback((e: React.MouseEvent, rowIndex: number) => {
    e.preventDefault();
    setSelectedRow(rowIndex);
    
    const menuItems: ContextMenuItem[] = [
      {
        id: 'add-row-above',
        label: 'Insert Row Above',
        icon: <Plus size={14} />,
        onClick: () => handleAddRow(rowIndex - 1),
      },
      {
        id: 'add-row-below',
        label: 'Insert Row Below',
        icon: <Plus size={14} />,
        onClick: () => handleAddRow(rowIndex),
      },
      { id: 'sep1', label: '', separator: true },
      {
        id: 'duplicate-row',
        label: 'Duplicate Row',
        icon: <CopySimple size={14} />,
        onClick: () => handleDuplicateRow(rowIndex),
      },
      { id: 'sep2', label: '', separator: true },
      {
        id: 'delete-row',
        label: 'Delete Row',
        icon: <Trash size={14} />,
        danger: true,
        onClick: () => handleDeleteRow(rowIndex),
      },
    ];
    
    openMenu(e, menuItems);
  }, [handleAddRow, handleDuplicateRow, handleDeleteRow, openMenu]);
  
  // Handle column resize
  const handleResizeStart = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizingColumn(column);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[column] || 150);
  }, [columnWidths]);
  
  // Mouse move during resize
  useEffect(() => {
    if (!resizingColumn) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX;
      const newWidth = Math.max(80, resizeStartWidth + diff);
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth,
      }));
    };
    
    const handleMouseUp = () => {
      setResizingColumn(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);
  
  // Keyboard navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !tableData) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCell) return; // Don't interfere with editing
      
      const cols = tableData.columns;
      const rowCount = sortedRows?.length || 0;
      
      if (!selectedCell) {
        // If no cell selected and we have data, select first cell on any arrow key
        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          setSelectedCell({ row: 0, col: 0 });
          e.preventDefault();
        }
        return;
      }
      
      const { row, col } = selectedCell;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (row < rowCount - 1) {
            setSelectedCell({ row: row + 1, col });
            setSelectedRow(row + 1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (row > 0) {
            setSelectedCell({ row: row - 1, col });
            setSelectedRow(row - 1);
          }
          break;
        case 'ArrowRight':
        case 'Tab':
          e.preventDefault();
          if (col < cols.length - 1) {
            setSelectedCell({ row, col: col + 1 });
          } else if (row < rowCount - 1) {
            // Move to next row
            setSelectedCell({ row: row + 1, col: 0 });
            setSelectedRow(row + 1);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (col > 0) {
            setSelectedCell({ row, col: col - 1 });
          } else if (row > 0) {
            // Move to previous row
            setSelectedCell({ row: row - 1, col: cols.length - 1 });
            setSelectedRow(row - 1);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (sortedRows) {
            const rowData = sortedRows[row];
            const colName = cols[col];
            if (rowData && colName && isEditable(rowData[colName])) {
              setEditingCell({ rowIndex: row, column: colName });
            }
          }
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          handleDeleteRow(row);
          break;
        case 'Home':
          e.preventDefault();
          setSelectedCell({ row: 0, col: 0 });
          setSelectedRow(0);
          break;
        case 'End':
          e.preventDefault();
          setSelectedCell({ row: rowCount - 1, col: cols.length - 1 });
          setSelectedRow(rowCount - 1);
          break;
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, editingCell, tableData, sortedRows, handleDeleteRow]);
  
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
  
  if (!tableData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="text-text-secondary text-lg font-medium mb-2">
          Cannot display as table
        </div>
        <div className="text-text-tertiary text-sm max-w-md">
          Table view requires an array of objects. The current document is not in that format.
        </div>
      </div>
    );
  }
  
  const { columns } = tableData;
  const rows = sortedRows || [];
  
  return (
    <>
      <div 
        ref={containerRef}
        className="h-full flex flex-col bg-editor-bg focus:outline-none" 
        tabIndex={-1}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-4 px-3 py-1.5 border-b border-border-subtle text-xs">
          <span className="text-text-tertiary">{rows.length} rows</span>
          <span className="text-text-tertiary">{columns.length} columns</span>
          <div className="flex-1" />
          <button
            onClick={() => handleAddRow()}
            className="flex items-center gap-1 px-2 py-1 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
          {sortConfig && (
            <button
              onClick={() => setSortConfig(null)}
              className="text-text-secondary hover:text-text-primary px-2 py-1 hover:bg-bg-hover rounded transition-colors"
            >
              Clear Sort
            </button>
          )}
        </div>
        
        {/* Table Container - with virtualization */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto"
          onScroll={handleTableScroll}
        >
          <table ref={tableRef} className="border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 48 }} /> {/* Row number */}
              <col style={{ width: 32 }} /> {/* Row actions */}
              {columns.map(col => (
                <col key={col} style={{ width: columnWidths[col] || 150 }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-bg-surface">
                {/* Row number column */}
                <th className="px-3 py-2 text-left font-medium text-text-tertiary border-b border-r border-border-default sticky left-0 bg-bg-surface z-20">
                  #
                </th>
                {/* Row actions column */}
                <th className="px-1 py-2 text-center font-medium text-text-tertiary border-b border-r border-border-default sticky left-12 bg-bg-surface z-20">
                  <DotsThreeVertical className="w-4 h-4 mx-auto" />
                </th>
                {columns.map(col => (
                  <th
                    key={col}
                    className="relative px-3 py-2 text-left font-medium border-b border-r border-border-default group"
                  >
                    <button
                      onClick={() => handleSort(col)}
                      className="flex items-center gap-1 w-full text-left text-syntax-key hover:text-accent transition-colors"
                    >
                      <span className="truncate">{col}</span>
                      {sortConfig?.column === col && (
                        sortConfig.direction === 'asc' 
                          ? <CaretUp className="w-3 h-3 flex-shrink-0" />
                          : <CaretDown className="w-3 h-3 flex-shrink-0" />
                      )}
                    </button>
                    
                    {/* Resize handle */}
                    <div
                      className={cn(
                        'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent',
                        resizingColumn === col && 'bg-accent'
                      )}
                      onMouseDown={(e) => handleResizeStart(e, col)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Spacer for virtualization - maintains scroll position */}
              {isVirtualized && startOffset > 0 && (
                <tr style={{ height: startOffset }}>
                  <td colSpan={columns.length + 2} />
                </tr>
              )}
              {renderedRowIndices.map((rowIndex) => {
                const row = rows[rowIndex];
                if (!row) return null;
                return (
                  <tr
                    key={rowIndex}
                    className={cn(
                      'transition-colors',
                      selectedRow === rowIndex 
                        ? 'bg-accent/10' 
                        : rowIndex % 2 === 1 
                          ? 'bg-bg-surface/50 hover:bg-bg-hover' 
                          : 'hover:bg-bg-hover'
                    )}
                    style={isVirtualized ? { height: ROW_HEIGHT } : undefined}
                    onClick={() => setSelectedRow(rowIndex)}
                  >
                    {/* Row number */}
                    <td className="px-3 py-1.5 text-text-muted border-r border-border-subtle font-mono sticky left-0 bg-inherit">
                      {rowIndex + 1}
                    </td>
                    
                    {/* Row actions */}
                    <td className="px-1 py-1.5 text-center border-r border-border-subtle sticky left-12 bg-inherit">
                      <button
                        onClick={(e) => handleRowContextMenu(e, rowIndex)}
                        className="p-0.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                      >
                        <DotsThreeVertical className="w-4 h-4" />
                      </button>
                    </td>
                    
                    {columns.map((col, colIndex) => {
                      const cellValue = row[col];
                      const isEditingThisCell = editingCell?.rowIndex === rowIndex && editingCell?.column === col;
                      const canEdit = isEditable(cellValue);
                      const isSelectedCell = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                    
                    return (
                      <td
                        key={col}
                        className={cn(
                          'px-3 py-1.5 border-r border-border-subtle font-mono overflow-hidden',
                          canEdit && 'cursor-pointer',
                          isSelectedCell && 'ring-2 ring-inset ring-accent/50 bg-accent/5'
                        )}
                        onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                        onDoubleClick={() => {
                          if (canEdit) {
                            setEditingCell({ rowIndex, column: col });
                          }
                        }}
                        onContextMenu={(e) => handleRowContextMenu(e, rowIndex)}
                      >
                        {isEditingThisCell ? (
                          <InlineEditor
                            value={cellValue as JsonValue}
                            onSave={(newValue) => handleCellEdit(rowIndex, col, newValue)}
                            onCancel={() => setEditingCell(null)}
                            fitContainer
                          />
                        ) : (
                          <CellValue value={cellValue} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
              {/* Bottom spacer for virtualization */}
              {totalHeight - startOffset - (renderedRowIndices.length * ROW_HEIGHT) > 0 && (
                <tr style={{ height: totalHeight - startOffset - (renderedRowIndices.length * ROW_HEIGHT) }}>
                  <td colSpan={columns.length + 2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Keyboard shortcuts hint */}
        <div className="px-3 py-1 border-t border-border-subtle text-xs text-text-muted flex items-center gap-4">
          <span><kbd className="px-1 py-0.5 bg-bg-surface rounded text-[10px]">Arrow</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 bg-bg-surface rounded text-[10px]">Enter</kbd> Edit</span>
          <span><kbd className="px-1 py-0.5 bg-bg-surface rounded text-[10px]">Del</kbd> Delete Row</span>
          <span><kbd className="px-1 py-0.5 bg-bg-surface rounded text-[10px]">Click header</kbd> Sort</span>
        </div>
      </div>
      
      {/* Context Menu */}
      {isOpen && (
        <ContextMenu items={items} x={x} y={y} onClose={closeMenu} />
      )}
    </>
  );
}

function CellValue({ value }: { value: JsonValue | undefined }) {
  if (value === undefined) {
    return <span className="text-text-muted italic">—</span>;
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
    const displayValue = value.length > 50 ? value.slice(0, 50) + '...' : value;
    return <span className="text-syntax-string">{displayValue}</span>;
  }
  
  if (Array.isArray(value)) {
    return (
      <span className="text-text-tertiary">
        [{value.length} items]
      </span>
    );
  }
  
  if (typeof value === 'object') {
    return (
      <span className="text-text-tertiary">
        {'{...}'}
      </span>
    );
  }
  
  return <span>{String(value)}</span>;
}
