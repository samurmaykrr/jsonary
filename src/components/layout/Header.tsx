import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Code, 
  TreeStructure, 
  Table, 
  Gear, 
  Sun, 
  Moon,
  FolderOpen,
  FloppyDisk,
  ClipboardText,
  Link,
  CaretDown,
  FileArrowUp,
  FileArrowDown,
  MagnifyingGlass,
  SortAscending,
  FunnelSimple,
  ArrowsLeftRight,
  SplitHorizontal,
  List,
  X,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button, Tooltip } from '@/components/ui';
import { SettingsModal } from '@/components/ui/SettingsModal';
import { TransformModal } from '@/components/ui/TransformModal';
import { CompareModal } from '@/components/ui/CompareModal';
import { useActiveDocument, useDocumentActions, useUpdateActiveContent, useTabs } from '@/store/useDocumentStore';
import { useTheme } from '@/store/useSettingsStore';
import { usePanelLayout } from '@/store/useEditorStore';
import type { ViewMode } from '@/types';
import { openFile, readFromClipboard, saveFile, fetchFromUrl } from '@/lib/file';
import { formatJson, parseJson } from '@/lib/json';
import { parseCsv, stringifyCsv, looksLikeCsv } from '@/lib/csv';

export function Header() {
  const activeDoc = useActiveDocument();
  const tabs = useTabs();
  const { setViewMode, createDocument, renameDocument, markSaved } = useDocumentActions();
  const { theme, toggleTheme } = useTheme();
  const { panelLayout, toggleSplitView, setRightPanelDoc } = usePanelLayout();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[]; rows: Record<string, unknown>[]; name: string } | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [transformModalOpen, setTransformModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [splitDocModalOpen, setSplitDocModalOpen] = useState(false);
  const updateContent = useUpdateActiveContent();
  
  // ESC key handlers for inline modals
  useEffect(() => {
    if (!urlModalOpen && !csvModalOpen && !splitDocModalOpen && !mobileMenuOpen) {
      return;
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (urlModalOpen) {
          setUrlModalOpen(false);
          setUrlInput('');
          setUrlError(null);
        }
        if (csvModalOpen) {
          setCsvModalOpen(false);
          setCsvPreview(null);
        }
        if (splitDocModalOpen) {
          setSplitDocModalOpen(false);
        }
        if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [urlModalOpen, csvModalOpen, splitDocModalOpen, mobileMenuOpen]);
  
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const handleViewModeChange = (mode: ViewMode) => {
    if (activeDoc) {
      setViewMode(activeDoc.id, mode);
    }
  };
  
  const currentMode = activeDoc?.viewMode ?? 'text';
  
  // File operations
  const handleOpenFile = useCallback(async () => {
    setMenuOpen(null);
    const result = await openFile();
    if (result) {
      createDocument(result.name, result.content);
    }
  }, [createDocument]);
  
  const handleSaveFile = useCallback(async () => {
    setMenuOpen(null);
    if (!activeDoc) return;
    
    const content = formatJson(activeDoc.content) ?? activeDoc.content;
    const result = await saveFile(content, {
      suggestedName: activeDoc.name.endsWith('.json') ? activeDoc.name : `${activeDoc.name}.json`,
    });
    
    if (result.success) {
      if (result.name) {
        renameDocument(activeDoc.id, result.name);
      }
      markSaved(activeDoc.id);
    }
  }, [activeDoc, renameDocument, markSaved]);
  
  const handlePasteFromClipboard = useCallback(async () => {
    setMenuOpen(null);
    const content = await readFromClipboard();
    if (content) {
      createDocument('Clipboard', content);
    }
  }, [createDocument]);
  
  const handleOpenUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    
    setUrlLoading(true);
    setUrlError(null);
    
    const result = await fetchFromUrl(urlInput.trim());
    
    setUrlLoading(false);
    
    if ('error' in result) {
      setUrlError(result.error);
    } else {
      createDocument(result.name, result.content);
      setUrlModalOpen(false);
      setUrlInput('');
    }
  }, [urlInput, createDocument]);
  
  // CSV operations
  const handleImportCsv = useCallback(() => {
    setMenuOpen(null);
    csvFileInputRef.current?.click();
  }, []);
  
  const handleCsvFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      if (!looksLikeCsv(content)) {
        alert('The selected file does not appear to be a valid CSV file.');
        return;
      }
      
      const parsed = parseCsv(content);
      setCsvPreview({ headers: parsed.headers, rows: parsed.rows, name: file.name.replace(/\.csv$/i, '') });
      setCsvModalOpen(true);
    };
    reader.readAsText(file);
    
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }, []);
  
  const handleConfirmCsvImport = useCallback(() => {
    if (!csvPreview) return;
    
    const jsonContent = JSON.stringify(csvPreview.rows, null, 2);
    createDocument(csvPreview.name, jsonContent);
    setCsvModalOpen(false);
    setCsvPreview(null);
  }, [csvPreview, createDocument]);
  
  const handleExportCsv = useCallback(async () => {
    setMenuOpen(null);
    if (!activeDoc) return;
    
    const parsed = parseJson(activeDoc.content);
    if (parsed.error || !Array.isArray(parsed.value)) {
      alert('Export to CSV requires the document to contain a JSON array.');
      return;
    }
    
    const csvContent = stringifyCsv(parsed.value);
    const baseName = activeDoc.name.replace(/\.json$/i, '');
    
    const result = await saveFile(csvContent, {
      suggestedName: `${baseName}.csv`,
      types: [{
        description: 'CSV Files',
        accept: { 'text/csv': ['.csv'] },
      }],
    });
    
    if (result.success) {
      // Optionally show success notification
    }
  }, [activeDoc]);
  
  const closeMenu = () => setMenuOpen(null);
  
  return (
    <>
      <header className="h-12 border-b border-border-default bg-bg-surface flex items-center justify-between px-2 sm:px-4">
        {/* Logo & Name */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
              <Code className="w-4 h-4 text-white" weight="bold" />
            </div>
            <span className="font-semibold text-text-primary hidden sm:inline">Mayson</span>
          </div>
          
          {/* Desktop Menus */}
          <div className="hidden sm:flex items-center gap-2">
            {/* File Menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(menuOpen === 'file' ? null : 'file')}
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors',
                  menuOpen === 'file'
                    ? 'bg-bg-active text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                )}
              >
                File
                <CaretDown className="w-3 h-3" />
              </button>
              
              {menuOpen === 'file' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={closeMenu} />
                  <div className="absolute top-full left-0 mt-1 w-48 bg-bg-elevated border border-border-default rounded-lg shadow-xl z-50 py-1">
                    <button
                      onClick={handleOpenFile}
                      className="w-full px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Open File...
                      <span className="ml-auto text-xs text-text-muted">Ctrl+O</span>
                    </button>
                    <button
                      onClick={() => { setUrlModalOpen(true); closeMenu(); }}
                      className="w-full px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2"
                    >
                      <Link className="w-4 h-4" />
                      Open URL...
                    </button>
                    <button
                      onClick={handlePasteFromClipboard}
                      className="w-full px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2"
                    >
                      <ClipboardText className="w-4 h-4" />
                      Paste from Clipboard
                    </button>
                    <div className="border-t border-border-subtle my-1" />
                    <button
                      onClick={handleSaveFile}
                      disabled={!activeDoc}
                      className="w-full px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FloppyDisk className="w-4 h-4" />
                      Save...
                      <span className="ml-auto text-xs text-text-muted">Ctrl+S</span>
                    </button>
                    <div className="border-t border-border-subtle my-1" />
                    <button
                      onClick={handleImportCsv}
                      className="w-full px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2"
                    >
                      <FileArrowUp className="w-4 h-4" />
                      Import CSV...
                    </button>
                    <button
                      onClick={handleExportCsv}
                      disabled={!activeDoc}
                      className="w-full px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileArrowDown className="w-4 h-4" />
                      Export to CSV...
                    </button>
                  </div>
                </>
              )}
            </div>
            
            {/* Tools Menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(menuOpen === 'tools' ? null : 'tools')}
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors',
                  menuOpen === 'tools'
                    ? 'bg-bg-active text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                )}
              >
                Tools
                <CaretDown className="w-3 h-3" />
              </button>
              
              {menuOpen === 'tools' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={closeMenu} />
                  <div className="absolute top-full left-0 mt-1 w-52 bg-bg-elevated border border-border-default rounded-lg shadow-xl z-50 py-1">
                    <button
                      onClick={() => { setTransformModalOpen(true); closeMenu(); }}
                      disabled={!activeDoc}
                      className="w-full px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MagnifyingGlass className="w-4 h-4" />
                      JSONPath Query...
                    </button>
                    <button
                      onClick={() => { setTransformModalOpen(true); closeMenu(); }}
                      disabled={!activeDoc}
                      className="w-full px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <SortAscending className="w-4 h-4" />
                      Sort...
                    </button>
                    <button
                      onClick={() => { setTransformModalOpen(true); closeMenu(); }}
                      disabled={!activeDoc}
                      className="w-full px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FunnelSimple className="w-4 h-4" />
                      Filter...
                    </button>
                    <div className="border-t border-border-subtle my-1" />
                    <button
                      onClick={() => { setCompareModalOpen(true); closeMenu(); }}
                      disabled={!activeDoc}
                      className="w-full px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowsLeftRight className="w-4 h-4" />
                      Compare...
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="sm:hidden p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            aria-label="Open menu"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
        
        {/* View Mode Toggle - Desktop */}
        <div className="hidden sm:flex items-center">
          <div className="inline-flex rounded-md border border-border-default bg-bg-base p-0.5">
            <Tooltip content="Text View" shortcut="Ctrl+1" position="bottom">
              <button
                onClick={() => handleViewModeChange('text')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors',
                  currentMode === 'text'
                    ? 'bg-bg-surface text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                <Code className="w-3.5 h-3.5" />
                Text
              </button>
            </Tooltip>
            <Tooltip content="Tree View" shortcut="Ctrl+2" position="bottom">
              <button
                onClick={() => handleViewModeChange('tree')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors',
                  currentMode === 'tree'
                    ? 'bg-bg-surface text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                <TreeStructure className="w-3.5 h-3.5" />
                Tree
              </button>
            </Tooltip>
            <Tooltip content="Table View" shortcut="Ctrl+3" position="bottom">
              <button
                onClick={() => handleViewModeChange('table')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors',
                  currentMode === 'table'
                    ? 'bg-bg-surface text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                <Table className="w-3.5 h-3.5" />
                Table
              </button>
            </Tooltip>
          </div>
        </div>
        
        {/* View Mode Toggle - Mobile (icons only) */}
        <div className="flex sm:hidden items-center">
          <div className="inline-flex rounded-md border border-border-default bg-bg-base p-0.5">
            <button
              onClick={() => handleViewModeChange('text')}
              className={cn(
                'p-1.5 text-xs font-medium rounded flex items-center transition-colors',
                currentMode === 'text'
                  ? 'bg-bg-surface text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
              aria-label="Text view"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('tree')}
              className={cn(
                'p-1.5 text-xs font-medium rounded flex items-center transition-colors',
                currentMode === 'tree'
                  ? 'bg-bg-surface text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
              aria-label="Tree view"
            >
              <TreeStructure className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('table')}
              className={cn(
                'p-1.5 text-xs font-medium rounded flex items-center transition-colors',
                currentMode === 'table'
                  ? 'bg-bg-surface text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
              aria-label="Table view"
            >
              <Table className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Split View Toggle - hide on mobile */}
          <Tooltip content={panelLayout === 'split' ? 'Close split view' : 'Open split view'} position="bottom">
            <Button
              variant={panelLayout === 'split' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                if (panelLayout === 'single') {
                  // When opening split view, show document selector
                  setSplitDocModalOpen(true);
                } else {
                  toggleSplitView();
                }
              }}
              className="hidden sm:flex w-8 h-8 p-0"
            >
              <SplitHorizontal className="w-4 h-4" />
            </Button>
          </Tooltip>
          
          <Tooltip content={`Switch to ${isDark ? 'light' : 'dark'} mode`} shortcut="Ctrl+Shift+D" position="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="w-8 h-8 p-0"
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          </Tooltip>
          
          <Tooltip content="Settings" shortcut="Ctrl+," position="bottom">
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0"
              onClick={() => setSettingsOpen(true)}
            >
              <Gear className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </header>
      
      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 left-0 w-64 h-full bg-bg-elevated border-r border-border-default shadow-xl overflow-y-auto">
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-default">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
                  <Code className="w-4 h-4 text-white" weight="bold" />
                </div>
                <span className="font-semibold text-text-primary">Mayson</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Mobile Menu Content */}
            <div className="p-2">
              {/* File Section */}
              <div className="mb-4">
                <div className="px-3 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">File</div>
                <button
                  onClick={() => { handleOpenFile(); setMobileMenuOpen(false); }}
                  className="w-full px-3 py-3 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded flex items-center gap-3"
                >
                  <FolderOpen className="w-5 h-5" />
                  Open File
                </button>
                <button
                  onClick={() => { setUrlModalOpen(true); setMobileMenuOpen(false); }}
                  className="w-full px-3 py-3 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded flex items-center gap-3"
                >
                  <Link className="w-5 h-5" />
                  Open URL
                </button>
                <button
                  onClick={() => { handlePasteFromClipboard(); setMobileMenuOpen(false); }}
                  className="w-full px-3 py-3 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded flex items-center gap-3"
                >
                  <ClipboardText className="w-5 h-5" />
                  Paste from Clipboard
                </button>
                <button
                  onClick={() => { handleSaveFile(); setMobileMenuOpen(false); }}
                  disabled={!activeDoc}
                  className="w-full px-3 py-3 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded flex items-center gap-3 disabled:opacity-50"
                >
                  <FloppyDisk className="w-5 h-5" />
                  Save
                </button>
              </div>
              
              {/* CSV Section */}
              <div className="mb-4">
                <div className="px-3 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Import/Export</div>
                <button
                  onClick={() => { handleImportCsv(); setMobileMenuOpen(false); }}
                  className="w-full px-3 py-3 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded flex items-center gap-3"
                >
                  <FileArrowUp className="w-5 h-5" />
                  Import CSV
                </button>
                <button
                  onClick={() => { handleExportCsv(); setMobileMenuOpen(false); }}
                  disabled={!activeDoc}
                  className="w-full px-3 py-3 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded flex items-center gap-3 disabled:opacity-50"
                >
                  <FileArrowDown className="w-5 h-5" />
                  Export CSV
                </button>
              </div>
              
              {/* Tools Section */}
              <div className="mb-4">
                <div className="px-3 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Tools</div>
                <button
                  onClick={() => { setTransformModalOpen(true); setMobileMenuOpen(false); }}
                  disabled={!activeDoc}
                  className="w-full px-3 py-3 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded flex items-center gap-3 disabled:opacity-50"
                >
                  <MagnifyingGlass className="w-5 h-5" />
                  Query & Transform
                </button>
                <button
                  onClick={() => { setCompareModalOpen(true); setMobileMenuOpen(false); }}
                  disabled={!activeDoc}
                  className="w-full px-3 py-3 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded flex items-center gap-3 disabled:opacity-50"
                >
                  <ArrowsLeftRight className="w-5 h-5" />
                  Compare JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      
      {/* Hidden CSV File Input */}
      <input
        ref={csvFileInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={handleCsvFileChange}
        className="hidden"
      />
      
      {/* CSV Preview Modal */}
      {csvModalOpen && csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setCsvModalOpen(false); setCsvPreview(null); }} />
          <div className="relative w-full h-full sm:h-auto sm:max-w-2xl bg-bg-elevated rounded-none sm:rounded-lg shadow-xl border-0 sm:border border-border-default sm:max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-border-default">
              <h2 className="text-sm font-medium text-text-primary truncate">Import CSV: {csvPreview.name}</h2>
              <p className="text-xs text-text-muted mt-1">
                {csvPreview.rows.length} rows, {csvPreview.headers.length} columns
              </p>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="text-xs text-text-secondary mb-2">Preview (first 10 rows):</div>
              <div className="overflow-x-auto border border-border-default rounded">
                <table className="w-full text-xs">
                  <thead className="bg-bg-surface border-b border-border-default">
                    <tr>
                      {csvPreview.headers.map((header, i) => (
                        <th key={i} className="px-2 py-1.5 text-left text-text-secondary font-medium whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-border-subtle last:border-0">
                        {csvPreview.headers.map((header, j) => (
                          <td key={j} className="px-2 py-1.5 text-text-primary whitespace-nowrap max-w-[150px] sm:max-w-[200px] truncate">
                            {String(row[header] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvPreview.rows.length > 10 && (
                <p className="text-xs text-text-muted mt-2">
                  ...and {csvPreview.rows.length - 10} more rows
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-default bg-bg-surface/50 sm:rounded-b-lg">
              <Button variant="ghost" onClick={() => { setCsvModalOpen(false); setCsvPreview(null); }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmCsvImport}>
                Import as JSON
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* URL Modal */}
      {urlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUrlModalOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-bg-elevated rounded-t-lg sm:rounded-lg shadow-xl border-0 sm:border border-border-default">
            <div className="px-4 py-3 border-b border-border-default">
              <h2 className="text-sm font-medium text-text-primary">Open from URL</h2>
            </div>
            <div className="p-4">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/data.json"
                className="w-full px-3 py-3 sm:py-2 text-sm bg-bg-base border border-border-default rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOpenUrl();
                }}
                autoFocus
              />
              {urlError && (
                <p className="mt-2 text-xs text-error">{urlError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-default bg-bg-surface/50 sm:rounded-b-lg">
              <Button variant="ghost" onClick={() => setUrlModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleOpenUrl}
                disabled={urlLoading || !urlInput.trim()}
              >
                {urlLoading ? 'Loading...' : 'Open'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Transform Modal */}
      {activeDoc && (
        <TransformModal
          isOpen={transformModalOpen}
          onClose={() => setTransformModalOpen(false)}
          content={activeDoc.content}
          onApply={(result) => {
            updateContent(result);
            setTransformModalOpen(false);
          }}
        />
      )}
      
      {/* Compare Modal */}
      {activeDoc && (
        <CompareModal
          isOpen={compareModalOpen}
          onClose={() => setCompareModalOpen(false)}
          leftContent={activeDoc.content}
          leftTitle={activeDoc.name}
          onApplyLeft={(result) => {
            updateContent(result);
            setCompareModalOpen(false);
          }}
        />
      )}
      
      {/* Split Document Selector Modal */}
      {splitDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSplitDocModalOpen(false)} />
          <div className="relative w-full sm:max-w-sm bg-bg-elevated rounded-t-lg sm:rounded-lg shadow-xl border-0 sm:border border-border-default">
            <div className="px-4 py-3 border-b border-border-default">
              <h2 className="text-sm font-medium text-text-primary">Open in Split View</h2>
              <p className="text-xs text-text-muted mt-1">Select a document for the right panel</p>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {tabs.filter(tab => tab.id !== activeDoc?.id).length === 0 ? (
                <p className="px-3 py-2 text-sm text-text-tertiary">No other documents available. Open another document first.</p>
              ) : (
                tabs
                  .filter(tab => tab.id !== activeDoc?.id)
                  .map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setRightPanelDoc(tab.id);
                        toggleSplitView();
                        setSplitDocModalOpen(false);
                      }}
                      className="w-full px-3 py-3 sm:py-2 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded flex items-center gap-2"
                    >
                      <Code className="w-4 h-4" />
                      <span className="truncate">{tab.name}</span>
                      {tab.isDirty && (
                        <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                      )}
                    </button>
                  ))
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-default bg-bg-surface/50 sm:rounded-b-lg">
              <Button variant="ghost" onClick={() => setSplitDocModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
