import { useEffect, useRef, useCallback } from 'react';
import {
  saveDocuments,
  saveSession,
  loadAllDocuments,
  loadSession,
  deleteDocument,
  createDebouncedSave,
} from '@/lib/storage';
import type { Document } from '@/types';

interface UsePersistenceOptions {
  documents: Map<string, Document>;
  activeDocumentId: string | null;
  tabOrder: string[];
  onRestore: (docs: Document[], activeId: string | null, tabOrder: string[]) => void;
}

/**
 * Hook to persist documents to IndexedDB
 */
export function usePersistence({
  documents,
  activeDocumentId,
  tabOrder,
  onRestore,
}: UsePersistenceOptions) {
  const isInitializedRef = useRef(false);
  const previousDocIdsRef = useRef<Set<string>>(new Set());
  const debouncedSaveRef = useRef(createDebouncedSave(500));
  
  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      if (isInitializedRef.current) return;
      
      try {
        const [savedDocs, session] = await Promise.all([
          loadAllDocuments(),
          loadSession(),
        ]);
        
        if (savedDocs.length > 0) {
          const savedTabOrder = session?.tabOrder ?? savedDocs.map(d => d.id);
          const savedActiveId = session?.activeDocumentId ?? savedDocs[0]?.id ?? null;
          
          // Filter tab order to only include existing documents
          const validTabOrder = savedTabOrder.filter(id => 
            savedDocs.some(d => d.id === id)
          );
          
          // Add any documents not in tab order
          for (const doc of savedDocs) {
            if (!validTabOrder.includes(doc.id)) {
              validTabOrder.push(doc.id);
            }
          }
          
          // Ensure active document exists
          const validActiveId = savedDocs.some(d => d.id === savedActiveId)
            ? savedActiveId
            : validTabOrder[0] ?? null;
          
          onRestore(savedDocs, validActiveId, validTabOrder);
          previousDocIdsRef.current = new Set(savedDocs.map(d => d.id));
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      } finally {
        isInitializedRef.current = true;
      }
    };
    
    restore();
  }, [onRestore]);
  
  // Save documents when they change
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    const currentDocIds = new Set(documents.keys());
    
    // Find deleted documents
    const deletedIds: string[] = [];
    for (const id of previousDocIdsRef.current) {
      if (!currentDocIds.has(id)) {
        deletedIds.push(id);
      }
    }
    
    // Delete removed documents
    if (deletedIds.length > 0) {
      Promise.all(deletedIds.map(id => deleteDocument(id))).catch(console.error);
    }
    
    previousDocIdsRef.current = currentDocIds;
    
    // Debounced save of all documents and session
    debouncedSaveRef.current(async () => {
      const docs = Array.from(documents.values());
      await Promise.all([
        saveDocuments(docs),
        saveSession({
          activeDocumentId,
          tabOrder,
          lastSaved: Date.now(),
        }),
      ]);
    });
  }, [documents, activeDocumentId, tabOrder]);
}

/**
 * Hook to get persistence status
 */
export function usePersistenceStatus() {
  const lastSavedRef = useRef<number | null>(null);
  
  const markSaved = useCallback(() => {
    lastSavedRef.current = Date.now();
  }, []);
  
  return {
    lastSaved: lastSavedRef.current,
    markSaved,
  };
}
