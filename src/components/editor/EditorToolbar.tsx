import { useCallback, useState, useMemo } from 'react';
import {
  ArrowsOutSimple,
  ArrowsInSimple,
  SortAscending,
  SortDescending,
  MagnifyingGlass,
  ArrowCounterClockwise,
  ArrowClockwise,
  Wrench,
  GitDiff,
  Funnel,
  CheckSquare,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Tooltip, TransformModal, CompareModal, SchemaValidatorModal, RepairPreviewModal } from '@/components/ui';
import { useSearch } from '@/store/useSearchStore';
import { useActiveDocument, useActiveDocumentId, useDocument, useDocumentActions, useUndoRedo } from '@/store/useDocumentStore';
import { usePanelLayout } from '@/store/useEditorStore';
import { formatJson, compactJson, parseJson, repairJson, canRepairJson } from '@/lib/json';
import type { ViewMode } from '@/types';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  highlight?: 'warning' | 'error';
}

function ToolbarButton({ icon, label, shortcut, onClick, disabled, active, highlight }: ToolbarButtonProps) {
  return (
    <Tooltip content={label} shortcut={shortcut}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'p-1.5 rounded transition-colors',
          disabled 
            ? 'text-text-muted cursor-not-allowed opacity-50' 
            : active
              ? 'text-accent bg-accent/20'
              : highlight === 'warning'
                ? 'text-warning bg-warning/10 hover:bg-warning/20 animate-pulse-subtle'
                : highlight === 'error'
                  ? 'text-error bg-error/10 hover:bg-error/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border-subtle mx-1" />;
}

interface ViewToggleProps {
  view: ViewMode;
  activeView: ViewMode;
  onClick: (view: ViewMode) => void;
  label: string;
}

function ViewToggle({ view, activeView, onClick, label }: ViewToggleProps) {
  const isActive = view === activeView;
  return (
    <button
      onClick={() => onClick(view)}
      className={cn(
        'px-2.5 py-1 text-xs font-medium rounded transition-colors',
        isActive
          ? 'bg-accent text-white'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
      )}
    >
      {label}
    </button>
  );
}

export function EditorToolbar() {
  // Get panel layout state to determine which document to operate on
  const { panelLayout, activePanel, rightPanelDocId } = usePanelLayout();
  
  // Get the global active document (used for left panel)
  const leftDoc = useActiveDocument();
  const leftDocId = useActiveDocumentId();
  
  // Get the right panel document if in split view
  const rightDoc = useDocument(rightPanelDocId ?? '');
  
  // Determine which document is currently "active" based on panel selection
  const isRightPanelActive = panelLayout === 'split' && activePanel === 'right';
  const doc = isRightPanelActive && rightDoc ? rightDoc : leftDoc;
  const currentDocId = isRightPanelActive && rightPanelDocId ? rightPanelDocId : leftDocId;
  
  const { setViewMode, updateContent } = useDocumentActions();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const { openSearch } = useSearch();
  
  // Modal states
  const [transformModalOpen, setTransformModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);
  const [repairPreviewOpen, setRepairPreviewOpen] = useState(false);
  const [repairedContent, setRepairedContent] = useState('');
  
  // Check if JSON can be repaired (is broken but repairable)
  const docContent = doc?.content;
  const canRepair = useMemo(() => {
    if (!docContent) return false;
    return canRepairJson(docContent);
  }, [docContent]);
  
  // Helper to update content for the current document
  const updateCurrentContent = useCallback((content: string) => {
    if (currentDocId) {
      updateContent(currentDocId, content);
    }
  }, [currentDocId, updateContent]);
  
  const handleFormat = useCallback(() => {
    if (!docContent) return;
    const formatted = formatJson(docContent);
    if (formatted !== null) {
      updateCurrentContent(formatted);
    }
  }, [docContent, updateCurrentContent]);
  
  const handleCompact = useCallback(() => {
    if (!docContent) return;
    const compacted = compactJson(docContent);
    if (compacted !== null) {
      updateCurrentContent(compacted);
    }
  }, [docContent, updateCurrentContent]);
  
  const handleRepair = useCallback(() => {
    if (!docContent) return;
    const result = repairJson(docContent);
    if (result.wasRepaired) {
      setRepairedContent(result.output);
      setRepairPreviewOpen(true);
    }
  }, [docContent]);
  
  const handleApplyRepair = useCallback((content: string) => {
    updateCurrentContent(content);
  }, [updateCurrentContent]);
  
  const handleSortKeys = useCallback((ascending: boolean) => {
    if (!docContent) return;
    
    const { value, error } = parseJson(docContent);
    if (error || value === null) return;
    
    const sortObject = (obj: unknown): unknown => {
      if (obj === null || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(sortObject);
      }
      
      const keys = Object.keys(obj as Record<string, unknown>);
      keys.sort((a, b) => ascending ? a.localeCompare(b) : b.localeCompare(a));
      
      const sorted: Record<string, unknown> = {};
      for (const key of keys) {
        sorted[key] = sortObject((obj as Record<string, unknown>)[key]);
      }
      return sorted;
    };
    
    const sorted = sortObject(value);
    updateCurrentContent(JSON.stringify(sorted, null, 2));
  }, [docContent, updateCurrentContent]);
  
  const handleViewChange = useCallback((view: ViewMode) => {
    if (currentDocId) {
      setViewMode(currentDocId, view);
    }
  }, [currentDocId, setViewMode]);
  
  const handleTransformApply = useCallback((result: string) => {
    updateCurrentContent(result);
    setTransformModalOpen(false);
  }, [updateCurrentContent]);
  
  const isValidJson = docContent ? parseJson(docContent).error === null : false;
  const viewMode = doc?.viewMode ?? 'text';
  
  return (
    <>
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border-subtle bg-bg-surface overflow-x-auto no-scrollbar">
        {/* View mode toggle - hidden on mobile since it's in header */}
        <div className="hidden sm:flex items-center gap-0.5 bg-bg-primary rounded p-0.5 border border-border-subtle">
          <ViewToggle view="text" activeView={viewMode} onClick={handleViewChange} label="text" />
          <ViewToggle view="tree" activeView={viewMode} onClick={handleViewChange} label="tree" />
          <ViewToggle view="table" activeView={viewMode} onClick={handleViewChange} label="table" />
        </div>
        
        <ToolbarDivider />
        
        {/* Format buttons */}
        <ToolbarButton
          icon={<ArrowsOutSimple size={18} />}
          label="Expand / Format"
          shortcut="Ctrl+Shift+F"
          onClick={handleFormat}
          disabled={!isValidJson}
        />
        <ToolbarButton
          icon={<ArrowsInSimple size={18} />}
          label="Compact / Minify"
          shortcut="Ctrl+Shift+M"
          onClick={handleCompact}
          disabled={!isValidJson}
        />
        
        {/* Repair button - only show when JSON is broken but repairable */}
        {canRepair && (
          <ToolbarButton
            icon={<Wrench size={18} />}
            label="Repair JSON"
            onClick={handleRepair}
            highlight="warning"
          />
        )}
        
        <ToolbarDivider />
        
        {/* Sort buttons - hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1">
          <ToolbarButton
            icon={<SortAscending size={18} />}
            label="Sort Keys A-Z"
            onClick={() => handleSortKeys(true)}
            disabled={!isValidJson}
          />
          <ToolbarButton
            icon={<SortDescending size={18} />}
            label="Sort Keys Z-A"
            onClick={() => handleSortKeys(false)}
            disabled={!isValidJson}
          />
          
          <ToolbarDivider />
        </div>
        
        {/* Tools section */}
        <ToolbarButton
          icon={<Funnel size={18} />}
          label="Transform & Query"
          onClick={() => setTransformModalOpen(true)}
          disabled={!isValidJson}
        />
        <div className="hidden sm:flex items-center gap-1">
          <ToolbarButton
            icon={<GitDiff size={18} />}
            label="Compare JSON"
            onClick={() => setCompareModalOpen(true)}
          />
          <ToolbarButton
            icon={<CheckSquare size={18} />}
            label="Validate Schema"
            onClick={() => setSchemaModalOpen(true)}
          />
        </div>
        
        <ToolbarDivider />
        
        {/* Search */}
        <ToolbarButton
          icon={<MagnifyingGlass size={18} />}
          label="Find"
          shortcut="Ctrl+F"
          onClick={() => openSearch(false)}
        />
        
        <ToolbarDivider />
        
        {/* Undo/Redo */}
        <ToolbarButton
          icon={<ArrowCounterClockwise size={18} />}
          label="Undo"
          shortcut="Ctrl+Z"
          onClick={undo}
          disabled={!canUndo}
        />
        <ToolbarButton
          icon={<ArrowClockwise size={18} />}
          label="Redo"
          shortcut="Ctrl+Y"
          onClick={redo}
          disabled={!canRedo}
        />
      </div>
      
      {/* Modals */}
      <TransformModal
        isOpen={transformModalOpen}
        onClose={() => setTransformModalOpen(false)}
        content={doc?.content ?? ''}
        onApply={handleTransformApply}
      />
      
      <CompareModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        leftContent={doc?.content ?? ''}
        leftTitle={doc?.name ?? 'Current Document'}
        onApplyLeft={(content) => {
          updateCurrentContent(content);
          setCompareModalOpen(false);
        }}
      />
      
      <SchemaValidatorModal
        isOpen={schemaModalOpen}
        onClose={() => setSchemaModalOpen(false)}
        content={doc?.content ?? ''}
      />
      
      <RepairPreviewModal
        isOpen={repairPreviewOpen}
        onClose={() => setRepairPreviewOpen(false)}
        originalContent={doc?.content ?? ''}
        repairedContent={repairedContent}
        onApply={handleApplyRepair}
      />
    </>
  );
}
