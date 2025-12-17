import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';

// Editor navigation target
interface NavigationTarget {
  line: number;
  column?: number;
  highlight?: boolean; // Briefly highlight the line
}

// Editor event types
type EditorEventType = 
  | 'goToLine'
  | 'goToError'
  | 'focusEditor';

interface EditorEvent {
  type: EditorEventType;
  payload?: NavigationTarget;
}

// Panel layout types
export type PanelLayout = 'single' | 'split';
export type ActivePanel = 'left' | 'right';

interface EditorState {
  // Current navigation request (consumed by TextEditor)
  navigationTarget: NavigationTarget | null;
  // Event for editor to respond to
  pendingEvent: EditorEvent | null;
  // Panel layout state
  panelLayout: PanelLayout;
  splitRatio: number; // 0-1, percentage of left panel width
  activePanel: ActivePanel;
  // Document ID for right panel (left panel uses the main active document)
  rightPanelDocId: string | null;
}

interface EditorContextValue {
  state: EditorState;
  // Navigate to a specific line
  goToLine: (line: number, column?: number, highlight?: boolean) => void;
  // Navigate to the current error
  goToError: () => void;
  // Clear navigation target after handling
  clearNavigation: () => void;
  // Focus the editor
  focusEditor: () => void;
  // Clear pending event
  clearEvent: () => void;
  // Panel layout controls
  toggleSplitView: () => void;
  setSplitRatio: (ratio: number) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setRightPanelDoc: (docId: string | null) => void;
  closeSplitView: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState>({
    navigationTarget: null,
    pendingEvent: null,
    panelLayout: 'single',
    splitRatio: 0.5,
    activePanel: 'left',
    rightPanelDocId: null,
  });

  const goToLine = useCallback((line: number, column?: number, highlight?: boolean) => {
    setState((prev) => ({
      ...prev,
      navigationTarget: { line, column, highlight },
      pendingEvent: { type: 'goToLine', payload: { line, column, highlight } },
    }));
  }, []);

  const goToError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pendingEvent: { type: 'goToError' },
    }));
  }, []);

  const clearNavigation = useCallback(() => {
    setState((prev) => ({ ...prev, navigationTarget: null }));
  }, []);

  const focusEditor = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pendingEvent: { type: 'focusEditor' },
    }));
  }, []);

  const clearEvent = useCallback(() => {
    setState((prev) => ({ ...prev, pendingEvent: null }));
  }, []);

  // Panel layout controls
  const toggleSplitView = useCallback(() => {
    setState((prev) => ({
      ...prev,
      panelLayout: prev.panelLayout === 'single' ? 'split' : 'single',
    }));
  }, []);

  const setSplitRatio = useCallback((ratio: number) => {
    setState((prev) => ({
      ...prev,
      splitRatio: Math.max(0.2, Math.min(0.8, ratio)), // Clamp between 20% and 80%
    }));
  }, []);

  const setActivePanel = useCallback((panel: ActivePanel) => {
    setState((prev) => ({
      ...prev,
      activePanel: panel,
    }));
  }, []);

  const setRightPanelDoc = useCallback((docId: string | null) => {
    setState((prev) => ({
      ...prev,
      rightPanelDocId: docId,
    }));
  }, []);

  const closeSplitView = useCallback(() => {
    setState((prev) => ({
      ...prev,
      panelLayout: 'single',
      rightPanelDocId: null,
      activePanel: 'left',
    }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      goToLine,
      goToError,
      clearNavigation,
      focusEditor,
      clearEvent,
      toggleSplitView,
      setSplitRatio,
      setActivePanel,
      setRightPanelDoc,
      closeSplitView,
    }),
    [state, goToLine, goToError, clearNavigation, focusEditor, clearEvent, toggleSplitView, setSplitRatio, setActivePanel, setRightPanelDoc, closeSplitView]
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within EditorProvider');
  }
  return context;
}

// Hook for accessing panel layout state
export function usePanelLayout() {
  const { state, toggleSplitView, setSplitRatio, setActivePanel, setRightPanelDoc, closeSplitView } = useEditor();
  return {
    panelLayout: state.panelLayout,
    splitRatio: state.splitRatio,
    activePanel: state.activePanel,
    rightPanelDocId: state.rightPanelDocId,
    toggleSplitView,
    setSplitRatio,
    setActivePanel,
    setRightPanelDoc,
    closeSplitView,
  };
}

// Hook for listening to editor events
export function useEditorEvent(
  eventType: EditorEventType,
  handler: (payload?: NavigationTarget) => void
) {
  const { state, clearEvent } = useEditor();

  useEffect(() => {
    if (state.pendingEvent?.type === eventType) {
      handler(state.pendingEvent.payload);
      clearEvent();
    }
  }, [state.pendingEvent, eventType, handler, clearEvent]);
}
