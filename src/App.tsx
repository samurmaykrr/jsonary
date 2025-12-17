import { useCallback, useState, useEffect } from 'react';
import { DocumentProvider, useDocument } from '@/store/documentStore';
import { SearchProvider, useSearch } from '@/store/searchStore';
import { EditorProvider, useEditor, usePanelLayout } from '@/store/editorStore';
import { SettingsProvider, useTheme } from '@/store/settingsStore';
import { ToastProvider } from '@/store/toastStore';
import { Header } from '@/components/layout/Header';
import { TabBar } from '@/components/layout/TabBar';
import { StatusBar } from '@/components/layout/StatusBar';
import { PanelSplitter } from '@/components/layout/PanelSplitter';
import { TextEditor } from '@/components/editor/text/TextEditor';
import { TreeEditor } from '@/components/editor/tree/TreeEditor';
import { TableEditor } from '@/components/editor/table/TableEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { SettingsModal, ToastContainer } from '@/components/ui';
import { GoToLineModal } from '@/components/ui/GoToLineModal';
import {
  useActiveDocument,
  useActiveDocumentId,
  useDocumentActions,
  useUpdateActiveContent,
  useUndoRedo,
  useTabs,
} from '@/store/documentStore';
import { useEditorShortcuts } from '@/hooks';
import { formatJson, compactJson } from '@/lib/json';
import { openFile, saveFile } from '@/lib/file';
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
function TreeEditorLazy({ isActive }: { isActive: boolean }) {
  const [hasBeenActive, setHasBeenActive] = useState(false);
  
  useEffect(() => {
    if (isActive && !hasBeenActive) {
      setHasBeenActive(true);
    }
  }, [isActive, hasBeenActive]);
  
  if (!hasBeenActive) return null;
  return <TreeEditor />;
}

function TableEditorLazy({ isActive }: { isActive: boolean }) {
  const [hasBeenActive, setHasBeenActive] = useState(false);
  
  useEffect(() => {
    if (isActive && !hasBeenActive) {
      setHasBeenActive(true);
    }
  }, [isActive, hasBeenActive]);
  
  if (!hasBeenActive) return null;
  return <TableEditor />;
}

function EditorArea() {
  const doc = useActiveDocument();
  
  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary">
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
      <div className="flex-1 flex items-center justify-center text-text-tertiary">
        Select a document for comparison
      </div>
    );
  }
  
  return <EditorView doc={doc} />;
}

// Split view container
function SplitEditorArea() {
  const { panelLayout, splitRatio, setSplitRatio, rightPanelDocId, activePanel, setActivePanel } = usePanelLayout();
  
  if (panelLayout === 'single') {
    return <EditorArea />;
  }
  
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel */}
      <div 
        className={cn(
          'flex flex-col overflow-hidden',
          activePanel === 'left' && 'ring-1 ring-accent ring-inset'
        )}
        style={{ width: `${splitRatio * 100}%` }}
        onClick={() => setActivePanel('left')}
      >
        <EditorArea />
      </div>
      
      {/* Splitter */}
      <PanelSplitter onResize={setSplitRatio} />
      
      {/* Right Panel */}
      <div 
        className={cn(
          'flex flex-col overflow-hidden',
          activePanel === 'right' && 'ring-1 ring-accent ring-inset'
        )}
        style={{ width: `${(1 - splitRatio) * 100}%` }}
        onClick={() => setActivePanel('right')}
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
  
  const handleSave = useCallback(async () => {
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
  }, [doc, renameDocument, markSaved]);
  
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
    onFormat: () => {
      if (doc?.content) {
        const formatted = formatJson(doc.content);
        if (formatted !== null) {
          updateContent(formatted);
        }
      }
    },
    onCompact: () => {
      if (doc?.content) {
        const compacted = compactJson(doc.content);
        if (compacted !== null) {
          updateContent(compacted);
        }
      }
    },
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
  const doc = useActiveDocument();
  const { goToLine } = useEditor();
  
  // Calculate max line for GoToLineModal
  const maxLine = doc?.content ? doc.content.split('\n').length : 1;
  
  const handleGoToLine = useCallback((line: number) => {
    goToLine(line, 1);
  }, [goToLine]);
  
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
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <DocumentProvider>
          <SearchProvider>
            <EditorProvider>
              <AppContent />
              <ToastContainer />
            </EditorProvider>
          </SearchProvider>
        </DocumentProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}

export default App;
