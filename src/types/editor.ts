/**
 * Cursor position in the editor
 */
export interface CursorPosition {
  line: number;
  column: number;
  offset: number;
}

/**
 * Text selection range
 */
export interface Selection {
  start: CursorPosition;
  end: CursorPosition;
}

/**
 * Scroll position
 */
export interface ScrollPosition {
  top: number;
  left: number;
}

/**
 * History entry for undo/redo
 */
export interface HistoryEntry {
  content: string;
  cursor: CursorPosition;
  selection: Selection | null;
  timestamp: number;
}

/**
 * Search state for find/replace
 */
export interface SearchState {
  query: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  replaceText: string;
  matchCount: number;
  currentMatch: number;
}

/**
 * Editor configuration
 */
export interface EditorConfig {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  useTabs: boolean;
  lineWrapping: boolean;
  lineNumbers: boolean;
  highlightActiveLine: boolean;
  matchBrackets: boolean;
  autoCloseBrackets: boolean;
  minimap: boolean;
}

/**
 * Default editor configuration
 */
export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  fontSize: 14,
  fontFamily: 'Geist Mono',
  tabSize: 2,
  useTabs: false,
  lineWrapping: false,
  lineNumbers: true,
  highlightActiveLine: true,
  matchBrackets: true,
  autoCloseBrackets: true,
  minimap: false,
};

/**
 * Formatting options
 */
export interface FormattingOptions {
  indent: number | 'tab';
  maxLineLength: number;
  inlineThreshold: number;
}

/**
 * Default formatting options
 */
export const DEFAULT_FORMATTING_OPTIONS: FormattingOptions = {
  indent: 2,
  maxLineLength: 80,
  inlineThreshold: 60,
};
