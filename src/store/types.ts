import type { Document, ViewMode, JsonSchema, SchemaSource } from '@/types';

/**
 * Document store state
 */
export interface DocumentState {
  documents: Map<string, Document>;
  activeDocumentId: string | null;
  tabOrder: string[];
}

/**
 * Initial document state
 */
export const initialDocumentState: DocumentState = {
  documents: new Map(),
  activeDocumentId: null,
  tabOrder: [],
};

/**
 * Document store actions
 */
export type DocumentAction =
  | { type: 'CREATE_DOCUMENT'; payload: { id: string; name: string; content?: string } }
  | { type: 'CLOSE_DOCUMENT'; payload: { id: string } }
  | { type: 'SET_ACTIVE'; payload: { id: string } }
  | { type: 'UPDATE_CONTENT'; payload: { id: string; content: string } }
  | { type: 'SET_VIEW_MODE'; payload: { id: string; mode: ViewMode } }
  | { type: 'RENAME_DOCUMENT'; payload: { id: string; name: string } }
  | { type: 'REORDER_TABS'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'MARK_SAVED'; payload: { id: string } }
  | { type: 'SET_PARSE_ERROR'; payload: { id: string; error: Document['parseError'] } }
  | { type: 'SET_VALIDATION_ERRORS'; payload: { id: string; errors: Document['validationErrors'] } }
  | { type: 'SET_SCHEMA'; payload: { id: string; schema: JsonSchema | null; source: SchemaSource | null } }
  | { type: 'RESTORE_SESSION'; payload: { documents: Document[]; activeId: string | null; tabOrder: string[] } };

/**
 * UI store state
 */
export interface UIState {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  panelLayout: 'single' | 'split';
  splitRatio: number;
  sidebarOpen: boolean;
  sidebarTab: 'files' | 'search' | 'schema';
}

/**
 * Initial UI state
 */
export const initialUIState: UIState = {
  theme: 'system',
  resolvedTheme: 'dark',
  panelLayout: 'single',
  splitRatio: 0.5,
  sidebarOpen: false,
  sidebarTab: 'files',
};

/**
 * UI store actions
 */
export type UIAction =
  | { type: 'SET_THEME'; payload: UIState['theme'] }
  | { type: 'SET_RESOLVED_THEME'; payload: UIState['resolvedTheme'] }
  | { type: 'SET_PANEL_LAYOUT'; payload: UIState['panelLayout'] }
  | { type: 'SET_SPLIT_RATIO'; payload: number }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_TAB'; payload: UIState['sidebarTab'] };

/**
 * Settings state (persisted to localStorage)
 */
export interface SettingsState {
  editor: {
    fontSize: number;
    fontFamily: string;
    tabSize: number;
    useTabs: boolean;
    lineWrapping: boolean;
    lineNumbers: boolean;
    highlightActiveLine: boolean;
    matchBrackets: boolean;
    autoCloseBrackets: boolean;
  };
  formatting: {
    defaultIndent: number;
    smartFormatMaxLineLength: number;
    smartFormatInlineThreshold: number;
  };
  behavior: {
    autoSaveInterval: number;
    confirmBeforeClose: boolean;
    restoreSession: boolean;
  };
}

/**
 * Initial settings state
 */
export const initialSettingsState: SettingsState = {
  editor: {
    fontSize: 14,
    fontFamily: 'Geist Mono',
    tabSize: 2,
    useTabs: false,
    lineWrapping: false,
    lineNumbers: true,
    highlightActiveLine: true,
    matchBrackets: true,
    autoCloseBrackets: true,
  },
  formatting: {
    defaultIndent: 2,
    smartFormatMaxLineLength: 80,
    smartFormatInlineThreshold: 60,
  },
  behavior: {
    autoSaveInterval: 5000,
    confirmBeforeClose: true,
    restoreSession: true,
  },
};

/**
 * Settings actions
 */
export type SettingsAction =
  | { type: 'UPDATE_EDITOR_SETTINGS'; payload: Partial<SettingsState['editor']> }
  | { type: 'UPDATE_FORMATTING_SETTINGS'; payload: Partial<SettingsState['formatting']> }
  | { type: 'UPDATE_BEHAVIOR_SETTINGS'; payload: Partial<SettingsState['behavior']> }
  | { type: 'RESET_SETTINGS' };
