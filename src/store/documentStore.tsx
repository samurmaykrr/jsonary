import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { createDocument, type Document, type ViewMode, type ValidationError, type JsonSchema, type SchemaSource } from '@/types';
import { generateId } from '@/lib/utils';
import { usePersistence, useHistory, type HistoryManager } from '@/hooks';
import {
  type DocumentState,
  type DocumentAction,
} from './types';

// ============================================
// Reducer
// ============================================

function documentReducer(state: DocumentState, action: DocumentAction): DocumentState {
  switch (action.type) {
    case 'CREATE_DOCUMENT': {
      const { id, name, content } = action.payload;
      const newDoc = createDocument(id, name, content);
      
      const newDocuments = new Map(state.documents);
      newDocuments.set(id, newDoc);
      
      return {
        ...state,
        documents: newDocuments,
        tabOrder: [...state.tabOrder, id],
        activeDocumentId: id,
      };
    }
    
    case 'CLOSE_DOCUMENT': {
      const { id } = action.payload;
      const newDocuments = new Map(state.documents);
      newDocuments.delete(id);
      
      const newTabOrder = state.tabOrder.filter(tabId => tabId !== id);
      
      // Select next tab if closing active
      let newActiveId = state.activeDocumentId;
      if (state.activeDocumentId === id) {
        const closedIndex = state.tabOrder.indexOf(id);
        newActiveId = newTabOrder[Math.min(closedIndex, newTabOrder.length - 1)] ?? null;
      }
      
      return {
        ...state,
        documents: newDocuments,
        tabOrder: newTabOrder,
        activeDocumentId: newActiveId,
      };
    }
    
    case 'SET_ACTIVE': {
      const { id } = action.payload;
      if (!state.documents.has(id)) return state;
      return { ...state, activeDocumentId: id };
    }
    
    case 'UPDATE_CONTENT': {
      const { id, content } = action.payload;
      const doc = state.documents.get(id);
      if (!doc) return state;
      
      const newDocuments = new Map(state.documents);
      newDocuments.set(id, {
        ...doc,
        content,
        modifiedAt: Date.now(),
        isDirty: true,
      });
      
      return { ...state, documents: newDocuments };
    }
    
    case 'SET_VIEW_MODE': {
      const { id, mode } = action.payload;
      const doc = state.documents.get(id);
      if (!doc) return state;
      
      const newDocuments = new Map(state.documents);
      newDocuments.set(id, { ...doc, viewMode: mode });
      
      return { ...state, documents: newDocuments };
    }
    
    case 'RENAME_DOCUMENT': {
      const { id, name } = action.payload;
      const doc = state.documents.get(id);
      if (!doc) return state;
      
      const newDocuments = new Map(state.documents);
      newDocuments.set(id, { ...doc, name, modifiedAt: Date.now() });
      
      return { ...state, documents: newDocuments };
    }
    
    case 'REORDER_TABS': {
      const { fromIndex, toIndex } = action.payload;
      const newTabOrder = [...state.tabOrder];
      const [moved] = newTabOrder.splice(fromIndex, 1);
      if (moved !== undefined) {
        newTabOrder.splice(toIndex, 0, moved);
      }
      return { ...state, tabOrder: newTabOrder };
    }
    
    case 'MARK_SAVED': {
      const { id } = action.payload;
      const doc = state.documents.get(id);
      if (!doc) return state;
      
      const newDocuments = new Map(state.documents);
      newDocuments.set(id, {
        ...doc,
        isDirty: false,
        savedAt: Date.now(),
      });
      
      return { ...state, documents: newDocuments };
    }
    
    case 'SET_PARSE_ERROR': {
      const { id, error } = action.payload;
      const doc = state.documents.get(id);
      if (!doc) return state;
      
      const newDocuments = new Map(state.documents);
      newDocuments.set(id, {
        ...doc,
        parseError: error,
        isValid: error === null,
      });
      
      return { ...state, documents: newDocuments };
    }
    
    case 'SET_VALIDATION_ERRORS': {
      const { id, errors } = action.payload;
      const doc = state.documents.get(id);
      if (!doc) return state;
      
      const newDocuments = new Map(state.documents);
      newDocuments.set(id, {
        ...doc,
        validationErrors: errors,
      });
      
      return { ...state, documents: newDocuments };
    }
    
    case 'SET_SCHEMA': {
      const { id, schema, source } = action.payload;
      const doc = state.documents.get(id);
      if (!doc) return state;
      
      const newDocuments = new Map(state.documents);
      newDocuments.set(id, {
        ...doc,
        schema,
        schemaSource: source,
      });
      
      return { ...state, documents: newDocuments };
    }
    
    case 'RESTORE_SESSION': {
      const { documents, activeId, tabOrder } = action.payload;
      const newDocuments = new Map<string, Document>();
      for (const doc of documents) {
        newDocuments.set(doc.id, doc);
      }
      return {
        documents: newDocuments,
        activeDocumentId: activeId,
        tabOrder,
      };
    }
    
    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

interface DocumentContextValue {
  state: DocumentState;
  dispatch: React.Dispatch<DocumentAction>;
  historyManager: HistoryManager;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface DocumentProviderProps {
  children: ReactNode;
}

const SAMPLE_JSON = `{
  "name": "Mayson Editor",
  "version": "0.1.0",
  "description": "A feature-complete JSON editor",
  "features": [
    "Multi-tab support",
    "Syntax highlighting",
    "Tree view",
    "Table view"
  ],
  "settings": {
    "theme": "dark",
    "fontSize": 14,
    "tabSize": 2
  },
  "isAwesome": true,
  "rating": 4.9,
  "users": null
}`;

// Create initial state with one document
function createInitialState(): DocumentState {
  const id = generateId();
  const doc = createDocument(id, 'example.json', SAMPLE_JSON);
  const documents = new Map<string, Document>();
  documents.set(id, doc);
  
  return {
    documents,
    activeDocumentId: id,
    tabOrder: [id],
  };
}

export function DocumentProvider({ children }: DocumentProviderProps) {
  const initialStateRef = useRef<DocumentState | null>(null);
  
  // Only create initial state once
  if (initialStateRef.current === null) {
    initialStateRef.current = createInitialState();
  }
  
  const [state, dispatch] = useReducer(documentReducer, initialStateRef.current);
  
  // History manager for undo/redo
  const historyManager = useHistory();
  
  // Initialize history for existing documents
  useEffect(() => {
    for (const [id, doc] of state.documents) {
      historyManager.initHistory(id, doc.content);
    }
  }, []); // Only run once on mount
  
  // Handle session restore from IndexedDB
  const handleRestore = useCallback((docs: Document[], activeId: string | null, tabOrder: string[]) => {
    dispatch({
      type: 'RESTORE_SESSION',
      payload: { documents: docs, activeId, tabOrder },
    });
    // Initialize history for restored documents
    for (const doc of docs) {
      historyManager.initHistory(doc.id, doc.content);
    }
  }, [historyManager]);
  
  // Persistence hook - saves to IndexedDB
  usePersistence({
    documents: state.documents,
    activeDocumentId: state.activeDocumentId,
    tabOrder: state.tabOrder,
    onRestore: handleRestore,
  });
  
  const value = useMemo(() => ({ state, dispatch, historyManager }), [state, historyManager]);
  
  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

// ============================================
// Hooks
// ============================================

function useDocumentStore() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocumentStore must be used within DocumentProvider');
  }
  return context;
}

/**
 * Get the currently active document
 */
export function useActiveDocument(): Document | null {
  const { state } = useDocumentStore();
  return useMemo(
    () => state.activeDocumentId
      ? state.documents.get(state.activeDocumentId) ?? null
      : null,
    [state.documents, state.activeDocumentId]
  );
}

/**
 * Get a specific document by ID
 */
export function useDocument(id: string): Document | undefined {
  const { state } = useDocumentStore();
  return state.documents.get(id);
}

/**
 * Get tab information for the tab bar
 */
export function useTabs(): Array<{ id: string; name: string; isDirty: boolean; isActive: boolean }> {
  const { state } = useDocumentStore();
  return useMemo(
    () => state.tabOrder.map(id => {
      const doc = state.documents.get(id);
      return {
        id,
        name: doc?.name ?? 'Unknown',
        isDirty: doc?.isDirty ?? false,
        isActive: id === state.activeDocumentId,
      };
    }),
    [state.tabOrder, state.documents, state.activeDocumentId]
  );
}

/**
 * Get the active document ID
 */
export function useActiveDocumentId(): string | null {
  const { state } = useDocumentStore();
  return state.activeDocumentId;
}

/**
 * Document actions hook
 */
export function useDocumentActions() {
  const { state, dispatch, historyManager } = useDocumentStore();
  
  return useMemo(() => ({
    createDocument: (name: string = 'Untitled', content: string = '{\n  \n}'): string => {
      const id = generateId();
      dispatch({ type: 'CREATE_DOCUMENT', payload: { id, name, content } });
      historyManager.initHistory(id, content);
      return id;
    },
    
    duplicateDocument: (sourceId: string): string | null => {
      const sourceDoc = state.documents.get(sourceId);
      if (!sourceDoc) return null;
      
      const newId = generateId();
      const newName = `${sourceDoc.name} (copy)`;
      dispatch({ type: 'CREATE_DOCUMENT', payload: { id: newId, name: newName, content: sourceDoc.content } });
      historyManager.initHistory(newId, sourceDoc.content);
      return newId;
    },
    
    closeDocument: (id: string) => {
      dispatch({ type: 'CLOSE_DOCUMENT', payload: { id } });
      historyManager.clearHistory(id);
    },
    
    setActive: (id: string) => {
      dispatch({ type: 'SET_ACTIVE', payload: { id } });
    },
    
    updateContent: (id: string, content: string) => {
      dispatch({ type: 'UPDATE_CONTENT', payload: { id, content } });
    },
    
    setViewMode: (id: string, mode: ViewMode) => {
      dispatch({ type: 'SET_VIEW_MODE', payload: { id, mode } });
    },
    
    renameDocument: (id: string, name: string) => {
      dispatch({ type: 'RENAME_DOCUMENT', payload: { id, name } });
    },
    
    reorderTabs: (fromIndex: number, toIndex: number) => {
      dispatch({ type: 'REORDER_TABS', payload: { fromIndex, toIndex } });
    },
    
    markSaved: (id: string) => {
      dispatch({ type: 'MARK_SAVED', payload: { id } });
    },
  }), [state.documents, dispatch, historyManager]);
}

/**
 * Callback to update active document content (with history tracking)
 */
export function useUpdateActiveContent() {
  const { state, dispatch, historyManager } = useDocumentStore();
  
  return useCallback((content: string) => {
    if (state.activeDocumentId) {
      // Track in history
      historyManager.pushHistory(state.activeDocumentId, content);
      // Update document
      dispatch({
        type: 'UPDATE_CONTENT',
        payload: { id: state.activeDocumentId, content },
      });
    }
  }, [state.activeDocumentId, dispatch, historyManager]);
}

/**
 * Hook for undo/redo functionality
 */
export function useUndoRedo() {
  const { state, dispatch, historyManager } = useDocumentStore();
  
  const undo = useCallback(() => {
    if (!state.activeDocumentId) return false;
    
    const entry = historyManager.undo(state.activeDocumentId);
    if (entry) {
      dispatch({
        type: 'UPDATE_CONTENT',
        payload: { id: state.activeDocumentId, content: entry.content },
      });
      return true;
    }
    return false;
  }, [state.activeDocumentId, dispatch, historyManager]);
  
  const redo = useCallback(() => {
    if (!state.activeDocumentId) return false;
    
    const entry = historyManager.redo(state.activeDocumentId);
    if (entry) {
      dispatch({
        type: 'UPDATE_CONTENT',
        payload: { id: state.activeDocumentId, content: entry.content },
      });
      return true;
    }
    return false;
  }, [state.activeDocumentId, dispatch, historyManager]);
  
  const canUndo = state.activeDocumentId
    ? historyManager.canUndo(state.activeDocumentId)
    : false;
    
  const canRedo = state.activeDocumentId
    ? historyManager.canRedo(state.activeDocumentId)
    : false;
  
  return { undo, redo, canUndo, canRedo };
}

/**
 * Hook for getting validation errors for the active document
 */
export function useValidationErrors(): ValidationError[] {
  const { state } = useDocumentStore();
  const activeDoc = state.activeDocumentId
    ? state.documents.get(state.activeDocumentId)
    : null;
  return activeDoc?.validationErrors ?? [];
}

/**
 * Hook for setting validation errors on a document
 */
export function useSetValidationErrors() {
  const { state, dispatch } = useDocumentStore();
  
  return useCallback((errors: ValidationError[]) => {
    if (state.activeDocumentId) {
      dispatch({
        type: 'SET_VALIDATION_ERRORS',
        payload: { id: state.activeDocumentId, errors },
      });
    }
  }, [state.activeDocumentId, dispatch]);
}

/**
 * Hook for getting the schema associated with the active document
 */
export function useActiveDocumentSchema(): { schema: JsonSchema | null; source: SchemaSource | null } {
  const { state } = useDocumentStore();
  const activeDoc = state.activeDocumentId
    ? state.documents.get(state.activeDocumentId)
    : null;
  return {
    schema: activeDoc?.schema ?? null,
    source: activeDoc?.schemaSource ?? null,
  };
}

/**
 * Hook for setting the schema on the active document
 */
export function useSetDocumentSchema() {
  const { state, dispatch } = useDocumentStore();
  
  return useCallback((schema: JsonSchema | null, source: SchemaSource | null) => {
    if (state.activeDocumentId) {
      dispatch({
        type: 'SET_SCHEMA',
        payload: { id: state.activeDocumentId, schema, source },
      });
    }
  }, [state.activeDocumentId, dispatch]);
}
