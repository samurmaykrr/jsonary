import {
  useReducer,
  useMemo,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { loadGoogleFont } from '@/lib/fonts';
import {
  SettingsContext,
  DEFAULT_SETTINGS,
  type SettingsState,
  type EditorSettings,
  type FormattingSettings,
  type BehaviorSettings,
  type UISettings,
} from './settingsContext';

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
  
  // Apply theme - include settings.ui as dependency
  const uiSettings = settings.ui;
  useEffect(() => {
    const { theme, uiScale } = uiSettings;
    
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
      }
    };
    
    // Apply UI scale
    document.documentElement.style.setProperty('--ui-scale', String(uiScale));
    
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
  }, [uiSettings]);
  
  // Apply editor font settings as CSS variables - include settings.editor as dependency
  const editorSettings = settings.editor;
  useEffect(() => {
    const { fontSize, fontFamily } = editorSettings;
    
    // Load the font if it's a Google Font
    loadGoogleFont(fontFamily).then(() => {
      document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
      document.documentElement.style.setProperty('--editor-font-family', `"${fontFamily}", monospace`);
    });
  }, [editorSettings]);
  
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
