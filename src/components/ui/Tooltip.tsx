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
      const padding = 8; // Minimum padding from viewport edge
      
      // Set initial visibility to measure tooltip
      setIsVisible(true);
      
      // Use requestAnimationFrame to ensure the tooltip is rendered before measuring
      requestAnimationFrame(() => {
        if (!tooltipRef.current) return;
        
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let style: CSSProperties = {};
        let finalPosition = position;
        
        // Helper to calculate position and check if it fits
        const calculatePosition = (pos: TooltipPosition): { style: CSSProperties; fitsVertically: boolean; fitsHorizontally: boolean } => {
          let calcStyle: CSSProperties = {};
          
          switch (pos) {
            case 'top':
              calcStyle = {
                left: rect.left + rect.width / 2,
                top: rect.top - gap,
                transform: 'translate(-50%, -100%)',
              };
              break;
            case 'bottom':
              calcStyle = {
                left: rect.left + rect.width / 2,
                top: rect.bottom + gap,
                transform: 'translate(-50%, 0)',
              };
              break;
            case 'left':
              calcStyle = {
                left: rect.left - gap,
                top: rect.top + rect.height / 2,
                transform: 'translate(-100%, -50%)',
              };
              break;
            case 'right':
              calcStyle = {
                left: rect.right + gap,
                top: rect.top + rect.height / 2,
                transform: 'translate(0, -50%)',
              };
              break;
          }
          
          // Calculate actual tooltip bounds after transform
          const left = typeof calcStyle.left === 'number' ? calcStyle.left : 0;
          const top = typeof calcStyle.top === 'number' ? calcStyle.top : 0;
          
          let tooltipLeft = left;
          let tooltipTop = top;
          let tooltipRight = left;
          let tooltipBottom = top;
          
          // Apply transform to calculate actual position
          if (pos === 'top') {
            tooltipLeft = left - tooltipRect.width / 2;
            tooltipTop = top - tooltipRect.height;
            tooltipRight = tooltipLeft + tooltipRect.width;
            tooltipBottom = top;
          } else if (pos === 'bottom') {
            tooltipLeft = left - tooltipRect.width / 2;
            tooltipTop = top;
            tooltipRight = tooltipLeft + tooltipRect.width;
            tooltipBottom = top + tooltipRect.height;
          } else if (pos === 'left') {
            tooltipLeft = left - tooltipRect.width;
            tooltipTop = top - tooltipRect.height / 2;
            tooltipRight = left;
            tooltipBottom = tooltipTop + tooltipRect.height;
          } else if (pos === 'right') {
            tooltipLeft = left;
            tooltipTop = top - tooltipRect.height / 2;
            tooltipRight = left + tooltipRect.width;
            tooltipBottom = tooltipTop + tooltipRect.height;
          }
          
          const fitsVertically = tooltipTop >= padding && tooltipBottom <= viewportHeight - padding;
          const fitsHorizontally = tooltipLeft >= padding && tooltipRight <= viewportWidth - padding;
          
          return { style: calcStyle, fitsVertically, fitsHorizontally };
        };
        
        // Try primary position
        const { style: primaryStyle, fitsVertically: primaryFitsV, fitsHorizontally: primaryFitsH } = calculatePosition(position);
        style = primaryStyle;
        let fitsVertically = primaryFitsV;
        let fitsHorizontally = primaryFitsH;
        
        // If primary position doesn't fit, try flipping to opposite side
        if (!fitsVertically || !fitsHorizontally) {
          const oppositePosition: Record<TooltipPosition, TooltipPosition> = {
            top: 'bottom',
            bottom: 'top',
            left: 'right',
            right: 'left',
          };
          
          const opposite = oppositePosition[position];
          const { style: oppositeStyle, fitsVertically: oppositeFitsV, fitsHorizontally: oppositeFitsH } = calculatePosition(opposite);
          
          // Use opposite position if it fits better
          if ((position === 'top' || position === 'bottom') && oppositeFitsV) {
            style = oppositeStyle;
            finalPosition = opposite;
            fitsVertically = oppositeFitsV;
            fitsHorizontally = oppositeFitsH;
          } else if ((position === 'left' || position === 'right') && oppositeFitsH) {
            style = oppositeStyle;
            finalPosition = opposite;
            fitsVertically = oppositeFitsV;
            fitsHorizontally = oppositeFitsH;
          }
        }
        
        // Adjust horizontal position to prevent edge clipping
        if (!fitsHorizontally && (finalPosition === 'top' || finalPosition === 'bottom')) {
          const left = typeof style.left === 'number' ? style.left : 0;
          const tooltipLeft = left - tooltipRect.width / 2;
          const tooltipRight = tooltipLeft + tooltipRect.width;
          
          if (tooltipLeft < padding) {
            // Clipping left edge - shift right
            const shift = padding - tooltipLeft;
            style.left = left + shift;
          } else if (tooltipRight > viewportWidth - padding) {
            // Clipping right edge - shift left
            const shift = tooltipRight - (viewportWidth - padding);
            style.left = left - shift;
          }
        }
        
        // Adjust vertical position to prevent edge clipping
        if (!fitsVertically && (finalPosition === 'left' || finalPosition === 'right')) {
          const top = typeof style.top === 'number' ? style.top : 0;
          const tooltipTop = top - tooltipRect.height / 2;
          const tooltipBottom = tooltipTop + tooltipRect.height;
          
          if (tooltipTop < padding) {
            // Clipping top edge - shift down
            const shift = padding - tooltipTop;
            style.top = top + shift;
          } else if (tooltipBottom > viewportHeight - padding) {
            // Clipping bottom edge - shift up
            const shift = tooltipBottom - (viewportHeight - padding);
            style.top = top - shift;
          }
        }
        
        setCoords(style);
      });
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
