import { useCallback, useState } from 'react';
import { DocumentProvider, DocumentOverrideProvider } from '@/store/documentStore';
import { SearchProvider } from '@/store/searchStore';
import { EditorProvider } from '@/store/editorStore';
import { SettingsProvider } from '@/store/settingsStore';
import { ToastProvider } from '@/store/toastStore';
import {
  useDocument,
  useActiveDocument,
  useActiveDocumentId,
  useDocumentActions,
  useUpdateActiveContent,
  useUndoRedo,
  useTabs,
} from '@/store/useDocumentStore';
import { useSearch } from '@/store/useSearchStore';
import { useEditor, usePanelLayout } from '@/store/useEditorStore';
import { useTheme } from '@/store/useSettingsStore';
import { Header } from '@/components/layout/Header';
import { TabBar } from '@/components/layout/TabBar';
import { StatusBar } from '@/components/layout/StatusBar';
import { PanelSplitter } from '@/components/layout/PanelSplitter';
import { TextEditor } from '@/components/editor/text/TextEditor';
import { TreeEditor } from '@/components/editor/tree/TreeEditor';
import { TableEditor } from '@/components/editor/table/TableEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { SettingsModal, ToastContainer, CursorProgressProvider } from '@/components/ui';
import { GoToLineModal } from '@/components/ui/GoToLineModal';
import { CommandPalette, type Command } from '@/components/ui/CommandPalette';
import { commandIcons } from '@/components/ui/CommandIcons';
import { useEditorShortcuts, useKeyboardShortcuts } from '@/hooks';
import { useFormatterWorker } from '@/hooks/useWorker';
import { formatJson, compactJson } from '@/lib/json';
import { openFile, saveFile } from '@/lib/file';
import { useCursorProgress } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Document } from '@/types';

// Render editor based on view mode
// Keep all editors mounted but hidden for instant switching
function EditorView({ doc }: { doc: Document }) {
  const viewMode = doc.viewMode;
  
  return (
    <div className="h-full relative">
      {/* Text Editor - always mounted */}
      <div 
        className={cn(
          "absolute inset-0",
          viewMode !== 'text' && "invisible pointer-events-none"
        )}
        aria-hidden={viewMode !== 'text'}
      >
        <TextEditor />
      </div>
      
      {/* Tree Editor - mount on first use, then keep mounted */}
      <div 
        className={cn(
          "absolute inset-0",
          viewMode !== 'tree' && "invisible pointer-events-none"
        )}
        aria-hidden={viewMode !== 'tree'}
      >
        {/* Only render tree if it's been viewed at least once or currently active */}
        <TreeEditorLazy isActive={viewMode === 'tree'} />
      </div>
      
      {/* Table Editor - mount on first use, then keep mounted */}
      <div 
        className={cn(
          "absolute inset-0",
          viewMode !== 'table' && "invisible pointer-events-none"
        )}
        aria-hidden={viewMode !== 'table'}
      >
        <TableEditorLazy isActive={viewMode === 'table'} />
      </div>
    </div>
  );
}

// Lazy wrapper that mounts component on first activation and keeps it mounted
// Using adjust-state-during-render pattern instead of useEffect
function TreeEditorLazy({ isActive }: { isActive: boolean }) {
  const [hasBeenActive, setHasBeenActive] = useState(false);
  
  // Adjust state during render - more efficient than useEffect
  if (isActive && !hasBeenActive) {
    setHasBeenActive(true);
  }
  
  if (!hasBeenActive) return null;
  return <TreeEditor />;
}

function TableEditorLazy({ isActive }: { isActive: boolean }) {
  const [hasBeenActive, setHasBeenActive] = useState(false);
  
  // Adjust state during render - more efficient than useEffect
  if (isActive && !hasBeenActive) {
    setHasBeenActive(true);
  }
  
  if (!hasBeenActive) return null;
  return <TableEditor />;
}

function EditorArea() {
  const doc = useActiveDocument();
  
  if (!doc) {
    return (
      <div className="h-full flex items-center justify-center text-text-tertiary">
        No document open
      </div>
    );
  }
  
  return <EditorView doc={doc} />;
}

// Right panel editor that shows a specific document
function RightPanelEditor({ docId }: { docId: string }) {
  const doc = useDocument(docId);
  
  if (!doc) {
    return (
      <div className="h-full flex items-center justify-center text-text-tertiary">
        Select a document for comparison
      </div>
    );
  }
  
  return (
    <DocumentOverrideProvider docId={docId}>
      <EditorView doc={doc} />
    </DocumentOverrideProvider>
  );
}

