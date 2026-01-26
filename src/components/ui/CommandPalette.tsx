import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface Command {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  category: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter and sort commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) {
      return commands;
    }

    const searchLower = search.toLowerCase();

    return commands
      .filter((cmd) => {
        const labelMatch = cmd.label.toLowerCase().includes(searchLower);
        const descMatch = cmd.description?.toLowerCase().includes(searchLower);
        const categoryMatch = cmd.category.toLowerCase().includes(searchLower);
        const keywordMatch = cmd.keywords?.some((kw) =>
          kw.toLowerCase().includes(searchLower)
        );

        return labelMatch || descMatch || categoryMatch || keywordMatch;
      })
      .sort((a, b) => {
        // Exact matches first
        const aExact = a.label.toLowerCase() === searchLower;
        const bExact = b.label.toLowerCase() === searchLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Starts with matches next
        const aStarts = a.label.toLowerCase().startsWith(searchLower);
        const bStarts = b.label.toLowerCase().startsWith(searchLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Then alphabetical
        return a.label.localeCompare(b.label);
      });
  }, [commands, search]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups = new Map<string, Command[]>();

    filteredCommands.forEach((cmd) => {
      const existing = groups.get(cmd.category) || [];
      groups.set(cmd.category, [...existing, cmd]);
    });

    return Array.from(groups.entries()).map(([category, cmds]) => ({
      category,
      commands: cmds,
    }));
  }, [filteredCommands]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;

    const selectedElement = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    );

    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const command = filteredCommands[selectedIndex];
        if (command) {
          command.action();
          onClose();
        }
        return;
      }

      // Ctrl/Cmd + number for quick access
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const command = filteredCommands[index];
        if (command) {
          command.action();
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, filteredCommands, selectedIndex]);

  const handleCommandClick = useCallback((command: Command) => {
    command.action();
    onClose();
  }, [onClose]);

  // Handle search change - reset selected index and update search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setSelectedIndex(0);
  }, []);

  // Reset state when modal opens/closes
  if (!isOpen) {
    // Reset state when closed (outside of render cycle)
    if (search !== '' || selectedIndex !== 0) {
      setTimeout(() => {
        setSearch('');
        setSelectedIndex(0);
      }, 200); // Wait for close animation
    }
    return null;
  }

  let commandIndex = 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] sm:pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div
        className={cn(
          'relative w-full max-w-2xl bg-bg-elevated shadow-2xl',
          'border border-border-default rounded-lg overflow-hidden',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-default">
          <MagnifyingGlass className="w-5 h-5 text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted"
          />
          <kbd className="hidden sm:inline-flex px-2 py-1 text-xs font-mono text-text-muted bg-bg-surface border border-border-subtle rounded">
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div
          ref={listRef}
          className="overflow-y-auto max-h-[60vh] sm:max-h-96"
        >
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-text-muted">
              No commands found for "{search}"
            </div>
          ) : (
            groupedCommands.map((group) => (
              <div key={group.category}>
                {/* Category Header */}
                <div className="px-4 py-2 text-xs font-medium text-text-muted bg-bg-surface/50 sticky top-0">
                  {group.category}
                </div>

                {/* Commands in Category */}
                {group.commands.map((command) => {
                  const currentIndex = commandIndex++;
                  const isSelected = currentIndex === selectedIndex;

                  return (
                    <button
                      key={command.id}
                      data-index={currentIndex}
                      onClick={() => handleCommandClick(command)}
                      className={cn(
                        'w-full px-4 py-2.5 flex items-center gap-3 transition-colors text-left',
                        isSelected
                          ? 'bg-accent/10 border-l-2 border-accent'
                          : 'hover:bg-bg-hover border-l-2 border-transparent'
                      )}
                    >
                      {/* Icon */}
                      {command.icon && (
                        <div className={cn(
                          'w-5 h-5 flex items-center justify-center flex-shrink-0',
                          isSelected ? 'text-accent' : 'text-text-muted'
                        )}>
                          {command.icon}
                        </div>
                      )}

                      {/* Label & Description */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary">
                          {command.label}
                        </div>
                        {command.description && (
                          <div className="text-xs text-text-muted truncate">
                            {command.description}
                          </div>
                        )}
                      </div>

                      {/* Shortcut */}
                      {command.shortcut && (
                        <kbd className="hidden sm:inline-flex px-2 py-1 text-xs font-mono text-text-muted bg-bg-surface border border-border-subtle rounded flex-shrink-0">
                          {command.shortcut}
                        </kbd>
                      )}

                      {/* Selection Indicator */}
                      {isSelected && (
                        <CaretRight className="w-4 h-4 text-accent flex-shrink-0" weight="bold" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer Hints */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-border-default bg-bg-surface/50 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-bg-surface border border-border-subtle rounded">↑</kbd>
            <kbd className="px-1.5 py-0.5 font-mono bg-bg-surface border border-border-subtle rounded">↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-bg-surface border border-border-subtle rounded">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-bg-surface border border-border-subtle rounded">ESC</kbd>
            Close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

