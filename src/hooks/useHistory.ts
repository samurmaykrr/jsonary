import { useRef, useCallback, useMemo } from 'react';

/**
 * History entry representing a document state
 */
interface HistoryEntry {
  content: string;
  timestamp: number;
  cursorPosition?: number;
}

/**
 * History state for a single document
 */
interface DocumentHistory {
  entries: HistoryEntry[];
  currentIndex: number;
  lastSavedIndex: number;
}

/**
 * Options for the useHistory hook
 */
interface UseHistoryOptions {
  /** Maximum number of history entries per document */
  maxEntries?: number;
  /** Debounce time in ms for grouping rapid changes */
  debounceMs?: number;
}

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Hook for managing undo/redo history across multiple documents
 */
export function useHistory(options: UseHistoryOptions = {}) {
  const { maxEntries = DEFAULT_MAX_ENTRIES, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  
  // Store history for all documents
  const historyMapRef = useRef<Map<string, DocumentHistory>>(new Map());
  
  // Get or create history for a document
  const getHistory = useCallback((docId: string): DocumentHistory => {
    let history = historyMapRef.current.get(docId);
    if (!history) {
      history = {
        entries: [],
        currentIndex: -1,
        lastSavedIndex: -1,
      };
      historyMapRef.current.set(docId, history);
    }
    return history;
  }, []);
  
  // Initialize history for a document with initial content
  const initHistory = useCallback((docId: string, content: string) => {
    const history = getHistory(docId);
    if (history.entries.length === 0) {
      history.entries.push({
        content,
        timestamp: Date.now(),
      });
      history.currentIndex = 0;
      history.lastSavedIndex = 0;
    }
  }, [getHistory]);
  
  // Push a new entry to history
  const pushHistory = useCallback((docId: string, content: string, cursorPosition?: number) => {
    const history = getHistory(docId);
    const now = Date.now();
    
    // If there's a current entry and content hasn't changed, skip
    if (history.currentIndex >= 0) {
      const currentEntry = history.entries[history.currentIndex];
      if (currentEntry?.content === content) {
        return;
      }
      
      // Debounce: if the last change was recent, update it instead of creating new entry
      if (currentEntry && now - currentEntry.timestamp < debounceMs) {
        history.entries[history.currentIndex] = {
          content,
          timestamp: now,
          cursorPosition,
        };
        return;
      }
    }
    
    // Remove any entries after current index (discard redo history)
    history.entries = history.entries.slice(0, history.currentIndex + 1);
    
    // Add new entry
    history.entries.push({
      content,
      timestamp: now,
      cursorPosition,
    });
    
    // Trim history if it exceeds max entries
    if (history.entries.length > maxEntries) {
      const removeCount = history.entries.length - maxEntries;
      history.entries = history.entries.slice(removeCount);
      history.lastSavedIndex = Math.max(-1, history.lastSavedIndex - removeCount);
    }
    
    history.currentIndex = history.entries.length - 1;
  }, [getHistory, debounceMs, maxEntries]);
  
  // Undo: go back one entry
  const undo = useCallback((docId: string): HistoryEntry | null => {
    const history = getHistory(docId);
    
    if (history.currentIndex <= 0) {
      return null; // Nothing to undo
    }
    
    history.currentIndex -= 1;
    const entry = history.entries[history.currentIndex];
    return entry ?? null;
  }, [getHistory]);
  
  // Redo: go forward one entry
  const redo = useCallback((docId: string): HistoryEntry | null => {
    const history = getHistory(docId);
    
    if (history.currentIndex >= history.entries.length - 1) {
      return null; // Nothing to redo
    }
    
    history.currentIndex += 1;
    const entry = history.entries[history.currentIndex];
    return entry ?? null;
  }, [getHistory]);
  
  // Check if undo is available
  const canUndo = useCallback((docId: string): boolean => {
    const history = getHistory(docId);
    return history.currentIndex > 0;
  }, [getHistory]);
  
  // Check if redo is available
  const canRedo = useCallback((docId: string): boolean => {
    const history = getHistory(docId);
    return history.currentIndex < history.entries.length - 1;
  }, [getHistory]);
  
  // Mark current state as saved
  const markSaved = useCallback((docId: string) => {
    const history = getHistory(docId);
    history.lastSavedIndex = history.currentIndex;
  }, [getHistory]);
  
  // Check if document has unsaved changes
  const hasUnsavedChanges = useCallback((docId: string): boolean => {
    const history = getHistory(docId);
    return history.currentIndex !== history.lastSavedIndex;
  }, [getHistory]);
  
  // Clear history for a document
  const clearHistory = useCallback((docId: string) => {
    historyMapRef.current.delete(docId);
  }, []);
  
  // Get current history info for a document
  const getHistoryInfo = useCallback((docId: string) => {
    const history = getHistory(docId);
    return {
      undoCount: history.currentIndex,
      redoCount: history.entries.length - 1 - history.currentIndex,
      totalEntries: history.entries.length,
      hasUnsavedChanges: history.currentIndex !== history.lastSavedIndex,
    };
  }, [getHistory]);
  
  return useMemo(() => ({
    initHistory,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    markSaved,
    hasUnsavedChanges,
    clearHistory,
    getHistoryInfo,
  }), [
    initHistory,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    markSaved,
    hasUnsavedChanges,
    clearHistory,
    getHistoryInfo,
  ]);
}

/**
 * Type for the history manager returned by useHistory
 */
export type HistoryManager = ReturnType<typeof useHistory>;
