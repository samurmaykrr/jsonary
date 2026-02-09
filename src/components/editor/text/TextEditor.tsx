import { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { type Monaco, type OnMount, loader } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { parseJson, type ParseError, hasTemplateSyntax } from '@/lib/json';
import { findPathLine } from '@/lib/json/validator';
import { useCurrentDocument, useUpdateCurrentContent, useValidationErrors } from '@/store/useDocumentStore';
import { useSearch } from '@/store/useSearchStore';
import { useEditor } from '@/store/useEditorStore';
import { useEditorSettings, useUISettings } from '@/store/useSettingsStore';

// Custom dark theme matching Cyberpunk Scarlet Protocol
const JSONARY_DARK_THEME: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: false,
  rules: [
    // General
    { token: '', foreground: 'c7c7c7', background: '101116' },
    { token: 'invalid', foreground: 'ea3355' },
    { token: 'emphasis', fontStyle: 'italic' },
    { token: 'strong', fontStyle: 'bold' },

    // JSON specific
    { token: 'string.key.json', foreground: 'ed776d' },
    { token: 'string.value.json', foreground: '8df77a' },
    { token: 'number.json', foreground: 'ae40e4' },
    { token: 'keyword.json', foreground: 'ba3ec1' }, // true, false, null
    { token: 'delimiter.bracket.json', foreground: '8a8a98' },
    { token: 'delimiter.array.json', foreground: '8a8a98' },
    { token: 'delimiter.colon.json', foreground: '8a8a98' },
    { token: 'delimiter.comma.json', foreground: '8a8a98' },

    // Comments (for JSONC)
    { token: 'comment', foreground: '686868', fontStyle: 'italic' },
    { token: 'comment.line', foreground: '686868', fontStyle: 'italic' },
    { token: 'comment.block', foreground: '686868', fontStyle: 'italic' },
  ],
  colors: {
    // Editor background and foreground
    'editor.background': '#101116',
    'editor.foreground': '#c7c7c7',

    // Line numbers
    'editorLineNumber.foreground': '#505060',
    'editorLineNumber.activeForeground': '#ea3355',

    // Cursor
    'editorCursor.foreground': '#ea3355',
    'editorCursor.background': '#101116',

    // Selection
    'editor.selectionBackground': '#ea335530',
    'editor.inactiveSelectionBackground': '#ea335520',
    'editor.selectionHighlightBackground': '#ea335520',

    // Current line
    'editor.lineHighlightBackground': '#1a1a24bf',
    'editor.lineHighlightBorder': '#1a1a24bf',

    // Indentation guides
    'editorIndentGuide.background': '#2a2a35',
    'editorIndentGuide.activeBackground': '#3a3a45',

    // Bracket matching
    'editorBracketMatch.background': '#ea335530',
    'editorBracketMatch.border': '#ea3355',

    // Bracket pair colorization
    'editorBracketHighlight.foreground1': '#ed776d',
    'editorBracketHighlight.foreground2': '#ba3ec1',
    'editorBracketHighlight.foreground3': '#ae40e4',
    'editorBracketHighlight.foreground4': '#59c2c6',
    'editorBracketHighlight.foreground5': '#6a71f6',
    'editorBracketHighlight.foreground6': '#faf968',

    // Gutter
    'editorGutter.background': '#0c0c10',
    'editorGutter.modifiedBackground': '#faf968',
    'editorGutter.addedBackground': '#64d98c',
    'editorGutter.deletedBackground': '#ea3355',

    // Folding
    'editor.foldBackground': '#1a1a2480',

    // Find/Search
    'editor.findMatchBackground': '#faf96840',
    'editor.findMatchHighlightBackground': '#faf96825',
    'editor.findRangeHighlightBackground': '#ea335515',

    // Hover widget
    'editorHoverWidget.background': '#2a2a35',
    'editorHoverWidget.border': '#2a2a35',
    'editorHoverWidget.foreground': '#c7c7c7',

    // Widget (find widget, etc.)
    'editorWidget.background': '#2a2a35',
    'editorWidget.border': '#2a2a35',
    'editorWidget.foreground': '#c7c7c7',

    // Input fields in widgets
    'input.background': '#161620',
    'input.border': '#2a2a35',
    'input.foreground': '#c7c7c7',
    'input.placeholderForeground': '#606070',
    'inputOption.activeBackground': '#ea335540',
    'inputOption.activeBorder': '#ea3355',

    // Buttons
    'button.background': '#ea3355',
    'button.foreground': '#ffffff',
    'button.hoverBackground': '#ea3355ee',

    // Scrollbar
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#ea33554c',
    'scrollbarSlider.hoverBackground': '#ea335580',
    'scrollbarSlider.activeBackground': '#ea3355',

    // Error/Warning squiggles
    'editorError.foreground': '#ea3355',
    'editorWarning.foreground': '#faf968',
    'editorInfo.foreground': '#6a71f6',

    // Overview ruler (scrollbar annotations)
    'editorOverviewRuler.border': '#2a2a35',
    'editorOverviewRuler.errorForeground': '#ea3355',
    'editorOverviewRuler.warningForeground': '#faf968',
    'editorOverviewRuler.infoForeground': '#6a71f6',

    // Minimap (disabled but just in case)
    'minimap.background': '#0c0c10',

    // Dropdown
    'dropdown.background': '#2a2a35',
    'dropdown.border': '#2a2a35',
    'dropdown.foreground': '#c7c7c7',

    // List (autocomplete, etc.)
    'list.activeSelectionBackground': '#ea335540',
    'list.activeSelectionForeground': '#c7c7c7',
    'list.hoverBackground': '#1e1e26',
    'list.focusBackground': '#1e1e2a',
  },
};

