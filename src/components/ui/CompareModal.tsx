import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  X,
  ArrowsOutSimple,
  ArrowsInSimple,
  ClipboardText,
  FolderOpen,
  CaretUp,
  CaretDown,
  ArrowLeft,
  ArrowRight,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { diffLines, getDiffSummary, type LineDiff, type DiffType } from '@/lib/diff';
import { formatJson } from '@/lib/json';
import { openFile, readFromClipboard } from '@/lib/file';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  leftContent: string;
  leftTitle: string;
  onApplyLeft?: (content: string) => void;
}

export function CompareModal({
  isOpen,
  onClose,
  leftContent,
  leftTitle,
  onApplyLeft,
}: CompareModalProps) {
  const [rightContent, setRightContent] = useState('');
  const [rightTitle, setRightTitle] = useState('Compare');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0);
  
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  
  // Format content for comparison
  const formattedLeft = useMemo(() => {
    return formatJson(leftContent) ?? leftContent;
  }, [leftContent]);
  
  const formattedRight = useMemo(() => {
    return formatJson(rightContent) ?? rightContent;
  }, [rightContent]);
  
  // Calculate diff
  const lineDiffs = useMemo(() => {
    if (!rightContent) return [];
    return diffLines(formattedLeft, formattedRight);
  }, [formattedLeft, formattedRight]);
  
  // Get diff summary
  const summary = useMemo(() => {
    return getDiffSummary(
      lineDiffs
        .filter(d => d.type !== 'unchanged')
        .map(d => ({ path: String(d.lineNumber), type: d.type }))
    );
  }, [lineDiffs]);
  
  // Get indices of changed lines for navigation
  const changeIndices = useMemo(() => {
    return lineDiffs
      .map((d, i) => ({ diff: d, index: i }))
      .filter(({ diff }) => diff.type !== 'unchanged')
      .map(({ index }) => index);
  }, [lineDiffs]);
  
  // Scroll to current diff
  useEffect(() => {
    if (changeIndices.length === 0) return;
    
    const targetIndex = changeIndices[currentDiffIndex];
    if (targetIndex === undefined) return;
    
    const leftLine = leftPanelRef.current?.querySelector(`[data-line="${targetIndex}"]`);
    const rightLine = rightPanelRef.current?.querySelector(`[data-line="${targetIndex}"]`);
    
    leftLine?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    rightLine?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentDiffIndex, changeIndices]);
  
  // Navigate to previous change
  const goToPrevious = useCallback(() => {
    setCurrentDiffIndex(prev => 
      prev <= 0 ? changeIndices.length - 1 : prev - 1
    );
  }, [changeIndices.length]);
  
  // Navigate to next change
  const goToNext = useCallback(() => {
    setCurrentDiffIndex(prev => 
      prev >= changeIndices.length - 1 ? 0 : prev + 1
    );
  }, [changeIndices.length]);
  
  // Load from file
  const handleLoadFromFile = useCallback(async () => {
    const result = await openFile();
    if (result) {
      setRightContent(result.content);
      setRightTitle(result.name);
    }
  }, []);
  
  // Load from clipboard
  const handleLoadFromClipboard = useCallback(async () => {
    const content = await readFromClipboard();
    if (content) {
      setRightContent(content);
      setRightTitle('Clipboard');
    }
  }, []);
  
  // Apply right side to left
  const handleApplyRight = useCallback(() => {
    if (onApplyLeft && rightContent) {
      onApplyLeft(formattedRight);
      onClose();
    }
  }, [onApplyLeft, rightContent, formattedRight, onClose]);
  
  // Synchronized scroll
  const handleScroll = useCallback((source: 'left' | 'right') => {
    const sourcePanel = source === 'left' ? leftPanelRef.current : rightPanelRef.current;
    const targetPanel = source === 'left' ? rightPanelRef.current : leftPanelRef.current;
    
    if (sourcePanel && targetPanel) {
      targetPanel.scrollTop = sourcePanel.scrollTop;
    }
  }, []);
  
  // Keyboard shortcuts: Cmd/Ctrl+Enter to apply, Esc to close
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (onApplyLeft && rightContent) {
          handleApplyRight();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, onApplyLeft, rightContent, handleApplyRight]);
  
  if (!isOpen) return null;
  
  // Split diffs into left and right lines
  const leftLines: LineDiff[] = [];
  const rightLines: LineDiff[] = [];
  
  for (const diff of lineDiffs) {
    if (diff.type === 'removed') {
      leftLines.push(diff);
      rightLines.push({ lineNumber: diff.lineNumber, type: 'unchanged', content: '' });
    } else if (diff.type === 'added') {
      leftLines.push({ lineNumber: diff.lineNumber, type: 'unchanged', content: '' });
      rightLines.push(diff);
    } else {
      leftLines.push(diff);
      rightLines.push(diff);
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-bg-elevated rounded-lg shadow-xl border border-border-default flex flex-col',
        isFullscreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full h-full max-w-[95vw] max-h-[90vh]'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-default bg-bg-surface">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-text-primary">Compare</h2>
            
            {/* Diff Navigation */}
            {changeIndices.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">
                  {currentDiffIndex + 1} of {changeIndices.length} changes
                </span>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" onClick={goToPrevious} className="p-1 h-6 w-6">
                    <CaretUp size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={goToNext} className="p-1 h-6 w-6">
                    <CaretDown size={14} />
                  </Button>
                </div>
              </div>
            )}
            
            {/* Summary */}
            {rightContent && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-diff-added-border">+{summary.added} added</span>
                <span className="text-diff-removed-border">-{summary.removed} removed</span>
                <span className="text-diff-modified-border">~{summary.changed} changed</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(prev => !prev)}
              className="p-1 h-7 w-7"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <ArrowsInSimple size={16} /> : <ArrowsOutSimple size={16} />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-7 w-7">
              <X size={16} />
            </Button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 flex min-h-0">
          {/* Left Panel (Original) */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border-default">
            <div className="px-3 py-1.5 bg-bg-base border-b border-border-subtle flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary truncate">{leftTitle}</span>
              <span className="text-xs text-text-muted">Original</span>
            </div>
            <div 
              ref={leftPanelRef}
              className="flex-1 overflow-auto font-mono text-xs"
              onScroll={() => handleScroll('left')}
            >
              <DiffPanel lines={leftLines} side="left" currentDiffIndex={currentDiffIndex} changeIndices={changeIndices} />
            </div>
          </div>
          
          {/* Right Panel (Comparison) */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-3 py-1.5 bg-bg-base border-b border-border-subtle flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary truncate">{rightTitle}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadFromFile}
                  className="p-1 h-6 text-xs"
                  title="Load from file"
                >
                  <FolderOpen size={14} className="mr-1" />
                  File
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadFromClipboard}
                  className="p-1 h-6 text-xs"
                  title="Paste from clipboard"
                >
                  <ClipboardText size={14} className="mr-1" />
                  Clipboard
                </Button>
              </div>
            </div>
            <div 
              ref={rightPanelRef}
              className="flex-1 overflow-auto font-mono text-xs"
              onScroll={() => handleScroll('right')}
            >
              {rightContent ? (
                <DiffPanel lines={rightLines} side="right" currentDiffIndex={currentDiffIndex} changeIndices={changeIndices} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-muted">
                  <p className="text-sm mb-4">Load content to compare</p>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={handleLoadFromFile}>
                      <FolderOpen size={14} className="mr-2" />
                      Open File
                    </Button>
                    <Button variant="secondary" onClick={handleLoadFromClipboard}>
                      <ClipboardText size={14} className="mr-2" />
                      Paste
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border-default bg-bg-surface">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <ArrowLeft size={12} /> Original
            <span className="mx-2">|</span>
            Modified <ArrowRight size={12} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {onApplyLeft && rightContent && (
              <Button variant="primary" onClick={handleApplyRight}>
                Apply Modified
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Diff Panel Component
// ============================================

interface DiffPanelProps {
  lines: LineDiff[];
  side: 'left' | 'right';
  currentDiffIndex: number;
  changeIndices: number[];
}

function DiffPanel({ lines, side, currentDiffIndex, changeIndices }: DiffPanelProps) {
  const getLineClass = (type: DiffType, index: number): string => {
    const isCurrentChange = changeIndices[currentDiffIndex] === index;
    
    const baseClasses: Record<DiffType, string> = {
      added: 'bg-diff-added-bg border-l-2 border-diff-added-border',
      removed: 'bg-diff-removed-bg border-l-2 border-diff-removed-border',
      changed: 'bg-diff-modified-bg border-l-2 border-diff-modified-border',
      unchanged: '',
    };
    
    return cn(
      baseClasses[type],
      isCurrentChange && type !== 'unchanged' && 'ring-1 ring-accent ring-inset'
    );
  };
  
  const getGutterClass = (type: DiffType): string => {
    const classes: Record<DiffType, string> = {
      added: 'text-diff-added-border',
      removed: 'text-diff-removed-border',
      changed: 'text-diff-modified-border',
      unchanged: 'text-text-muted',
    };
    return classes[type];
  };
  
  const getGutterSymbol = (type: DiffType, side: 'left' | 'right'): string => {
    if (type === 'removed' && side === 'left') return '-';
    if (type === 'added' && side === 'right') return '+';
    if (type === 'changed') return '~';
    return '';
  };
  
  return (
    <table className="w-full border-collapse">
      <tbody>
        {lines.map((line, index) => (
          <tr 
            key={index} 
            data-line={index}
            className={getLineClass(line.type, index)}
          >
            {/* Line number gutter */}
            <td className={cn(
              'w-12 px-2 py-0.5 text-right select-none border-r border-border-subtle',
              getGutterClass(line.type)
            )}>
              <span className="opacity-60">{line.content ? line.lineNumber : ''}</span>
              <span className="ml-1 font-bold">{getGutterSymbol(line.type, side)}</span>
            </td>
            
            {/* Content */}
            <td className="px-3 py-0.5 whitespace-pre text-text-primary">
              {line.content}
            </td>
          </tr>
        ))}
        
        {lines.length === 0 && (
          <tr>
            <td colSpan={2} className="px-3 py-8 text-center text-text-muted">
              No content
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
