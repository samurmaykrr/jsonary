import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description?: string;
}

/**
 * Normalize key event to a string identifier
 */
function getKeyId(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(e.key.toLowerCase());
  return parts.join('+');
}

/**
 * Create a key ID from shortcut definition
 */
function shortcutToKeyId(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl || shortcut.meta) parts.push('ctrl');
  if (shortcut.shift) parts.push('shift');
  if (shortcut.alt) parts.push('alt');
  parts.push(shortcut.key.toLowerCase());
  return parts.join('+');
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const shortcutsRef = useRef(shortcuts);
  
  // Update ref in an effect instead of during render
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // But still allow some shortcuts like Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+O, Ctrl+F
        const keyId = getKeyId(e);
        if (!['ctrl+s', 'ctrl+n', 'ctrl+w', 'ctrl+z', 'ctrl+y', 'ctrl+shift+z', 'ctrl+o', 'ctrl+f', 'ctrl+h', 'escape', 'ctrl+shift+f', 'ctrl+shift+m', 'f8', 'ctrl+g', 'alt+]', 'alt+['].includes(keyId)) {
          return;
        }
      }
      
      const keyId = getKeyId(e);
      
      for (const shortcut of shortcutsRef.current) {
        if (shortcutToKeyId(shortcut) === keyId) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

/**
 * Hook for common editor shortcuts
 */
export function useEditorShortcuts(handlers: {
  onSave?: () => void;
  onOpen?: () => void;
  onNewTab?: () => void;
  onCloseTab?: () => void;
  onFormat?: () => void;
  onCompact?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onViewText?: () => void;
  onViewTree?: () => void;
  onViewTable?: () => void;
  onToggleTheme?: () => void;
  onSettings?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onCopyPath?: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onEscape?: () => void;
  onGoToError?: () => void;
  onGoToLine?: () => void;
}) {
  const shortcuts = useCallback((): KeyboardShortcut[] => {
    const result: KeyboardShortcut[] = [];
    
    if (handlers.onSave) {
      result.push({ key: 's', ctrl: true, action: handlers.onSave, description: 'Save' });
    }
    if (handlers.onOpen) {
      result.push({ key: 'o', ctrl: true, action: handlers.onOpen, description: 'Open File' });
    }
    if (handlers.onNewTab) {
      result.push({ key: 'n', ctrl: true, action: handlers.onNewTab, description: 'New Tab' });
    }
    if (handlers.onCloseTab) {
      result.push({ key: 'w', ctrl: true, action: handlers.onCloseTab, description: 'Close Tab' });
    }
    if (handlers.onFormat) {
      result.push({ key: 'f', ctrl: true, shift: true, action: handlers.onFormat, description: 'Format' });
    }
    if (handlers.onCompact) {
      result.push({ key: 'm', ctrl: true, shift: true, action: handlers.onCompact, description: 'Compact' });
    }
    if (handlers.onUndo) {
      result.push({ key: 'z', ctrl: true, action: handlers.onUndo, description: 'Undo' });
    }
    if (handlers.onRedo) {
      result.push({ key: 'y', ctrl: true, action: handlers.onRedo, description: 'Redo' });
      result.push({ key: 'z', ctrl: true, shift: true, action: handlers.onRedo, description: 'Redo' });
    }
    if (handlers.onFind) {
      result.push({ key: 'f', ctrl: true, action: handlers.onFind, description: 'Find' });
    }
    if (handlers.onReplace) {
      result.push({ key: 'h', ctrl: true, action: handlers.onReplace, description: 'Replace' });
    }
    // View mode shortcuts
    if (handlers.onViewText) {
      result.push({ key: '1', ctrl: true, action: handlers.onViewText, description: 'Text View' });
    }
    if (handlers.onViewTree) {
      result.push({ key: '2', ctrl: true, action: handlers.onViewTree, description: 'Tree View' });
    }
    if (handlers.onViewTable) {
      result.push({ key: '3', ctrl: true, action: handlers.onViewTable, description: 'Table View' });
    }
    // Tab navigation - use Alt+] and Alt+[ to avoid browser conflicts
    if (handlers.onNextTab) {
      result.push({ key: ']', alt: true, action: handlers.onNextTab, description: 'Next Tab' });
      result.push({ key: 'PageDown', ctrl: true, action: handlers.onNextTab, description: 'Next Tab' });
    }
    if (handlers.onPrevTab) {
      result.push({ key: '[', alt: true, action: handlers.onPrevTab, description: 'Previous Tab' });
      result.push({ key: 'PageUp', ctrl: true, action: handlers.onPrevTab, description: 'Previous Tab' });
    }
    // Other utilities
    if (handlers.onToggleTheme) {
      result.push({ key: 'd', ctrl: true, shift: true, action: handlers.onToggleTheme, description: 'Toggle Theme' });
    }
    if (handlers.onSettings) {
      result.push({ key: ',', ctrl: true, action: handlers.onSettings, description: 'Settings' });
    }
    if (handlers.onExpandAll) {
      result.push({ key: 'e', ctrl: true, shift: true, action: handlers.onExpandAll, description: 'Expand All' });
    }
    if (handlers.onCollapseAll) {
      result.push({ key: 'c', ctrl: true, shift: true, action: handlers.onCollapseAll, description: 'Collapse All' });
    }
    if (handlers.onEscape) {
      result.push({ key: 'Escape', action: handlers.onEscape, description: 'Close/Cancel' });
    }
    if (handlers.onGoToError) {
      result.push({ key: 'F8', action: handlers.onGoToError, description: 'Go to Error' });
    }
    if (handlers.onGoToLine) {
      result.push({ key: 'g', ctrl: true, action: handlers.onGoToLine, description: 'Go to Line' });
    }
    
    return result;
  }, [handlers]);
  
  useKeyboardShortcuts(shortcuts());
}

/**
 * Get a list of all available shortcuts for display
 */
export function getShortcutsList(): { key: string; description: string; category: string }[] {
  return [
    // File operations
    { key: 'Ctrl+N', description: 'New Tab', category: 'File' },
    { key: 'Ctrl+O', description: 'Open File', category: 'File' },
    { key: 'Ctrl+S', description: 'Save', category: 'File' },
    { key: 'Ctrl+W', description: 'Close Tab', category: 'File' },
    
    // Edit operations
    { key: 'Ctrl+Z', description: 'Undo', category: 'Edit' },
    { key: 'Ctrl+Y', description: 'Redo', category: 'Edit' },
    { key: 'Ctrl+Shift+Z', description: 'Redo', category: 'Edit' },
    { key: 'Ctrl+F', description: 'Find', category: 'Edit' },
    { key: 'Ctrl+H', description: 'Find & Replace', category: 'Edit' },
    
    // Format
    { key: 'Ctrl+Shift+F', description: 'Format JSON', category: 'Format' },
    { key: 'Ctrl+Shift+M', description: 'Compact JSON', category: 'Format' },
    
    // View
    { key: 'Ctrl+1', description: 'Text View', category: 'View' },
    { key: 'Ctrl+2', description: 'Tree View', category: 'View' },
    { key: 'Ctrl+3', description: 'Table View', category: 'View' },
    { key: 'Ctrl+Shift+E', description: 'Expand All (Tree)', category: 'View' },
    { key: 'Ctrl+Shift+C', description: 'Collapse All (Tree)', category: 'View' },
    
    // Navigation
    { key: 'Alt+]', description: 'Next Tab', category: 'Navigation' },
    { key: 'Alt+[', description: 'Previous Tab', category: 'Navigation' },
    { key: 'Ctrl+PageDown', description: 'Next Tab', category: 'Navigation' },
    { key: 'Ctrl+PageUp', description: 'Previous Tab', category: 'Navigation' },
    { key: 'F8', description: 'Go to Error', category: 'Navigation' },
    { key: 'Ctrl+G', description: 'Go to Line', category: 'Navigation' },
    
    // Other
    { key: 'Ctrl+Shift+D', description: 'Toggle Theme', category: 'Other' },
    { key: 'Ctrl+,', description: 'Settings', category: 'Other' },
    { key: 'Escape', description: 'Close Modal/Cancel', category: 'Other' },
  ];
}
