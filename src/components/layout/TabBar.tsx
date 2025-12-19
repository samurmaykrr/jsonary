import { X, Plus, FileJs, Copy, Files, XCircle, PencilSimple } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useTabs, useDocumentActions } from '@/store/useDocumentStore';
import { usePanelLayout } from '@/store/useEditorStore';
import { ContextMenu, useContextMenu, Tooltip, type ContextMenuItem } from '@/components/ui';
import { useCallback, useState, useRef, useEffect } from 'react';
import { useDragAndDrop } from '@/hooks';

interface Tab {
  id: string;
  name: string;
  isDirty: boolean;
  isActive: boolean;
}

export function TabBar() {
  const tabs = useTabs();
  const { createDocument, closeDocument, setActive, reorderTabs, duplicateDocument, renameDocument } = useDocumentActions();
  const { panelLayout, activePanel, rightPanelDocId, setRightPanelDoc } = usePanelLayout();
  const { isOpen, x, y, items, openMenu, closeMenu } = useContextMenu();
  
  // State for inline rename editing
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);
  
  // Start renaming a tab
  const startRename = useCallback((tabId: string, currentName: string) => {
    setEditingTabId(tabId);
    setEditingName(currentName);
  }, []);
  
  // Finish renaming
  const finishRename = useCallback(() => {
    if (editingTabId && editingName.trim()) {
      renameDocument(editingTabId, editingName.trim());
    }
    setEditingTabId(null);
    setEditingName('');
  }, [editingTabId, editingName, renameDocument]);
  
  // Cancel renaming
  const cancelRename = useCallback(() => {
    setEditingTabId(null);
    setEditingName('');
  }, []);
  
  // Handle tab click - in split view, right panel gets document assigned instead of global active
  const handleTabClick = useCallback((tabId: string) => {
    // Don't change tabs if we're editing
    if (editingTabId) return;
    
    if (panelLayout === 'split' && activePanel === 'right') {
      // Set this document in the right panel
      setRightPanelDoc(tabId);
    } else {
      // Normal behavior - set global active document
      setActive(tabId);
    }
  }, [panelLayout, activePanel, setActive, setRightPanelDoc, editingTabId]);
  
  // Drag and drop for tab reordering
  const { getDragProps, state: dragState } = useDragAndDrop<Tab>({
    items: tabs,
    onReorder: reorderTabs,
    getItemId: (tab) => tab.id,
  });
  
  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeDocument(id);
  };
  
  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string, tabName: string) => {
    const menuItems: ContextMenuItem[] = [
      {
        id: 'rename',
        label: 'Rename',
        icon: <PencilSimple size={14} />,
        onClick: () => startRename(tabId, tabName),
      },
      {
        id: 'duplicate',
        label: 'Duplicate Tab',
        icon: <Copy size={14} />,
        onClick: () => {
          duplicateDocument(tabId);
        },
      },
      { id: 'sep1', label: '', separator: true },
      {
        id: 'close',
        label: 'Close',
        shortcut: 'Ctrl+W',
        icon: <X size={14} />,
        onClick: () => closeDocument(tabId),
      },
      {
        id: 'close-others',
        label: 'Close Others',
        icon: <Files size={14} />,
        disabled: tabs.length <= 1,
        onClick: () => {
          tabs.forEach((tab) => {
            if (tab.id !== tabId) {
              closeDocument(tab.id);
            }
          });
        },
      },
      {
        id: 'close-all',
        label: 'Close All',
        icon: <XCircle size={14} />,
        onClick: () => {
          tabs.forEach((tab) => {
            closeDocument(tab.id);
          });
        },
      },
    ];
    
    openMenu(e, menuItems);
  }, [tabs, closeDocument, duplicateDocument, openMenu, startRename]);
  
  return (
    <>
      <div className="h-9 border-b border-border-default bg-bg-surface flex items-center overflow-x-auto no-scrollbar">
        {/* Tabs */}
        <div className="flex items-center h-full min-w-0">
          {tabs.map((tab, index) => {
            const dragProps = getDragProps(tab, index);
            const isDragging = dragProps['data-dragging'];
            const isDropTarget = dragProps['data-drop-target'];
            
            // In split view, highlight based on which panel is active
            const isActiveInCurrentPanel = panelLayout === 'split' 
              ? (activePanel === 'left' ? tab.isActive : tab.id === rightPanelDocId)
              : tab.isActive;
            
            return (
              <div
                key={tab.id}
                role="tab"
                tabIndex={0}
                onClick={() => handleTabClick(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id, tab.name)}
                onDoubleClick={() => startRename(tab.id, tab.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleTabClick(tab.id);
                  }
                }}
                {...dragProps}
                className={cn(
                  'h-full px-2 sm:px-3 flex items-center gap-1.5 sm:gap-2 border-b-2 text-sm transition-all min-w-0 cursor-pointer select-none flex-shrink-0',
                  isActiveInCurrentPanel
                    ? 'border-accent text-text-primary bg-bg-base'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover',
                  // Drag states
                  isDragging && 'opacity-50 scale-95',
                  isDropTarget && 'border-l-2 border-l-accent',
                  dragState.isDragging && 'transition-transform duration-150'
                )}
              >
                <FileJs className="w-4 h-4 text-text-tertiary flex-shrink-0 hidden sm:block" />
                {editingTabId === tab.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        finishRename();
                      } else if (e.key === 'Escape') {
                        cancelRename();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-bg-base border border-accent rounded px-1 py-0 text-sm w-24 sm:w-32 outline-none"
                  />
                ) : (
                  <span className="truncate max-w-20 sm:max-w-32">{tab.name}</span>
                )}
                {tab.isDirty && (
                  <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                )}
                <button
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  onMouseDown={(e) => e.stopPropagation()} // Prevent drag start when clicking close
                  className="p-0.5 rounded hover:bg-bg-active flex-shrink-0 opacity-60 hover:opacity-100"
                  aria-label={`Close ${tab.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
        
        {/* New Tab Button */}
        <Tooltip content="New Tab" shortcut="Ctrl+N" position="bottom">
          <button
            onClick={() => createDocument()}
            className="h-full px-2 flex items-center text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors flex-shrink-0"
            aria-label="New tab"
          >
            <Plus className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
      
      {/* Context Menu */}
      {isOpen && (
        <ContextMenu items={items} x={x} y={y} onClose={closeMenu} />
      )}
    </>
  );
}
