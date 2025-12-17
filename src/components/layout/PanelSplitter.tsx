import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface PanelSplitterProps {
  onResize: (ratio: number) => void;
  className?: string;
}

export function PanelSplitter({ onResize, className }: PanelSplitterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Get the parent container (the split view container)
      const container = containerRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newRatio = (moveEvent.clientX - rect.left) / rect.width;
      onResize(newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onResize]);

  const handleDoubleClick = useCallback(() => {
    // Reset to 50/50 split on double-click
    onResize(0.5);
  }, [onResize]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-1 flex-shrink-0 cursor-col-resize group',
        'bg-border-default hover:bg-accent transition-colors',
        isDragging && 'bg-accent',
        className
      )}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
    >
      {/* Larger hit area */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
      
      {/* Visual indicator in the middle */}
      <div
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-1 h-8 rounded-full',
          'bg-border-strong group-hover:bg-accent-hover transition-colors',
          isDragging && 'bg-accent-hover'
        )}
      />
    </div>
  );
}
