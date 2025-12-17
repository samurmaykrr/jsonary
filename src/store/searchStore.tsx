import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { SearchMatch } from '@/components/editor/search/SearchBar';

interface SearchState {
  isOpen: boolean;
  showReplace: boolean;
  matches: SearchMatch[];
  currentMatchIndex: number;
}

interface SearchContextValue {
  state: SearchState;
  openSearch: (showReplace?: boolean) => void;
  closeSearch: () => void;
  setMatches: (matches: SearchMatch[], currentIndex: number) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SearchState>({
    isOpen: false,
    showReplace: false,
    matches: [],
    currentMatchIndex: 0,
  });
  
  const openSearch = useCallback((showReplace = false) => {
    setState((prev) => ({ ...prev, isOpen: true, showReplace }));
  }, []);
  
  const closeSearch = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false, matches: [], currentMatchIndex: 0 }));
  }, []);
  
  const setMatches = useCallback((matches: SearchMatch[], currentIndex: number) => {
    setState((prev) => ({ ...prev, matches, currentMatchIndex: currentIndex }));
  }, []);
  
  const value = useMemo(
    () => ({ state, openSearch, closeSearch, setMatches }),
    [state, openSearch, closeSearch, setMatches]
  );
  
  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
}
