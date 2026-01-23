import {
  useReducer,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { createDocument, type Document } from '@/types';
import { generateId } from '@/lib/utils';
import { usePersistence, useHistory } from '@/hooks';
import {
  type DocumentState,
  type DocumentAction,
} from './types';
import {
  DocumentContext,
  DocumentOverrideContext,
} from './documentContext';

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
// Provider
// ============================================

interface DocumentProviderProps {
  children: ReactNode;
}

// Create initial state with one empty document
function createInitialState(): DocumentState {
  const id = generateId();
  const doc = createDocument(id, 'Untitled', '{}');
  const documents = new Map<string, Document>();
  documents.set(id, doc);

  return {
    documents,
    activeDocumentId: id,
    tabOrder: [id],
  };
}

export function DocumentProvider({ children }: DocumentProviderProps) {
  // Create initial state synchronously during first render
  const initialState = useMemo(() => createInitialState(), []);
  
  const [state, dispatch] = useReducer(documentReducer, initialState);
  
  // History manager for undo/redo
  const historyManager = useHistory();
  
  // Track if history has been initialized
  const historyInitializedRef = useRef(false);
  
  // Initialize history for existing documents
  useEffect(() => {
    if (historyInitializedRef.current) return;
    historyInitializedRef.current = true;
    
    for (const [id, doc] of state.documents) {
      historyManager.initHistory(id, doc.content);
    }
  }, [state.documents, historyManager]);
  
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
// Document Override Provider
// ============================================

interface DocumentOverrideProviderProps {
  docId: string;
  children: ReactNode;
}

/**
 * Provider that overrides which document child editors will display.
 * Wrap editors in this provider to make them show a specific document
 * instead of the globally active document.
 */
export function DocumentOverrideProvider({ docId, children }: DocumentOverrideProviderProps) {
  const value = useMemo(() => ({ overrideDocId: docId }), [docId]);
  return (
    <DocumentOverrideContext.Provider value={value}>
      {children}
    </DocumentOverrideContext.Provider>
  );
}
