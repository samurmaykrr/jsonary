import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  MagnifyingGlass,
  X,
  CaretUp,
  CaretDown,
  TextAa,
  Asterisk,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button, Tooltip } from '@/components/ui';
import { findMatches, type SearchMatch } from '@/lib/search';

// Re-export SearchMatch for convenience
export type { SearchMatch } from '@/lib/search';

interface SearchBarProps {
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onReplace: (searchText: string, replaceText: string, replaceAll: boolean) => void;
  onMatchesChange?: (matches: SearchMatch[], currentIndex: number) => void;
  showReplace?: boolean;
}

export function SearchBar({
  content,
  isOpen,
  onClose,
  onReplace,
  onMatchesChange,
  showReplace: initialShowReplace = false,
}: SearchBarProps) {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(initialShowReplace);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Find all matches
  const matches = useMemo(
    () => findMatches(content, searchText, caseSensitive, useRegex),
    [content, searchText, caseSensitive, useRegex]
  );
  
  // Compute valid currentMatchIndex during render (avoid Effect for state adjustment)
  // If currentMatchIndex is out of bounds, clamp it - this is more efficient than an Effect
  const validCurrentMatchIndex = matches.length === 0 
    ? 0 
    : Math.min(currentMatchIndex, matches.length - 1);
  
  // Sync state if index was clamped (adjust state during render pattern from React docs)
  if (validCurrentMatchIndex !== currentMatchIndex && matches.length > 0) {
    setCurrentMatchIndex(validCurrentMatchIndex);
  }
  
  // Notify parent of matches - this effect is intentional to sync search results
  // with parent component for highlighting. This is event-driven communication.
  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/you-might-not-need-an-effect
    onMatchesChange?.(matches, validCurrentMatchIndex);
  }, [matches, validCurrentMatchIndex, onMatchesChange]);
  
  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [isOpen]);
  
  // Navigate to previous match
  const goToPrevious = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) =>
      prev <= 0 ? matches.length - 1 : prev - 1
    );
    // Keep focus on search input
    searchInputRef.current?.focus();
  }, [matches.length]);
  
  // Navigate to next match
  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) =>
      prev >= matches.length - 1 ? 0 : prev + 1
    );
    // Keep focus on search input
    searchInputRef.current?.focus();
  }, [matches.length]);
  
  // Handle replace current
  const handleReplaceCurrent = useCallback(() => {
    if (matches.length === 0) return;
    onReplace(searchText, replaceText, false);
    // Keep focus on search input
    searchInputRef.current?.focus();
  }, [searchText, replaceText, matches.length, onReplace]);
  
  // Handle replace all
  const handleReplaceAll = useCallback(() => {
    if (matches.length === 0) return;
    onReplace(searchText, replaceText, true);
    // Keep focus on search input
    searchInputRef.current?.focus();
  }, [searchText, replaceText, matches.length, onReplace]);
  
  // Prevent focus loss when clicking buttons
  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          goToPrevious();
        } else {
          goToNext();
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevious();
        } else {
          goToNext();
        }
      }
    },
    [onClose, goToNext, goToPrevious]
  );
  
  if (!isOpen) return null;
  
  return (
    <div
      className={cn(
        'absolute top-0 right-0 sm:right-4 left-0 sm:left-auto z-50',
        'bg-bg-elevated border border-border-default rounded-none sm:rounded-lg shadow-lg',
        'p-2 space-y-2'
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Search Row */}
      <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
        <div className="relative flex-1 min-w-0">
          <MagnifyingGlass
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary"
            size={16}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Find"
            className={cn(
              'w-full h-8 pl-8 pr-2 text-sm',
              'bg-bg-input border border-border-default rounded',
              'text-text-primary placeholder:text-text-tertiary',
              'focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50'
            )}
          />
        </div>
        
        {/* Match count */}
        <span className="text-xs text-text-tertiary min-w-[50px] sm:min-w-[60px] text-center">
          {matches.length > 0
            ? `${currentMatchIndex + 1}/${matches.length}`
            : searchText
            ? 'None'
            : ''}
        </span>
        
        {/* Navigation buttons */}
        <Tooltip content="Previous match (Shift+Enter)" position="top">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevious}
            onMouseDown={preventFocusLoss}
            disabled={matches.length === 0}
            className="p-1 h-8 w-8 sm:h-7 sm:w-7"
          >
            <CaretUp size={16} />
          </Button>
        </Tooltip>
        <Tooltip content="Next match (Enter)" position="top">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNext}
            onMouseDown={preventFocusLoss}
            disabled={matches.length === 0}
            className="p-1 h-8 w-8 sm:h-7 sm:w-7"
          >
            <CaretDown size={16} />
          </Button>
        </Tooltip>

        {/* Options */}
        <div className="flex items-center gap-0.5 border-l border-border-subtle pl-1 ml-1">
          <Tooltip content="Match case (Aa)" position="top">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCaseSensitive((prev) => !prev)}
              onMouseDown={preventFocusLoss}
              className={cn('p-1 h-8 w-8 sm:h-7 sm:w-7', caseSensitive && 'bg-accent-primary/20 text-accent-primary')}
            >
              <TextAa size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="Use regular expression" position="top">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUseRegex((prev) => !prev)}
              onMouseDown={preventFocusLoss}
              className={cn('p-1 h-8 w-8 sm:h-7 sm:w-7', useRegex && 'bg-accent-primary/20 text-accent-primary')}
            >
              <Asterisk size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="Toggle replace (Ctrl+H)" position="top">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplace((prev) => !prev)}
              onMouseDown={preventFocusLoss}
              className={cn('p-1 h-8 w-8 sm:h-7 sm:w-7', showReplace && 'bg-accent-primary/20 text-accent-primary')}
            >
              <ArrowsClockwise size={16} />
            </Button>
          </Tooltip>
        </div>

        {/* Close button */}
        <Tooltip content="Close (Escape)" position="top">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 h-8 w-8 sm:h-7 sm:w-7"
          >
            <X size={16} />
          </Button>
        </Tooltip>
      </div>
      
      {/* Replace Row */}
      {showReplace && (
        <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace"
            className={cn(
              'flex-1 min-w-0 h-8 px-2 text-sm',
              'bg-bg-input border border-border-default rounded',
              'text-text-primary placeholder:text-text-tertiary',
              'focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50'
            )}
          />
          <Tooltip content="Replace current match" position="top">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReplaceCurrent}
              onMouseDown={preventFocusLoss}
              disabled={matches.length === 0}
              className="h-8 px-2 sm:px-3"
            >
              Replace
            </Button>
          </Tooltip>
          <Tooltip content="Replace all matches" position="top">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReplaceAll}
              onMouseDown={preventFocusLoss}
              disabled={matches.length === 0}
              className="h-8 px-2 sm:px-3"
            >
              All
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
