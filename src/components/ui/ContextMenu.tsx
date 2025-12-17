import { useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Context menu component that appears at a specific position
 */
export function ContextMenu({ items, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    
    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let newX = x;
    let newY = y;
    
    // Adjust horizontal position
    if (x + rect.width > viewportWidth) {
      newX = viewportWidth - rect.width - 8;
    }
    
    // Adjust vertical position
    if (y + rect.height > viewportHeight) {
      newY = viewportHeight - rect.height - 8;
    }
    
    setPosition({ x: Math.max(8, newX), y: Math.max(8, newY) });
  }, [x, y]);
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Close on escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const nextIndex = prev + 1;
          // Skip separators
          for (let i = nextIndex; i < items.length; i++) {
            if (!items[i]?.separator) return i;
          }
          return prev;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const nextIndex = prev - 1;
          // Skip separators
          for (let i = nextIndex; i >= 0; i--) {
            if (!items[i]?.separator) return i;
          }
          return prev;
        });
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        const item = items[focusedIndex];
        if (item && !item.disabled && !item.separator && item.onClick) {
          item.onClick();
          onClose();
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, items, focusedIndex]);
  
  // Focus menu on mount
  useEffect(() => {
    menuRef.current?.focus();
  }, []);
  
  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (item.disabled || item.separator) return;
    item.onClick?.();
    onClose();
  }, [onClose]);
  
  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[100] min-w-[180px] py-1',
        'bg-bg-elevated border border-border-default rounded-lg shadow-lg',
        'outline-none'
      )}
      style={{ left: position.x, top: position.y }}
      tabIndex={-1}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={item.id}
              className="my-1 h-px bg-border-subtle mx-2"
            />
          );
        }
        
        return (
          <button
            key={item.id}
            className={cn(
              'w-full px-3 py-1.5 text-sm text-left',
              'flex items-center gap-2',
              'transition-colors',
              item.disabled
                ? 'text-text-disabled cursor-not-allowed'
                : item.danger
                ? 'text-status-error hover:bg-status-error/10'
                : 'text-text-primary hover:bg-bg-subtle',
              index === focusedIndex && !item.disabled && 'bg-bg-subtle'
            )}
            onClick={() => handleItemClick(item)}
            onMouseEnter={() => setFocusedIndex(index)}
            disabled={item.disabled}
          >
            {item.icon && (
              <span className="w-4 h-4 flex items-center justify-center">
                {item.icon}
              </span>
            )}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="text-xs text-text-tertiary ml-4">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Hook for managing context menu state
 */
export function useContextMenu() {
  const [menuState, setMenuState] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    items: [],
  });
  
  const openMenu = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      items,
    });
  }, []);
  
  const closeMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, isOpen: false }));
  }, []);
  
  return {
    isOpen: menuState.isOpen,
    x: menuState.x,
    y: menuState.y,
    items: menuState.items,
    openMenu,
    closeMenu,
  };
}
