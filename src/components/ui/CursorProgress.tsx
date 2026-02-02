import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { CursorProgressContext, type CursorProgressContextValue, type CursorProgressState } from './CursorProgressContext';

// Simple spinner component since it doesn't exist
function Spinner({ size = 'sm', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-current border-t-transparent',
        sizeClasses[size],
        className
      )}
    />
  );
}

// Type guard to check if the event has client coordinates
function hasClientCoords(ev: unknown): ev is { clientX: number; clientY: number } {
  return (
    typeof ev === 'object' &&
    ev !== null &&
    'clientX' in ev &&
    'clientY' in ev &&
    typeof (ev as { clientX: unknown }).clientX === 'number' &&
    typeof (ev as { clientY: unknown }).clientY === 'number'
  );
}

// ============================================
// Provider Component
// ============================================

interface CursorProgressProviderProps {
  children: React.ReactNode;
}

export function CursorProgressProvider({ children }: CursorProgressProviderProps) {
  const [state, setState] = useState<CursorProgressState>({
    isVisible: false,
    message: '',
    x: 0,
    y: 0,
  });

  // Track mouse position more reliably using pointer events and mousemove.
  const mousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      // Debug
      console.log('[CursorProgress] mousemove', mousePosRef.current);

      // Update position if visible
      setState(prev => {
        if (!prev.isVisible) return prev;
        return { ...prev, x: e.clientX, y: e.clientY };
      });
    };

    const handlePointerDown = (e: PointerEvent) => {
      // pointerdown fires on mouse/touch/pen interactions and gives the
      // most recent coordinates when the user clicks - helps when show()
      // is called without an event.
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      console.log('[CursorProgress] pointerdown', mousePosRef.current);
      // Update visible indicator immediately if currently visible
      setState(prev => {
        if (!prev.isVisible) return prev;
        return { ...prev, x: e.clientX, y: e.clientY };
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  const show = useCallback(
    (message: string, ev?: MouseEvent | PointerEvent | { clientX: number; clientY: number }) => {
      // Determine coordinates: prefer supplied event, fall back to last known
      let x = mousePosRef.current.x;
      let y = mousePosRef.current.y;

      if (hasClientCoords(ev)) {
        x = ev.clientX;
        y = ev.clientY;
      }

      // Debug
      console.log('[CursorProgress] show', { message, x, y, event: ev });

      setState({ isVisible: true, message, x, y });
    },
    []
  );

  const hide = useCallback(() => {
    console.log('[CursorProgress] hide');
    setState(prev => ({ ...prev, isVisible: false }));
  }, []);

  const value: CursorProgressContextValue = {
    show,
    hide,
    isVisible: state.isVisible,
  };

  return (
    <CursorProgressContext.Provider value={value}>
      {children}
      <CursorProgressIndicator state={state} />
    </CursorProgressContext.Provider>
  );
}

// ============================================
// Indicator Component
// ============================================

interface CursorProgressIndicatorProps {
  state: CursorProgressState;
}

function CursorProgressIndicator({ state }: CursorProgressIndicatorProps) {
  const { isVisible, message, x, y } = state;
  const elementRef = useRef<HTMLDivElement>(null);

  if (!isVisible) return null;

  // Position the indicator near the cursor but not directly under it
  // Offset by 15px to the right and 15px down from the cursor tip
  const offsetX = 15;
  const offsetY = 15;

  // Default position (will update based on viewport)
  const posX = x + offsetX;
  const posY = y + offsetY;

  // Debug
  console.log('[CursorProgress] render indicator', { x, y, posX, posY, message });

  return createPortal(
    <div
      ref={elementRef}
      className={cn(
        'fixed z-[2147483647] pointer-events-none select-none',
        'flex items-center gap-2 px-3 py-2',
        'bg-bg-elevated/98 backdrop-blur-md',
        'border border-accent/30 rounded-lg shadow-xl',
        'animate-in fade-in zoom-in-95 duration-100'
      )}
      style={{
        left: posX,
        top: posY,
        transform: 'translate(0, 0)',
        willChange: 'left, top',
      }}
    >
      <Spinner size="sm" className="text-accent" />
      <span className="text-sm font-medium text-text-primary whitespace-nowrap">
        {message}
      </span>
    </div>,
    document.body
  );
}
