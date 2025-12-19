import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  className?: string;
  /** Keyboard shortcut to display (e.g., "Ctrl+S") */
  shortcut?: string;
}

/**
 * Format shortcut for current platform (Cmd on Mac, Ctrl on others)
 */
function formatShortcut(shortcut: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  
  if (isMac) {
    return shortcut
      .replace(/Ctrl\+/gi, '⌘')
      .replace(/Alt\+/gi, '⌥')
      .replace(/Shift\+/gi, '⇧')
      .replace(/\+/g, '');
  }
  
  return shortcut;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 400,
  disabled = false,
  className,
  shortcut,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const showTooltip = useCallback(() => {
    if (disabled) return;
    
    timeoutRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      
      const rect = triggerRef.current.getBoundingClientRect();
      const gap = 8;
      
      let style: CSSProperties = {};
      
      switch (position) {
        case 'top':
          style = {
            left: rect.left + rect.width / 2,
            top: rect.top - gap,
            transform: 'translate(-50%, -100%)',
          };
          break;
        case 'bottom':
          style = {
            left: rect.left + rect.width / 2,
            top: rect.bottom + gap,
            transform: 'translate(-50%, 0)',
          };
          break;
        case 'left':
          style = {
            left: rect.left - gap,
            top: rect.top + rect.height / 2,
            transform: 'translate(-100%, -50%)',
          };
          break;
        case 'right':
          style = {
            left: rect.right + gap,
            top: rect.top + rect.height / 2,
            transform: 'translate(0, -50%)',
          };
          break;
      }
      
      setCoords(style);
      setIsVisible(true);
    }, delay);
  }, [disabled, delay, position]);
  
  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  const positionClasses = {
    top: 'origin-bottom',
    bottom: 'origin-top',
    left: 'origin-right',
    right: 'origin-left',
  };
  
  const formattedShortcut = shortcut ? formatShortcut(shortcut) : null;
  
  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      
      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            className={cn(
              'fixed z-50 px-2 py-1 text-xs font-medium',
              'bg-bg-elevated text-text-primary',
              'border border-border-default rounded shadow-lg',
              'animate-in fade-in zoom-in-95 duration-100',
              'flex items-center gap-2',
              positionClasses[position],
              className
            )}
            style={coords}
            role="tooltip"
          >
            <span>{content}</span>
            {formattedShortcut && (
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-bg-base border border-border-subtle rounded text-text-tertiary">
                {formattedShortcut}
              </kbd>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
