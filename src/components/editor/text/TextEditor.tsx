import { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { type Monaco, type OnMount, loader } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { parseJson, type ParseError } from '@/lib/json/parser';
import { findPathLine } from '@/lib/json/validator';
import { useCurrentDocument, useUpdateCurrentContent, useValidationErrors } from '@/store/useDocumentStore';
import { useSearch } from '@/store/useSearchStore';
import { useEditor } from '@/store/useEditorStore';
import { useEditorSettings, useUISettings } from '@/store/useSettingsStore';

// Custom dark theme matching our design system
const JSONARY_DARK_THEME: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: false,
  rules: [
    // General
    { token: '', foreground: 'FAFAFA', background: '0A0A0A' },
    { token: 'invalid', foreground: 'E06C75' },
    { token: 'emphasis', fontStyle: 'italic' },
    { token: 'strong', fontStyle: 'bold' },

    // JSON specific
    { token: 'string.key.json', foreground: '61AFEF' },
    { token: 'string.value.json', foreground: '98C379' },
    { token: 'number.json', foreground: 'D19A66' },
    { token: 'keyword.json', foreground: 'C678DD' }, // true, false, null
    { token: 'delimiter.bracket.json', foreground: 'ABB2BF' },
    { token: 'delimiter.array.json', foreground: 'ABB2BF' },
    { token: 'delimiter.colon.json', foreground: '5C6370' },
    { token: 'delimiter.comma.json', foreground: '5C6370' },

    // Comments (for JSONC)
    { token: 'comment', foreground: '5C6370', fontStyle: 'italic' },
    { token: 'comment.line', foreground: '5C6370', fontStyle: 'italic' },
    { token: 'comment.block', foreground: '5C6370', fontStyle: 'italic' },
  ],
  colors: {
    // Editor background and foreground
    'editor.background': '#0A0A0A',
    'editor.foreground': '#FAFAFA',

    // Line numbers
    'editorLineNumber.foreground': '#525252',
    'editorLineNumber.activeForeground': '#A1A1A1',

    // Cursor
    'editorCursor.foreground': '#3B82F6',
    'editorCursor.background': '#0A0A0A',

    // Selection
    'editor.selectionBackground': '#3B82F630',
    'editor.inactiveSelectionBackground': '#3B82F620',
    'editor.selectionHighlightBackground': '#3B82F620',

    // Current line
    'editor.lineHighlightBackground': '#1A1A1A',
    'editor.lineHighlightBorder': '#1A1A1A',

    // Indentation guides
    'editorIndentGuide.background': '#1F1F1F',
    'editorIndentGuide.activeBackground': '#3F3F3F',

    // Bracket matching
    'editorBracketMatch.background': '#3B82F630',
    'editorBracketMatch.border': '#3B82F6',

    // Bracket pair colorization
    'editorBracketHighlight.foreground1': '#61AFEF',
    'editorBracketHighlight.foreground2': '#C678DD',
    'editorBracketHighlight.foreground3': '#D19A66',
    'editorBracketHighlight.foreground4': '#98C379',
    'editorBracketHighlight.foreground5': '#E06C75',
    'editorBracketHighlight.foreground6': '#56B6C2',

    // Gutter
    'editorGutter.background': '#0F0F0F',
    'editorGutter.modifiedBackground': '#F59E0B',
    'editorGutter.addedBackground': '#22C55E',
    'editorGutter.deletedBackground': '#EF4444',

    // Folding
    'editor.foldBackground': '#1A1A1A80',

    // Find/Search
    'editor.findMatchBackground': '#F59E0B40',
    'editor.findMatchHighlightBackground': '#F59E0B25',
    'editor.findRangeHighlightBackground': '#3B82F615',

    // Hover widget
    'editorHoverWidget.background': '#171717',
    'editorHoverWidget.border': '#2E2E2E',
    'editorHoverWidget.foreground': '#FAFAFA',

    // Widget (find widget, etc.)
    'editorWidget.background': '#171717',
    'editorWidget.border': '#2E2E2E',
    'editorWidget.foreground': '#FAFAFA',

    // Input fields in widgets
    'input.background': '#0F0F0F',
    'input.border': '#2E2E2E',
    'input.foreground': '#FAFAFA',
    'input.placeholderForeground': '#525252',
    'inputOption.activeBackground': '#3B82F640',
    'inputOption.activeBorder': '#3B82F6',

    // Buttons
    'button.background': '#3B82F6',
    'button.foreground': '#FAFAFA',
    'button.hoverBackground': '#60A5FA',

    // Scrollbar
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#2E2E2E80',
    'scrollbarSlider.hoverBackground': '#3F3F3F',
    'scrollbarSlider.activeBackground': '#525252',

    // Error/Warning squiggles
    'editorError.foreground': '#EF4444',
    'editorWarning.foreground': '#F59E0B',
    'editorInfo.foreground': '#3B82F6',

    // Overview ruler (scrollbar annotations)
    'editorOverviewRuler.border': '#1F1F1F',
    'editorOverviewRuler.errorForeground': '#EF4444',
    'editorOverviewRuler.warningForeground': '#F59E0B',
    'editorOverviewRuler.infoForeground': '#3B82F6',

    // Minimap (disabled but just in case)
    'minimap.background': '#0F0F0F',

    // Dropdown
    'dropdown.background': '#171717',
    'dropdown.border': '#2E2E2E',
    'dropdown.foreground': '#FAFAFA',

    // List (autocomplete, etc.)
    'list.activeSelectionBackground': '#3B82F640',
    'list.activeSelectionForeground': '#FAFAFA',
    'list.hoverBackground': '#1A1A1A',
    'list.focusBackground': '#262626',
  },
};

