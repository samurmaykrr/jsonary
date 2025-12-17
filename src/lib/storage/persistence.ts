import { get, set, del, keys } from 'idb-keyval';
import type { Document } from '@/types';

// Storage keys
const DOCUMENTS_PREFIX = 'doc:';
const SESSION_KEY = 'session';

interface SessionData {
  activeDocumentId: string | null;
  tabOrder: string[];
  lastSaved: number;
}

/**
 * Save a single document to IndexedDB
 */
export async function saveDocument(doc: Document): Promise<void> {
  await set(`${DOCUMENTS_PREFIX}${doc.id}`, doc);
}

/**
 * Save multiple documents to IndexedDB
 */
export async function saveDocuments(docs: Document[]): Promise<void> {
  await Promise.all(docs.map(doc => saveDocument(doc)));
}

/**
 * Load a single document from IndexedDB
 */
export async function loadDocument(id: string): Promise<Document | undefined> {
  return get<Document>(`${DOCUMENTS_PREFIX}${id}`);
}

/**
 * Delete a document from IndexedDB
 */
export async function deleteDocument(id: string): Promise<void> {
  await del(`${DOCUMENTS_PREFIX}${id}`);
}

/**
 * Load all documents from IndexedDB
 */
export async function loadAllDocuments(): Promise<Document[]> {
  const allKeys = await keys();
  const docKeys = allKeys.filter(
    (key): key is string => typeof key === 'string' && key.startsWith(DOCUMENTS_PREFIX)
  );
  
  const docs = await Promise.all(
    docKeys.map(async key => {
      const doc = await get<Document>(key);
      return doc;
    })
  );
  
  return docs.filter((doc): doc is Document => doc !== undefined);
}

/**
 * Save session data (active tab, tab order)
 */
export async function saveSession(data: SessionData): Promise<void> {
  await set(SESSION_KEY, data);
}

/**
 * Load session data
 */
export async function loadSession(): Promise<SessionData | undefined> {
  return get<SessionData>(SESSION_KEY);
}

/**
 * Clear all stored data
 */
export async function clearAllData(): Promise<void> {
  const allKeys = await keys();
  await Promise.all(allKeys.map(key => del(key)));
}

/**
 * Debounced save function factory
 */
export function createDebouncedSave(delay: number = 1000) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (saveFn: () => Promise<void>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(async () => {
      try {
        await saveFn();
      } catch (error) {
        console.error('Failed to save:', error);
      }
    }, delay);
  };
}
