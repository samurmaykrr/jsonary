import { useMemo, useEffect, useCallback } from 'react';
import {
  X,
  Wrench,
  ArrowRight,
  Plus,
  Minus,
  Equals,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { diffLines, type LineDiff } from '@/lib/diff';
import { formatJson } from '@/lib/json';

interface RepairPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalContent: string;
  repairedContent: string;
  onApply: (repairedContent: string) => void;
}

export function RepairPreviewModal({
  isOpen,
  onClose,
  originalContent,
  repairedContent,
  onApply,
}: RepairPreviewModalProps) {
  // Format the repaired content for better comparison
  const formattedRepaired = useMemo(() => {
    const formatted = formatJson(repairedContent);
    return formatted ?? repairedContent;
  }, [repairedContent]);
  
  // Compute line-by-line diff
  const lineDiffs = useMemo(() => {
    return diffLines(originalContent, formattedRepaired);
  }, [originalContent, formattedRepaired]);
  
  // Get statistics
  const stats = useMemo(() => {
    const added = lineDiffs.filter(d => d.type === 'added').length;
    const removed = lineDiffs.filter(d => d.type === 'removed').length;
    const unchanged = lineDiffs.filter(d => d.type === 'unchanged').length;
    return { added, removed, unchanged };
  }, [lineDiffs]);
  
  // Handle apply action
  const handleApply = useCallback(() => {
    onApply(formattedRepaired);
    onClose();
  }, [onApply, formattedRepaired, onClose]);
  
  // Keyboard shortcuts: Cmd/Ctrl+Enter to apply, Esc to cancel
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleApply();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, handleApply]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-bg-elevated rounded-lg shadow-xl border border-border-default max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-warning" />
            <h2 className="text-sm font-medium text-text-primary">Repair Preview</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-7 w-7">
            <X size={16} />
          </Button>
        </div>
        
        {/* Summary */}
        <div className="px-4 py-3 border-b border-border-default bg-bg-surface">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-text-secondary">Changes:</span>
            <span className="flex items-center gap-1 text-success">
              <Plus size={12} weight="bold" />
              {stats.added} added
            </span>
            <span className="flex items-center gap-1 text-error">
              <Minus size={12} weight="bold" />
              {stats.removed} removed
            </span>
            <span className="flex items-center gap-1 text-text-muted">
              <Equals size={12} weight="bold" />
              {stats.unchanged} unchanged
            </span>
          </div>
        </div>
        
        {/* Diff View */}
        <div className="flex-1 overflow-auto p-4">
          <div className="font-mono text-xs bg-bg-base border border-border-default rounded overflow-auto">
            {lineDiffs.map((line, idx) => (
              <DiffLine key={idx} diff={line} />
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-default">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button 
            variant="primary" 
            onClick={handleApply}
            className="flex items-center gap-1"
          >
            Apply Repair
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function DiffLine({ diff }: { diff: LineDiff }) {
  const prefix = diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : ' ';
  
  return (
    <div
      className={cn(
        'px-3 py-0.5 whitespace-pre border-l-2',
        diff.type === 'added' && 'bg-success/10 border-success text-success',
        diff.type === 'removed' && 'bg-error/10 border-error text-error',
        diff.type === 'unchanged' && 'border-transparent text-text-secondary'
      )}
    >
      <span className="inline-block w-4 select-none opacity-70">{prefix}</span>
      {diff.content || ' '}
    </div>
  );
}
