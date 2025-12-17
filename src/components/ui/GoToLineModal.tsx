import { useState, useCallback, useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface GoToLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToLine: (line: number) => void;
  maxLine: number;
}

export function GoToLineModal({ isOpen, onClose, onGoToLine, maxLine }: GoToLineModalProps) {
  const [lineNumber, setLineNumber] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setLineNumber('');
      // Small delay to ensure modal is rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);
  
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const line = parseInt(lineNumber, 10);
    if (!isNaN(line) && line >= 1 && line <= maxLine) {
      onGoToLine(line);
      onClose();
    }
  }, [lineNumber, maxLine, onGoToLine, onClose]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Modal */}
      <div 
        className="relative bg-bg-surface border border-border-default rounded-lg shadow-xl w-80"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 p-3 border-b border-border-subtle">
            <span className="text-sm text-text-secondary">Go to Line</span>
            <span className="text-xs text-text-muted">(1 - {maxLine})</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-3">
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={maxLine}
              value={lineNumber}
              onChange={(e) => setLineNumber(e.target.value)}
              placeholder="Line number..."
              className={cn(
                'w-full px-3 py-2 text-sm',
                'bg-bg-base border border-border-default rounded',
                'text-text-primary placeholder:text-text-muted',
                'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent'
              )}
            />
          </div>
          
          <div className="flex justify-end gap-2 p-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!lineNumber || parseInt(lineNumber) < 1 || parseInt(lineNumber) > maxLine}
              className={cn(
                'px-3 py-1.5 text-sm rounded',
                'bg-accent text-white',
                'hover:bg-accent/90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Go
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