// Custom light theme matching our design system
const JSONARY_LIGHT_THEME: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: false,
  rules: [
    // General
    { token: '', foreground: '09090B', background: 'FFFFFF' },
    { token: 'invalid', foreground: 'CF222E' },
    { token: 'emphasis', fontStyle: 'italic' },
    { token: 'strong', fontStyle: 'bold' },

    // JSON specific
    { token: 'string.key.json', foreground: '0550AE' },
    { token: 'string.value.json', foreground: '1A7F37' },
    { token: 'number.json', foreground: '953800' },
    { token: 'keyword.json', foreground: '8250DF' }, // true, false, null
    { token: 'delimiter.bracket.json', foreground: '24292F' },
    { token: 'delimiter.array.json', foreground: '24292F' },
    { token: 'delimiter.colon.json', foreground: '6E7781' },
    { token: 'delimiter.comma.json', foreground: '6E7781' },

    // Comments (for JSONC)
    { token: 'comment', foreground: '6E7781', fontStyle: 'italic' },
    { token: 'comment.line', foreground: '6E7781', fontStyle: 'italic' },
    { token: 'comment.block', foreground: '6E7781', fontStyle: 'italic' },
  ],
  colors: {
    // Editor background and foreground
    'editor.background': '#FFFFFF',
    'editor.foreground': '#09090B',

    // Line numbers
    'editorLineNumber.foreground': '#A1A1AA',
    'editorLineNumber.activeForeground': '#52525B',

    // Cursor
    'editorCursor.foreground': '#3B82F6',
    'editorCursor.background': '#FFFFFF',

    // Selection
    'editor.selectionBackground': '#3B82F630',
    'editor.inactiveSelectionBackground': '#3B82F620',
    'editor.selectionHighlightBackground': '#3B82F620',

    // Current line
    'editor.lineHighlightBackground': '#F4F4F5',
    'editor.lineHighlightBorder': '#F4F4F5',

    // Indentation guides
    'editorIndentGuide.background': '#E4E4E7',
    'editorIndentGuide.activeBackground': '#D4D4D8',

    // Bracket matching
    'editorBracketMatch.background': '#3B82F630',
    'editorBracketMatch.border': '#3B82F6',

    // Bracket pair colorization
    'editorBracketHighlight.foreground1': '#0550AE',
    'editorBracketHighlight.foreground2': '#8250DF',
    'editorBracketHighlight.foreground3': '#953800',
    'editorBracketHighlight.foreground4': '#1A7F37',
    'editorBracketHighlight.foreground5': '#CF222E',
    'editorBracketHighlight.foreground6': '#0969DA',

    // Gutter
    'editorGutter.background': '#FAFAFA',
    'editorGutter.modifiedBackground': '#F59E0B',
    'editorGutter.addedBackground': '#22C55E',
    'editorGutter.deletedBackground': '#EF4444',

    // Folding
    'editor.foldBackground': '#F4F4F580',

    // Find/Search
    'editor.findMatchBackground': '#F59E0B40',
    'editor.findMatchHighlightBackground': '#F59E0B25',
    'editor.findRangeHighlightBackground': '#3B82F615',

    // Hover widget
    'editorHoverWidget.background': '#FFFFFF',
    'editorHoverWidget.border': '#E4E4E7',
    'editorHoverWidget.foreground': '#09090B',

    // Widget (find widget, etc.)
    'editorWidget.background': '#FFFFFF',
    'editorWidget.border': '#E4E4E7',
    'editorWidget.foreground': '#09090B',

    // Input fields in widgets
    'input.background': '#FFFFFF',
    'input.border': '#E4E4E7',
    'input.foreground': '#09090B',
    'input.placeholderForeground': '#A1A1AA',
    'inputOption.activeBackground': '#3B82F640',
    'inputOption.activeBorder': '#3B82F6',

    // Buttons
    'button.background': '#3B82F6',
    'button.foreground': '#FFFFFF',
    'button.hoverBackground': '#60A5FA',

    // Scrollbar
    'scrollbar.shadow': '#00000010',
    'scrollbarSlider.background': '#E4E4E780',
    'scrollbarSlider.hoverBackground': '#D4D4D8',
    'scrollbarSlider.activeBackground': '#A1A1AA',

    // Error/Warning squiggles
    'editorError.foreground': '#EF4444',
    'editorWarning.foreground': '#F59E0B',
    'editorInfo.foreground': '#3B82F6',

    // Overview ruler (scrollbar annotations)
    'editorOverviewRuler.border': '#E4E4E7',
    'editorOverviewRuler.errorForeground': '#EF4444',
    'editorOverviewRuler.warningForeground': '#F59E0B',
    'editorOverviewRuler.infoForeground': '#3B82F6',

    // Minimap (disabled but just in case)
    'minimap.background': '#FAFAFA',

    // Dropdown
    'dropdown.background': '#FFFFFF',
    'dropdown.border': '#E4E4E7',
    'dropdown.foreground': '#09090B',

    // List (autocomplete, etc.)
    'list.activeSelectionBackground': '#3B82F640',
    'list.activeSelectionForeground': '#09090B',
    'list.hoverBackground': '#F4F4F5',
    'list.focusBackground': '#E4E4E7',
  },
};

