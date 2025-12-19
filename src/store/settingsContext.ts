import { createContext } from 'react';

// ============================================
// Settings Types
// ============================================

export interface EditorSettings {
  fontSize: number;
  fontFamily: string; // Font family name (e.g., 'Geist Mono', 'JetBrains Mono', etc.)
  tabSize: number;
  useTabs: boolean;
  lineWrapping: boolean;
  lineNumbers: boolean;
  highlightActiveLine: boolean;
  matchBrackets: boolean;
  autoCloseBrackets: boolean;
}

export interface FormattingSettings {
  defaultIndent: number;
  smartFormatMaxLineLength: number;
  smartFormatInlineThreshold: number;
}

export interface BehaviorSettings {
  autoSaveInterval: number; // ms, 0 = disabled
  confirmBeforeClose: boolean;
  restoreSession: boolean;
}

export interface UISettings {
  theme: 'light' | 'dark' | 'system';
  defaultViewMode: 'text' | 'tree' | 'table';
  uiScale: number; // UI scale factor (0.8 to 1.2)
}

export interface SettingsState {
  editor: EditorSettings;
  formatting: FormattingSettings;
  behavior: BehaviorSettings;
  ui: UISettings;
}

// ============================================
// Default Settings
// ============================================

export const DEFAULT_SETTINGS: SettingsState = {
  editor: {
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
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
    smartFormatInlineThreshold: 4,
  },
  behavior: {
    autoSaveInterval: 500,
    confirmBeforeClose: true,
    restoreSession: true,
  },
  ui: {
    theme: 'dark',
    defaultViewMode: 'text',
    uiScale: 1,
  },
};

// ============================================
// Context
// ============================================

export interface SettingsContextValue {
  settings: SettingsState;
  updateEditor: (updates: Partial<EditorSettings>) => void;
  updateFormatting: (updates: Partial<FormattingSettings>) => void;
  updateBehavior: (updates: Partial<BehaviorSettings>) => void;
  updateUI: (updates: Partial<UISettings>) => void;
  resetSettings: () => void;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);
