import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { loadGoogleFont } from '@/lib/fonts';

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
  },
};

// ============================================
// Actions
// ============================================

type SettingsAction =
  | { type: 'UPDATE_EDITOR'; payload: Partial<EditorSettings> }
  | { type: 'UPDATE_FORMATTING'; payload: Partial<FormattingSettings> }
  | { type: 'UPDATE_BEHAVIOR'; payload: Partial<BehaviorSettings> }
  | { type: 'UPDATE_UI'; payload: Partial<UISettings> }
  | { type: 'RESET_SETTINGS' }
  | { type: 'LOAD_SETTINGS'; payload: SettingsState };

// ============================================
// Reducer
// ============================================

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'UPDATE_EDITOR':
      return {
        ...state,
        editor: { ...state.editor, ...action.payload },
      };
    case 'UPDATE_FORMATTING':
      return {
        ...state,
        formatting: { ...state.formatting, ...action.payload },
      };
    case 'UPDATE_BEHAVIOR':
      return {
        ...state,
        behavior: { ...state.behavior, ...action.payload },
      };
    case 'UPDATE_UI':
      return {
        ...state,
        ui: { ...state.ui, ...action.payload },
      };
    case 'RESET_SETTINGS':
      return DEFAULT_SETTINGS;
    case 'LOAD_SETTINGS':
      return action.payload;
    default:
      return state;
  }
}

// ============================================
// Storage
// ============================================

const SETTINGS_KEY = 'mayson-settings';

function loadSettings(): SettingsState {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<SettingsState>;
      // Deep merge with defaults to handle missing keys
      return {
        editor: { ...DEFAULT_SETTINGS.editor, ...parsed.editor },
        formatting: { ...DEFAULT_SETTINGS.formatting, ...parsed.formatting },
        behavior: { ...DEFAULT_SETTINGS.behavior, ...parsed.behavior },
        ui: { ...DEFAULT_SETTINGS.ui, ...parsed.ui },
      };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: SettingsState): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

// ============================================
// Context
// ============================================

interface SettingsContextValue {
  settings: SettingsState;
  updateEditor: (updates: Partial<EditorSettings>) => void;
  updateFormatting: (updates: Partial<FormattingSettings>) => void;
  updateBehavior: (updates: Partial<BehaviorSettings>) => void;
  updateUI: (updates: Partial<UISettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, dispatch] = useReducer(settingsReducer, undefined, loadSettings);
  
  // Persist settings on change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  
  // Apply theme
  useEffect(() => {
    const { theme } = settings.ui;
    
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
      }
    };
    
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);
      
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme === 'dark');
      return undefined;
    }
  }, [settings.ui.theme]);
  
  // Apply editor font settings as CSS variables
  useEffect(() => {
    const { fontSize, fontFamily } = settings.editor;
    
    // Load the font if it's a Google Font
    loadGoogleFont(fontFamily).then(() => {
      document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
      document.documentElement.style.setProperty('--editor-font-family', `"${fontFamily}", monospace`);
    });
  }, [settings.editor.fontSize, settings.editor.fontFamily]);
  
  const updateEditor = useCallback((updates: Partial<EditorSettings>) => {
    dispatch({ type: 'UPDATE_EDITOR', payload: updates });
  }, []);
  
  const updateFormatting = useCallback((updates: Partial<FormattingSettings>) => {
    dispatch({ type: 'UPDATE_FORMATTING', payload: updates });
  }, []);
  
  const updateBehavior = useCallback((updates: Partial<BehaviorSettings>) => {
    dispatch({ type: 'UPDATE_BEHAVIOR', payload: updates });
  }, []);
  
  const updateUI = useCallback((updates: Partial<UISettings>) => {
    dispatch({ type: 'UPDATE_UI', payload: updates });
  }, []);
  
  const resetSettings = useCallback(() => {
    dispatch({ type: 'RESET_SETTINGS' });
  }, []);
  
  const value = useMemo(
    () => ({
      settings,
      updateEditor,
      updateFormatting,
      updateBehavior,
      updateUI,
      resetSettings,
    }),
    [settings, updateEditor, updateFormatting, updateBehavior, updateUI, resetSettings]
  );
  
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================
// Hooks
// ============================================

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

export function useEditorSettings() {
  const { settings } = useSettings();
  return settings.editor;
}

export function useFormattingSettings() {
  const { settings } = useSettings();
  return settings.formatting;
}

export function useBehaviorSettings() {
  const { settings } = useSettings();
  return settings.behavior;
}

export function useUISettings() {
  const { settings } = useSettings();
  return settings.ui;
}

export function useTheme() {
  const { settings, updateUI } = useSettings();
  
  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    updateUI({ theme });
  }, [updateUI]);
  
  const toggleTheme = useCallback(() => {
    const newTheme = settings.ui.theme === 'dark' ? 'light' : 'dark';
    updateUI({ theme: newTheme });
  }, [settings.ui.theme, updateUI]);
  
  return {
    theme: settings.ui.theme,
    setTheme,
    toggleTheme,
  };
}