// Flag to track if themes have been defined
let themesInitialized = false;

// Initialize themes before Monaco loads
loader.init().then((monaco) => {
  if (!themesInitialized) {
    monaco.editor.defineTheme('jsonary-dark', JSONARY_DARK_THEME);
    monaco.editor.defineTheme('jsonary-light', JSONARY_LIGHT_THEME);
    themesInitialized = true;
  }
});

export function TextEditor() {
  const doc = useCurrentDocument();
  const updateContent = useUpdateCurrentContent();
  const editorSettings = useEditorSettings();
  const uiSettings = useUISettings();
  const { state: editorState, clearEvent } = useEditor();
  const validationErrors = useValidationErrors();
  const { state: searchState, openSearch } = useSearch();

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  const content = doc?.content ?? '';
  const isTextMode = doc?.viewMode === 'text';

  // Parse JSON to detect errors
  const parseResult = parseJson(content);
  const jsonError: ParseError | null = parseResult.error;

  // Determine theme based on UI settings
  const getThemeName = useCallback(() => {
    if (uiSettings.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'jsonary-dark' : 'jsonary-light';
    }
    return uiSettings.theme === 'dark' ? 'jsonary-dark' : 'jsonary-light';
  }, [uiSettings.theme]);

  // Handle editor mount
  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsEditorReady(true);

    // Ensure themes are defined (in case loader.init didn't complete before mount)
    if (!themesInitialized) {
      monaco.editor.defineTheme('jsonary-dark', JSONARY_DARK_THEME);
      monaco.editor.defineTheme('jsonary-light', JSONARY_LIGHT_THEME);
      themesInitialized = true;
    }

    // Configure JSON language defaults
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: false,
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      openSearch(false);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      openSearch(true);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      editor.getAction('editor.action.gotoLine')?.run();
    });

    // Focus the editor
    editor.focus();
  }, [openSearch]);

  // Handle content changes
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      updateContent(value);
    }
  }, [updateContent]);

  // Update markers for validation errors
  useEffect(() => {
    if (!isEditorReady || !monacoRef.current || !editorRef.current) return;

    const monaco = monacoRef.current;
    const model = editorRef.current.getModel();
    if (!model) return;

    const markers: editor.IMarkerData[] = [];

    // Add parse error marker
    if (jsonError) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: jsonError.message,
        startLineNumber: jsonError.line,
        startColumn: jsonError.column,
        endLineNumber: jsonError.line,
        endColumn: jsonError.column + 1,
      });
    }

    // Add validation error markers
    for (const error of validationErrors) {
      const lineNum = findPathLine(content, error.path);
      if (lineNum !== null) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: `${error.message}\nPath: ${error.path || '/'}`,
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: model.getLineMaxColumn(lineNum),
        });
      }
    }

    monaco.editor.setModelMarkers(model, 'json-validation', markers);
  }, [isEditorReady, jsonError, validationErrors, content]);

  // Handle editor events (goToLine, goToError, focusEditor)
  useEffect(() => {
    if (!editorState.pendingEvent || !editorRef.current) return;
    const event = editorState.pendingEvent;
    const editor = editorRef.current;

    if (event.type === 'goToError' && jsonError) {
      editor.revealLineInCenter(jsonError.line);
      editor.setPosition({ lineNumber: jsonError.line, column: jsonError.column });
      editor.focus();
      clearEvent();
    } else if (event.type === 'goToLine' && event.payload) {
      const { line, column = 1 } = event.payload;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column });
      editor.focus();
      clearEvent();
    } else if (event.type === 'focusEditor') {
      editor.focus();
      clearEvent();
    }
  }, [editorState.pendingEvent, jsonError, clearEvent]);

  // Handle search state - use Monaco's built-in find widget
  // Only respond to search when in text mode
  useEffect(() => {
    if (!editorRef.current || !isTextMode) return;
    const editor = editorRef.current;

    if (searchState.isOpen) {
      // Trigger Monaco's find action
      const action = searchState.showReplace
        ? editor.getAction('editor.action.startFindReplaceAction')
        : editor.getAction('editor.action.startFindReplaceAction');
      action?.run();
    } else {
      // Close find widget
      editor.trigger('keyboard', 'closeFindWidget', null);
    }
  }, [searchState.isOpen, searchState.showReplace, isTextMode]);

  // Close search when switching away from text mode
  useEffect(() => {
    if (!isTextMode && searchState.isOpen && editorRef.current) {
      // Close Monaco's find widget
      editorRef.current.trigger('keyboard', 'closeFindWidget', null);
    }
  }, [isTextMode, searchState.isOpen]);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language="json"
        value={content}
        theme={getThemeName()}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          fontSize: editorSettings.fontSize,
          fontFamily: `"${editorSettings.fontFamily}", monospace`,
          tabSize: editorSettings.tabSize,
          insertSpaces: !editorSettings.useTabs,
          wordWrap: editorSettings.lineWrapping ? 'on' : 'off',
          lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
          renderLineHighlight: editorSettings.highlightActiveLine ? 'all' : 'none',
          matchBrackets: editorSettings.matchBrackets ? 'always' : 'never',
          autoClosingBrackets: editorSettings.autoCloseBrackets ? 'always' : 'never',
          autoClosingQuotes: editorSettings.autoCloseBrackets ? 'always' : 'never',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          padding: { top: 8, bottom: 8 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderWhitespace: 'none',
          contextmenu: true,
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnEnter: 'off',
          tabCompletion: 'off',
          wordBasedSuggestions: 'off',
          parameterHints: { enabled: false },
          hover: { enabled: true },
          links: true,
          colorDecorators: true,
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            useShadows: false,
          },
        }}
        loading={
          <div className="flex items-center justify-center h-full text-text-muted">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