// Split view container
function SplitEditorArea() {
  const { panelLayout, splitRatio, setSplitRatio, rightPanelDocId, activePanel, setActivePanel } = usePanelLayout();
  
  if (panelLayout === 'single') {
    return <EditorArea />;
  }
  
  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Panel */}
      <div 
        className={cn(
          'h-full flex flex-col overflow-hidden',
          activePanel === 'left' && 'ring-1 ring-accent ring-inset'
        )}
        style={{ width: `${splitRatio * 100}%` }}
        onMouseDown={(e) => {
          // Only set active panel if clicking directly on editor area, not on splitter
          if (e.currentTarget === e.target || e.currentTarget.contains(e.target as Node)) {
            setActivePanel('left');
          }
        }}
      >
        <EditorArea />
      </div>
      
      {/* Splitter */}
      <PanelSplitter onResize={setSplitRatio} />
      
      {/* Right Panel */}
      <div 
        className={cn(
          'h-full flex flex-col overflow-hidden',
          activePanel === 'right' && 'ring-1 ring-accent ring-inset'
        )}
        style={{ width: `${(1 - splitRatio) * 100}%` }}
        onMouseDown={(e) => {
          // Only set active panel if clicking directly on editor area, not on splitter
          if (e.currentTarget === e.target || e.currentTarget.contains(e.target as Node)) {
            setActivePanel('right');
          }
        }}
      >
        {rightPanelDocId ? (
          <RightPanelEditor docId={rightPanelDocId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-tertiary">
            <div className="text-center">
              <p>No document selected</p>
              <p className="text-sm mt-1">Use Compare to select a document</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KeyboardShortcutsHandler({ onOpenSettings, onOpenGoToLine }: { onOpenSettings: () => void; onOpenGoToLine: () => void }) {
  const activeDocId = useActiveDocumentId();
  const doc = useActiveDocument();
  const tabs = useTabs();
  const { createDocument, closeDocument, renameDocument, markSaved, setViewMode, setActive } = useDocumentActions();
  const updateContent = useUpdateActiveContent();
  const { undo, redo } = useUndoRedo();
  const { openSearch, closeSearch } = useSearch();
  const { toggleTheme } = useTheme();
  const { goToError } = useEditor();
  // Worker for background processing (use for large documents)
  const WORKER_THRESHOLD = 10000; // 10KB
  const { format: formatAsync, compact: compactAsync, isReady: isWorkerReady } = useFormatterWorker(true);
  // Cursor progress indicator
  const { show: showProgress, hide: hideProgress } = useCursorProgress();
  
  const handleSave = useCallback(async () => {
    if (!doc) return;

    // For large documents use the formatter worker to pretty-print before saving
    if (isWorkerReady && doc.content.length > WORKER_THRESHOLD) {
      showProgress('Formatting JSON...');
      let formatted: string | null = null;
      try {
        const { output, error } = await formatAsync(doc.content, { indent: 2 });
        if (!error && output !== null) {
          formatted = output;
        }
      } finally {
        hideProgress();
      }

      const contentToSave = formatted ?? doc.content;
      const result = await saveFile(contentToSave, {
        suggestedName: doc.name.endsWith('.json') ? doc.name : `${doc.name}.json`,
      });

      if (result.success) {
        if (result.name) {
          renameDocument(doc.id, result.name);
        }
        markSaved(doc.id);
      }
    } else {
      // Small documents: format synchronously on main thread
      const content = formatJson(doc.content) ?? doc.content;
      const result = await saveFile(content, {
        suggestedName: doc.name.endsWith('.json') ? doc.name : `${doc.name}.json`,
      });

      if (result.success) {
        if (result.name) {
          renameDocument(doc.id, result.name);
        }
        markSaved(doc.id);
      }
    }
  }, [doc, renameDocument, markSaved, isWorkerReady, formatAsync, showProgress, hideProgress]);
  
  const handleOpen = useCallback(async () => {
    const result = await openFile();
    if (result) {
      createDocument(result.name, result.content);
    }
  }, [createDocument]);
  
  const handleNextTab = useCallback(() => {
    if (tabs.length === 0 || !activeDocId) return;
    const currentIndex = tabs.findIndex(t => t.id === activeDocId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    setActive(tabs[nextIndex]!.id);
  }, [tabs, activeDocId, setActive]);
  
  const handlePrevTab = useCallback(() => {
    if (tabs.length === 0 || !activeDocId) return;
    const currentIndex = tabs.findIndex(t => t.id === activeDocId);
    const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    setActive(tabs[prevIndex]!.id);
  }, [tabs, activeDocId, setActive]);
  
  useEditorShortcuts({
    onSave: handleSave,
    onOpen: handleOpen,
    onNewTab: () => {
      createDocument();
    },
    onCloseTab: () => {
      if (activeDocId) {
        closeDocument(activeDocId);
      }
    },
    onFormat: useCallback(async () => {
      if (!doc?.content) return;

      if (isWorkerReady && doc.content.length > WORKER_THRESHOLD) {
        showProgress('Formatting JSON...');
        try {
          const { output, error } = await formatAsync(doc.content, { indent: 2 });
          if (!error && output !== null) {
            updateContent(output);
          }
        } finally {
          hideProgress();
        }
      } else {
        const formatted = formatJson(doc.content);
        if (formatted !== null) updateContent(formatted);
      }
    }, [doc, updateContent, isWorkerReady, formatAsync, showProgress, hideProgress]),
    onCompact: useCallback(async () => {
      if (!doc?.content) return;

      if (isWorkerReady && doc.content.length > WORKER_THRESHOLD) {
        showProgress('Minifying JSON...');
        try {
          const { output, error } = await compactAsync(doc.content);
          if (!error && output !== null) {
            updateContent(output);
          }
        } finally {
          hideProgress();
        }
      } else {
        const compacted = compactJson(doc.content);
        if (compacted !== null) updateContent(compacted);
      }
    }, [doc, updateContent, isWorkerReady, compactAsync, showProgress, hideProgress]),
    onUndo: () => {
      undo();
    },
    onRedo: () => {
      redo();
    },
    onFind: () => {
      openSearch(false);
    },
    onReplace: () => {
      openSearch(true);
    },
    onViewText: () => {
      if (activeDocId) {
        setViewMode(activeDocId, 'text');
      }
    },
    onViewTree: () => {
      if (activeDocId) {
        setViewMode(activeDocId, 'tree');
      }
    },
    onViewTable: () => {
      if (activeDocId) {
        setViewMode(activeDocId, 'table');
      }
    },
    onToggleTheme: toggleTheme,
    onSettings: onOpenSettings,
    onNextTab: handleNextTab,
    onPrevTab: handlePrevTab,
    onEscape: () => {
      closeSearch();
    },
    onGoToError: () => {
      goToError();
    },
    onGoToLine: onOpenGoToLine,
  });
  
  return null;
}

function AppContent() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const doc = useActiveDocument();
  const activeDocId = useActiveDocumentId();
  const { createDocument, closeDocument, renameDocument, markSaved, setViewMode } = useDocumentActions();
  const updateContent = useUpdateActiveContent();
  const { undo, redo } = useUndoRedo();
  const { openSearch } = useSearch();
  const { toggleTheme } = useTheme();
  const { goToLine } = useEditor();
  
  // Calculate max line for GoToLineModal
  const maxLine = doc?.content ? doc.content.split('\n').length : 1;
  
  const handleGoToLine = useCallback((line: number) => {
    goToLine(line, 1);
  }, [goToLine]);

  // Command palette shortcut (Cmd/Ctrl+K)
  useKeyboardShortcuts([{
    key: 'k',
    ctrl: true,
    action: () => setCommandPaletteOpen(true),
    description: 'Open Command Palette',
  }]);

  // Define all available commands
  const commands: Command[] = [
    // File operations
    {
      id: 'file.new',
      label: 'New Document',
      description: 'Create a new document',
      category: 'File',
      icon: commandIcons.new,
      shortcut: 'Ctrl+N',
      action: () => createDocument(),
      keywords: ['create', 'tab'],
    },
    {
      id: 'file.open',
      label: 'Open File',
      description: 'Open a file from your computer',
      category: 'File',
      icon: commandIcons.openFile,
      shortcut: 'Ctrl+O',
      action: async () => {
        const result = await openFile();
        if (result) {
          createDocument(result.name, result.content);
        }
      },
      keywords: ['load', 'import'],
    },
    {
      id: 'file.save',
      label: 'Save File',
      description: 'Save the current document',
      category: 'File',
      icon: commandIcons.save,
      shortcut: 'Ctrl+S',
      action: async () => {
        if (!doc) return;
        const content = formatJson(doc.content) ?? doc.content;
        const result = await saveFile(content, {
          suggestedName: doc.name.endsWith('.json') ? doc.name : `${doc.name}.json`,
        });
        if (result.success) {
          if (result.name) {
            renameDocument(doc.id, result.name);
          }
          markSaved(doc.id);
        }
      },
      keywords: ['export', 'download'],
    },
    {
      id: 'file.close',
      label: 'Close Document',
      description: 'Close the active document',
      category: 'File',
      icon: commandIcons.close,
      shortcut: 'Ctrl+W',
      action: () => {
        if (activeDocId) {
          closeDocument(activeDocId);
        }
      },
      keywords: ['close', 'tab'],
    },

    // Edit operations
    {
      id: 'edit.undo',
      label: 'Undo',
      description: 'Undo the last change',
      category: 'Edit',
      icon: commandIcons.undo,
      shortcut: 'Ctrl+Z',
      action: () => undo(),
    },
    {
      id: 'edit.redo',
      label: 'Redo',
      description: 'Redo the last undone change',
      category: 'Edit',
      icon: commandIcons.redo,
      shortcut: 'Ctrl+Y',
      action: () => redo(),
    },
    {
      id: 'edit.find',
      label: 'Find',
      description: 'Search in the current document',
      category: 'Edit',
      icon: commandIcons.search,
      shortcut: 'Ctrl+F',
      action: () => openSearch(false),
      keywords: ['search'],
    },
    {
      id: 'edit.replace',
      label: 'Find and Replace',
      description: 'Search and replace in the current document',
      category: 'Edit',
      icon: commandIcons.search,
      shortcut: 'Ctrl+H',
      action: () => openSearch(true),
      keywords: ['search', 'substitute'],
    },

    // Format operations
    {
      id: 'format.format',
      label: 'Format JSON',
      description: 'Pretty-print the current JSON',
      category: 'Format',
      icon: commandIcons.format,
      shortcut: 'Ctrl+Shift+F',
      action: () => {
        if (doc?.content) {
          const formatted = formatJson(doc.content);
          if (formatted !== null) {
            updateContent(formatted);
          }
        }
      },
      keywords: ['prettify', 'beautify', 'indent'],
    },
    {
      id: 'format.compact',
      label: 'Compact JSON',
      description: 'Minify the current JSON',
      category: 'Format',
      icon: commandIcons.compact,
      shortcut: 'Ctrl+Shift+M',
      action: () => {
        if (doc?.content) {
          const compacted = compactJson(doc.content);
          if (compacted !== null) {
            updateContent(compacted);
          }
        }
      },
      keywords: ['minify', 'compress'],
    },

    // View operations
    {
      id: 'view.text',
      label: 'Text View',
      description: 'Switch to text editor view',
      category: 'View',
      icon: commandIcons.viewText,
      shortcut: 'Ctrl+1',
      action: () => {
        if (activeDocId) {
          setViewMode(activeDocId, 'text');
        }
      },
      keywords: ['code', 'editor'],
    },
    {
      id: 'view.tree',
      label: 'Tree View',
      description: 'Switch to tree view',
      category: 'View',
      icon: commandIcons.viewTree,
      shortcut: 'Ctrl+2',
      action: () => {
        if (activeDocId) {
          setViewMode(activeDocId, 'tree');
        }
      },
      keywords: ['hierarchy', 'outline'],
    },
    {
      id: 'view.table',
      label: 'Table View',
      description: 'Switch to table view',
      category: 'View',
      icon: commandIcons.viewTable,
      shortcut: 'Ctrl+3',
      action: () => {
        if (activeDocId) {
          setViewMode(activeDocId, 'table');
        }
      },
      keywords: ['grid', 'spreadsheet'],
    },

    // Navigation
    {
      id: 'nav.goToLine',
      label: 'Go to Line',
      description: 'Jump to a specific line number',
      category: 'Navigation',
      shortcut: 'Ctrl+G',
      action: () => setGoToLineOpen(true),
      keywords: ['jump', 'line'],
    },

    // Settings
    {
      id: 'settings.open',
      label: 'Open Settings',
      description: 'Open the settings modal',
      category: 'Settings',
      icon: commandIcons.settings,
      shortcut: 'Ctrl+,',
      action: () => setSettingsOpen(true),
      keywords: ['preferences', 'config'],
    },
    {
      id: 'settings.toggleTheme',
      label: 'Toggle Theme',
      description: 'Switch between light and dark themes',
      category: 'Settings',
      icon: commandIcons.themeDark,
      shortcut: 'Ctrl+Shift+D',
      action: () => toggleTheme(),
      keywords: ['dark', 'light', 'appearance'],
    },
  ];
  
  return (
    <div className="h-screen flex flex-col bg-bg-base">
      <KeyboardShortcutsHandler 
        onOpenSettings={() => setSettingsOpen(true)} 
        onOpenGoToLine={() => setGoToLineOpen(true)}
      />
      <Header />
      <TabBar />
      <EditorToolbar />
      <main className="flex-1 overflow-hidden">
        <SplitEditorArea />
      </main>
      <StatusBar />
      
      {/* Global Settings Modal (can be triggered by Ctrl+,) */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      
      {/* Go to Line Modal (can be triggered by Ctrl+G) */}
      <GoToLineModal
        isOpen={goToLineOpen}
        onClose={() => setGoToLineOpen(false)}
        onGoToLine={handleGoToLine}
        maxLine={maxLine}
      />

      {/* Command Palette (can be triggered by Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commands}
      />
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <CursorProgressProvider>
          <DocumentProvider>
            <SearchProvider>
              <EditorProvider>
                <AppContent />
                <ToastContainer />
              </EditorProvider>
            </SearchProvider>
          </DocumentProvider>
        </CursorProgressProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}

export default App;