// Custom light theme matching Cyberpunk Scarlet Protocol Light
const JSONARY_LIGHT_THEME: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: false,
  rules: [
    // General
    { token: '', foreground: '303038', background: 'f8f8fa' },
    { token: 'invalid', foreground: 'c41035' },
    { token: 'emphasis', fontStyle: 'italic' },
    { token: 'strong', fontStyle: 'bold' },

    // JSON specific
    { token: 'string.key.json', foreground: 'e85070' },
    { token: 'string.value.json', foreground: '40b060' },
    { token: 'number.json', foreground: 'b040c0' },
    { token: 'keyword.json', foreground: '9020a0' }, // true, false, null
    { token: 'delimiter.bracket.json', foreground: '606068' },
    { token: 'delimiter.array.json', foreground: '606068' },
    { token: 'delimiter.colon.json', foreground: '606068' },
    { token: 'delimiter.comma.json', foreground: '606068' },

    // Comments (for JSONC)
    { token: 'comment', foreground: '909098', fontStyle: 'italic' },
    { token: 'comment.line', foreground: '909098', fontStyle: 'italic' },
    { token: 'comment.block', foreground: '909098', fontStyle: 'italic' },
  ],
  colors: {
    // Editor background and foreground
    'editor.background': '#f8f8fa',
    'editor.foreground': '#303038',

    // Line numbers
    'editorLineNumber.foreground': '#a0a0a8',
    'editorLineNumber.activeForeground': '#c41035',

    // Cursor
    'editorCursor.foreground': '#c41035',
    'editorCursor.background': '#f8f8fa',

    // Selection
    'editor.selectionBackground': '#c4103530',
    'editor.inactiveSelectionBackground': '#c4103520',
    'editor.selectionHighlightBackground': '#c4103520',

    // Current line
    'editor.lineHighlightBackground': '#e8e8eebf',
    'editor.lineHighlightBorder': '#e8e8eebf',

    // Indentation guides
    'editorIndentGuide.background': '#d0d0d8',
    'editorIndentGuide.activeBackground': '#b0b0b8',

    // Bracket matching
    'editorBracketMatch.background': '#c4103530',
    'editorBracketMatch.border': '#c41035',

    // Bracket pair colorization
    'editorBracketHighlight.foreground1': '#e85070',
    'editorBracketHighlight.foreground2': '#9020a0',
    'editorBracketHighlight.foreground3': '#b040c0',
    'editorBracketHighlight.foreground4': '#208888',
    'editorBracketHighlight.foreground5': '#4060d0',
    'editorBracketHighlight.foreground6': '#a08800',

    // Gutter
    'editorGutter.background': '#f0f0f4',
    'editorGutter.modifiedBackground': '#a08800',
    'editorGutter.addedBackground': '#2a9050',
    'editorGutter.deletedBackground': '#c41035',

    // Folding
    'editor.foldBackground': '#e8e8ee80',

    // Find/Search
    'editor.findMatchBackground': '#a0880040',
    'editor.findMatchHighlightBackground': '#a0880025',
    'editor.findRangeHighlightBackground': '#c4103515',

    // Hover widget
    'editorHoverWidget.background': '#ffffff',
    'editorHoverWidget.border': '#d0d0d8',
    'editorHoverWidget.foreground': '#303038',

    // Widget (find widget, etc.)
    'editorWidget.background': '#ffffff',
    'editorWidget.border': '#d0d0d8',
    'editorWidget.foreground': '#303038',

    // Input fields in widgets
    'input.background': '#f0f0f4',
    'input.border': '#d0d0d8',
    'input.foreground': '#303038',
    'input.placeholderForeground': '#909098',
    'inputOption.activeBackground': '#c4103540',
    'inputOption.activeBorder': '#c41035',

    // Buttons
    'button.background': '#c41035',
    'button.foreground': '#ffffff',
    'button.hoverBackground': '#c41035ee',

    // Scrollbar
    'scrollbar.shadow': '#00000010',
    'scrollbarSlider.background': '#c410354c',
    'scrollbarSlider.hoverBackground': '#c4103580',
    'scrollbarSlider.activeBackground': '#c41035',

    // Error/Warning squiggles
    'editorError.foreground': '#c41035',
    'editorWarning.foreground': '#a08800',
    'editorInfo.foreground': '#4060d0',

    // Overview ruler (scrollbar annotations)
    'editorOverviewRuler.border': '#d0d0d8',
    'editorOverviewRuler.errorForeground': '#c41035',
    'editorOverviewRuler.warningForeground': '#a08800',
    'editorOverviewRuler.infoForeground': '#4060d0',

    // Minimap (disabled but just in case)
    'minimap.background': '#f0f0f4',

    // Dropdown
    'dropdown.background': '#ffffff',
    'dropdown.border': '#d0d0d8',
    'dropdown.foreground': '#303038',

    // List (autocomplete, etc.)
    'list.activeSelectionBackground': '#c4103540',
    'list.activeSelectionForeground': '#303038',
    'list.hoverBackground': '#e4e4ea',
    'list.focusBackground': '#e0e0e6',
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
  const { state: searchState, openSearch, closeSearch } = useSearch();

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

    /**
     * Sync search state when Escape closes Monaco's find widget.
     * 
     * We use addAction with a precondition so our handler runs ALONGSIDE
     * Monaco's default Escape behavior (which closes the find widget).
     * editor.addCommand would completely replace the keybinding, preventing
     * Monaco from closing its own widget and causing state desync.
     */
    editor.addAction({
      id: 'jsonary.closeFindWidget',
      label: 'Close Find Widget',
      keybindings: [monaco.KeyCode.Escape],
      // Only fire when the find widget is visible
      precondition: 'findWidgetVisible',
      run: () => {
        closeSearch();
      },
    });

    // Focus the editor
    editor.focus();
  }, [openSearch, closeSearch]);

  // Handle content changes
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      updateContent(value);
    }
  }, [updateContent]);

  // Dynamically disable Monaco's JSON validation when templates are detected
  useEffect(() => {
    if (!monacoRef.current) return;
    
    const monaco = monacoRef.current;
    const hasTemplates = hasTemplateSyntax(content);
    
    // Disable validation for content with templates, enable for regular JSON
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: !hasTemplates,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: false,
    });
  }, [content]);

  // Update markers for validation errors
  useEffect(() => {
    if (!isEditorReady || !monacoRef.current || !editorRef.current) return;

    const monaco = monacoRef.current;
    const model = editorRef.current.getModel();
    if (!model) return;

    const markers: editor.IMarkerData[] = [];
    
    // Check if content has template syntax
    const hasTemplates = hasTemplateSyntax(content);

    // Add parse error marker only if there's no template syntax
    // (templates will be handled by auto-repair on format)
    if (jsonError && !hasTemplates) {
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
      // Open the appropriate find variant based on showReplace flag
      const actionId = searchState.showReplace
        ? 'editor.action.startFindReplaceAction'
        : 'actions.find';

      const action = editor.getAction(actionId);
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

  /**
   * Event-driven sync between Monaco's find widget visibility and our search state.
   * 
   * Instead of polling every 200ms, we listen to the find controller's
   * state change event for instant, reliable synchronization. This handles:
   * - User clicking X button on find widget
   * - Find widget closing programmatically
   * - Any close scenario not covered by our Escape action
   */
  useEffect(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const findController = editor.getContribution?.('editor.contrib.findController') as unknown as {
      getState: () => {
        isRevealed: boolean;
        onFindReplaceStateChange: (listener: (e: unknown) => void) => { dispose: () => void };
      };
    } | undefined;

    if (!findController) return;

    const findState = findController.getState?.();
    if (!findState?.onFindReplaceStateChange) {
      // Fallback to polling if the event API is unavailable
      const interval = setInterval(() => {
        const isRevealed = findController.getState?.().isRevealed ?? false;
        if (!isRevealed && searchState.isOpen) {
          closeSearch();
        }
      }, 200);
      return () => clearInterval(interval);
    }

    const disposable = findState.onFindReplaceStateChange(() => {
      const isRevealed = findController.getState?.().isRevealed ?? false;
      if (!isRevealed && searchState.isOpen) {
        closeSearch();
      }
    });

    return () => disposable.dispose();
  }, [searchState.isOpen, closeSearch]);

  return (
    <div className="h-full w-full overflow-hidden">
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
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'always',
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
