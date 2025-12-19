import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
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
import { useCurrentDocument, useUpdateCurrentContent } from '@/store/useDocumentStore';
import { InlineEditor, ContextMenu, useContextMenu, type ContextMenuItem } from '@/components/ui';
import type { JsonValue, JsonObject } from '@/types';

// Row height for virtualization
const ROW_HEIGHT = 36;

interface EditingCell {
  rowIndex: number;
  columnId: string;
}

export function TableEditor() {
  const doc = useCurrentDocument();
  const content = doc?.content ?? '[]';
  const updateContent = useUpdateCurrentContent();
  
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const { isOpen, x, y, items, openMenu, closeMenu } = useContextMenu();
  
  // Parse the JSON content
  const { value: parsedValue, error: parseError } = useMemo(
    () => parseJson(content),
    [content]
  );
  
  // Extract table data: columns and rows
  const { columns: dataColumns, rows: dataRows } = useMemo(() => {
    if (!parsedValue || !Array.isArray(parsedValue)) {
      return { columns: [], rows: [] };
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
        return { columns: [], rows: [] };
      }
    }
    
    return {
      columns: Array.from(allKeys),
      rows,
    };
  }, [parsedValue]);
  
  // Check if a cell value is editable (primitive types only)
  const isEditable = useCallback((value: JsonValue | undefined): boolean => {
    if (value === undefined) return false;
    if (value === null) return true;
    const type = typeof value;
    return type === 'string' || type === 'number' || type === 'boolean';
  }, []);
  
  // Update cell value
  const handleCellEdit = useCallback((rowIndex: number, columnId: string, newValue: JsonValue) => {
    if (!parsedValue || !Array.isArray(parsedValue)) return;
    
    const newArray = parsedValue.map((item, idx) => {
      if (idx === rowIndex && item !== null && typeof item === 'object' && !Array.isArray(item)) {
        return { ...item, [columnId]: newValue };
      }
      return item;
    });
    
    const formatted = formatJson(JSON.stringify(newArray), { indent: 2 });
    updateContent(formatted);
    setEditingCell(null);
  }, [parsedValue, updateContent]);
  
  // Add new row
  const handleAddRow = useCallback((afterIndex?: number) => {
    if (!parsedValue || !Array.isArray(parsedValue)) return;
    
    // Create new row with all columns set to null
    const newRow: JsonObject = {};
    dataColumns.forEach(col => {
      newRow[col] = null;
    });
    
    const newArray = [...parsedValue];
    if (afterIndex !== undefined && afterIndex >= 0) {
      newArray.splice(afterIndex + 1, 0, newRow);
    } else {
      newArray.push(newRow);
    }
    
    const formatted = formatJson(JSON.stringify(newArray), { indent: 2 });
    updateContent(formatted);
  }, [parsedValue, dataColumns, updateContent]);
  
  // Delete row
  const handleDeleteRow = useCallback((rowIndex: number) => {
    if (!parsedValue || !Array.isArray(parsedValue)) return;
    
    const newArray = parsedValue.filter((_, idx) => idx !== rowIndex);
    
    const formatted = formatJson(JSON.stringify(newArray), { indent: 2 });
    updateContent(formatted);
    setSelectedRowIndex(null);
  }, [parsedValue, updateContent]);
  
  // Duplicate row
  const handleDuplicateRow = useCallback((rowIndex: number) => {
    if (!parsedValue || !Array.isArray(parsedValue)) return;
    
    const rowToDuplicate = parsedValue[rowIndex];
    if (!rowToDuplicate) return;
    
    const newArray = [...parsedValue];
    newArray.splice(rowIndex + 1, 0, JSON.parse(JSON.stringify(rowToDuplicate)));
    
    const formatted = formatJson(JSON.stringify(newArray), { indent: 2 });
    updateContent(formatted);
  }, [parsedValue, updateContent]);
  
  // Context menu for rows
  const handleRowContextMenu = useCallback((e: React.MouseEvent, rowIndex: number) => {
    e.preventDefault();
    setSelectedRowIndex(rowIndex);
    
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
  
  // Column resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnId);
    setResizeStartX(e.clientX);
    setResizeStartWidth(currentWidth);
  }, []);
  
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
  
  // Create column helper
  const columnHelper = createColumnHelper<JsonObject>();
  
  // Build columns for TanStack Table
  const columns = useMemo<ColumnDef<JsonObject, JsonValue>[]>(() => {
    // Row number column
    const rowNumColumn = columnHelper.display({
      id: '__rowNum',
      header: '#',
      size: 50,
      minSize: 50,
      maxSize: 50,
      cell: ({ row }) => (
        <span className="text-text-muted font-mono text-xs">
          {row.index + 1}
        </span>
      ),
    });
    
    // Row actions column
    const actionsColumn = columnHelper.display({
      id: '__actions',
      header: () => <DotsThreeVertical className="w-4 h-4 mx-auto text-text-tertiary" />,
      size: 36,
      minSize: 36,
      maxSize: 36,
      cell: ({ row }) => (
        <button
          onClick={(e) => handleRowContextMenu(e, row.index)}
          className="p-0.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
        >
          <DotsThreeVertical className="w-4 h-4" />
        </button>
      ),
    });
    
    // Data columns
    const dataColumnDefs = dataColumns.map(colKey =>
      columnHelper.accessor((row) => row[colKey], {
        id: colKey,
        header: ({ column }) => (
          <div className="flex items-center gap-1 w-full">
            <span className="truncate text-syntax-key">{colKey}</span>
            {column.getIsSorted() === 'asc' && <CaretUp className="w-3 h-3 flex-shrink-0" />}
            {column.getIsSorted() === 'desc' && <CaretDown className="w-3 h-3 flex-shrink-0" />}
          </div>
        ),
        size: columnWidths[colKey] || 150,
        minSize: 80,
        cell: ({ getValue, row, column }) => {
          const value = getValue();
          const isEditingThis = editingCell?.rowIndex === row.index && editingCell?.columnId === column.id;
          
          if (isEditingThis) {
            return (
              <InlineEditor
                value={value as JsonValue}
                onSave={(newValue) => handleCellEdit(row.index, column.id, newValue)}
                onCancel={() => setEditingCell(null)}
                fitContainer
              />
            );
          }
          
          return <CellValue value={value} />;
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId);
          const b = rowB.getValue(columnId);
          
          if (a === null || a === undefined) return -1;
          if (b === null || b === undefined) return 1;
          
          if (typeof a === 'number' && typeof b === 'number') {
            return a - b;
          }
          
          return String(a).localeCompare(String(b));
        },
      })
    );
    
    return [rowNumColumn, actionsColumn, ...dataColumnDefs] as ColumnDef<JsonObject, JsonValue>[];
  }, [dataColumns, columnWidths, editingCell, handleCellEdit, handleRowContextMenu, columnHelper]);
  
  // Initialize TanStack Table
  // TanStack Table returns functions that can't be memoized - this is a known library limitation
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: dataRows,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (_, index) => String(index),
  });
  
  const { rows } = table.getRowModel();
  
  // Virtualizer for rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  
  // Keyboard navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCell) return;
      
      const rowCount = rows.length;
      if (rowCount === 0) return;
      
      const pageSize = Math.max(1, Math.floor((tableContainerRef.current?.clientHeight || 400) / ROW_HEIGHT) - 1);
      
      let newIndex = selectedRowIndex ?? -1;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          newIndex = Math.min(rowCount - 1, (selectedRowIndex ?? -1) + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newIndex = Math.max(0, (selectedRowIndex ?? rowCount) - 1);
          break;
        case 'PageDown':
          e.preventDefault();
          newIndex = Math.min(rowCount - 1, (selectedRowIndex ?? 0) + pageSize);
          break;
        case 'PageUp':
          e.preventDefault();
          newIndex = Math.max(0, (selectedRowIndex ?? 0) - pageSize);
          break;
        case 'Home':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            newIndex = 0;
          }
          break;
        case 'End':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            newIndex = rowCount - 1;
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedRowIndex !== null) {
            e.preventDefault();
            handleDeleteRow(rows[selectedRowIndex]?.index ?? selectedRowIndex);
          }
          return;
        case 'Enter':
          if (selectedRowIndex !== null) {
            e.preventDefault();
            const row = rows[selectedRowIndex];
            if (row && dataColumns.length > 0) {
              const firstCol = dataColumns[0];
              if (firstCol && isEditable(row.original[firstCol])) {
                setEditingCell({ rowIndex: row.index, columnId: firstCol });
              }
            }
          }
          return;
        default:
          return;
      }
      
      if (newIndex !== selectedRowIndex && newIndex >= 0 && newIndex < rowCount) {
        setSelectedRowIndex(newIndex);
        rowVirtualizer.scrollToIndex(newIndex, { align: 'auto', behavior: 'smooth' });
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [selectedRowIndex, rows, editingCell, handleDeleteRow, dataColumns, isEditable, rowVirtualizer]);
  
  // Error state
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
  
  // Not a table-compatible structure
  if (dataColumns.length === 0 || dataRows.length === 0) {
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
  
  return (
    <>
      <div 
        ref={containerRef}
        className="h-full flex flex-col bg-editor-bg focus:outline-none" 
        tabIndex={0}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-4 px-3 py-1.5 border-b border-border-subtle text-xs flex-shrink-0">
          <span className="text-text-tertiary">{dataRows.length} rows</span>
          <span className="text-text-tertiary">{dataColumns.length} columns</span>
          <div className="flex-1" />
          <button
            onClick={() => handleAddRow()}
            className="flex items-center gap-1 px-2 py-1 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
          {sorting.length > 0 && (
            <button
              onClick={() => setSorting([])}
              className="text-text-secondary hover:text-text-primary px-2 py-1 hover:bg-bg-hover rounded transition-colors"
            >
              Clear Sort
            </button>
          )}
        </div>
        
        {/* Table Container */}
        <div 
          ref={tableContainerRef}
          className="flex-1 overflow-auto"
        >
          <table 
            className="w-full border-collapse" 
            style={{ 
              tableLayout: 'fixed',
              fontFamily: 'var(--editor-font-family)',
              fontSize: 'var(--editor-font-size)',
            }}
          >
            <thead className="sticky top-0 z-10 bg-bg-surface">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => {
                    const isDataColumn = !header.id.startsWith('__');
                    const width = header.id === '__rowNum' ? 50 
                      : header.id === '__actions' ? 36 
                      : columnWidths[header.id] || header.getSize();
                    
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          'px-3 py-2 text-left font-medium border-b border-r border-border-default relative',
                          header.id === '__rowNum' && 'sticky left-0 z-20 bg-bg-surface',
                          header.id === '__actions' && 'sticky left-[50px] z-20 bg-bg-surface text-center',
                          isDataColumn && 'cursor-pointer hover:bg-bg-hover'
                        )}
                        style={{ width, minWidth: width, maxWidth: header.id.startsWith('__') ? width : undefined }}
                        onClick={isDataColumn ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        
                        {/* Resize handle for data columns */}
                        {isDataColumn && (
                          <div
                            className={cn(
                              'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent',
                              resizingColumn === header.id && 'bg-accent'
                            )}
                            onMouseDown={(e) => handleResizeStart(e, header.id, width)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {/* Top padding for virtualization */}
              {virtualRows.length > 0 && (virtualRows[0]?.start ?? 0) > 0 && (
                <tr>
                  <td style={{ height: virtualRows[0]?.start ?? 0 }} colSpan={columns.length} />
                </tr>
              )}
              
              {virtualRows.map(virtualRow => {
                const row = rows[virtualRow.index] as Row<JsonObject>;
                if (!row) return null;
                
                const originalIndex = row.index;
                const isSelected = selectedRowIndex === virtualRow.index;
                
                return (
                  <tr
                    key={row.id}
                    data-index={virtualRow.index}
                    className={cn(
                      'transition-colors',
                      isSelected 
                        ? 'bg-accent/10' 
                        : virtualRow.index % 2 === 1 
                          ? 'bg-bg-surface/50 hover:bg-bg-hover' 
                          : 'hover:bg-bg-hover'
                    )}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => setSelectedRowIndex(virtualRow.index)}
                    onContextMenu={(e) => handleRowContextMenu(e, originalIndex)}
                  >
                    {row.getVisibleCells().map(cell => {
                      const isDataColumn = !cell.column.id.startsWith('__');
                      
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-3 py-1 border-r border-border-subtle overflow-hidden text-ellipsis whitespace-nowrap',
                            cell.column.id === '__rowNum' && 'sticky left-0 bg-inherit',
                            cell.column.id === '__actions' && 'sticky left-[50px] bg-inherit text-center',
                            isDataColumn && isEditable(cell.getValue() as JsonValue) && 'cursor-pointer'
                          )}
                          style={{ 
                            width: cell.column.getSize(),
                            minWidth: cell.column.getSize(),
                            maxWidth: cell.column.id.startsWith('__') ? cell.column.getSize() : undefined,
                          }}
                          onDoubleClick={() => {
                            if (isDataColumn && isEditable(cell.getValue() as JsonValue)) {
                              setEditingCell({ rowIndex: originalIndex, columnId: cell.column.id });
                            }
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              
              {/* Bottom padding for virtualization */}
              {virtualRows.length > 0 && (
                <tr>
                  <td 
                    style={{ height: totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0) }} 
                    colSpan={columns.length} 
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Keyboard shortcuts hint */}
        <div className="px-3 py-1 border-t border-border-subtle text-xs text-text-muted flex items-center gap-4 overflow-x-auto no-scrollbar flex-shrink-0">
          <span><kbd className="px-1 py-0.5 bg-bg-surface rounded text-[10px]">Arrow</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 bg-bg-surface rounded text-[10px]">PgUp/Dn</kbd> Page</span>
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
