import { useRef, useCallback, useMemo, useState, useEffect, memo, startTransition } from 'react';
import { CaretRight, CaretDown, Warning, XCircle } from '@phosphor-icons/react';
import { getTokenClass, type Token } from '@/lib/json/tokenizer';
import { parseJson, type ParseError } from '@/lib/json/parser';
import { findPathLine } from '@/lib/json/validator';
import { cn } from '@/lib/utils';
import { useActiveDocument, useUpdateActiveContent, useValidationErrors } from '@/store/documentStore';
import { useSearch } from '@/store/searchStore';
import { useEditor } from '@/store/editorStore';
import { useEditorSettings } from '@/store/settingsStore';
import { SearchBar, findMatches, type SearchMatch } from '@/components/editor/search/SearchBar';
import { Tooltip } from '@/components/ui/Tooltip';
import type { ValidationError } from '@/types';

// Line height in pixels (leading-6 = 1.5rem = 24px at 16px base)
const LINE_HEIGHT = 24;
// Number of extra lines to render above/below viewport for smooth scrolling
const OVERSCAN = 15;
// Minimum lines before enabling virtualization
const VIRTUALIZATION_THRESHOLD = 100;
// Size threshold for using web worker (bytes)
const WORKER_THRESHOLD = 10000;

// ============================================
// Global Token Cache - persists across view switches
// ============================================
interface CacheEntry {
  content: string;
  tokens: Token[];
  tokensByLine: Token[][];
  timestamp: number;
}

const tokenCache = new Map<string, CacheEntry>();

function getCachedTokens(docId: string, content: string): CacheEntry | null {
  const cached = tokenCache.get(docId);
  if (cached && cached.content === content) {
    return cached;
  }
  return null;
}

function setCachedTokens(docId: string, content: string, tokens: Token[], tokensByLine: Token[][]) {
  tokenCache.set(docId, {
    content,
    tokens,
    tokensByLine,
    timestamp: Date.now(),
  });
  
  // Limit cache size (keep last 10 documents)
  if (tokenCache.size > 10) {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [id, entry] of tokenCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldest = id;
      }
    }
    if (oldest) tokenCache.delete(oldest);
  }
}

// ============================================
// Tokenizer Worker
// ============================================
let tokenizerWorker: Worker | null = null;
let workerCallbacks = new Map<string, (tokens: Token[]) => void>();
let workerId = 0;

function getTokenizerWorker(): Worker {
  if (!tokenizerWorker) {
    tokenizerWorker = new Worker(
      new URL('../../../workers/tokenizer.worker.ts', import.meta.url),
      { type: 'module' }
    );
    tokenizerWorker.onmessage = (event) => {
      const { id, tokens } = event.data;
      const callback = workerCallbacks.get(id);
      if (callback) {
        callback(tokens);
        workerCallbacks.delete(id);
      }
    };
  }
  return tokenizerWorker;
}

function tokenizeInWorker(input: string): Promise<Token[]> {
  return new Promise((resolve) => {
    const id = `tok-${++workerId}`;
    const worker = getTokenizerWorker();
    workerCallbacks.set(id, resolve);
    worker.postMessage({ type: 'tokenize', id, input });
  });
}

// ============================================
// Fast synchronous tokenizer for small files
// ============================================
function tokenizeSync(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let column = 1;
  let expectKey = false;
  const contextStack: ('object' | 'array')[] = [];
  const len = input.length;

  while (pos < len) {
    const char = input[pos]!;

    // Whitespace
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      const start = pos;
      const startLine = line;
      const startColumn = column;

      while (pos < len) {
        const c = input[pos];
        if (c === ' ' || c === '\t') {
          column++;
          pos++;
        } else if (c === '\n') {
          line++;
          column = 1;
          pos++;
        } else if (c === '\r') {
          pos++;
        } else {
          break;
        }
      }

      tokens.push({
        type: 'whitespace',
        value: input.slice(start, pos),
        start,
        end: pos,
        line: startLine,
        column: startColumn,
      });
      continue;
    }

    // Single char tokens
    if (char === '{') {
      tokens.push({ type: 'brace-open', value: char, start: pos, end: pos + 1, line, column });
      contextStack.push('object');
      expectKey = true;
      pos++; column++;
      continue;
    }
    if (char === '}') {
      tokens.push({ type: 'brace-close', value: char, start: pos, end: pos + 1, line, column });
      contextStack.pop();
      expectKey = contextStack[contextStack.length - 1] === 'object';
      pos++; column++;
      continue;
    }
    if (char === '[') {
      tokens.push({ type: 'bracket-open', value: char, start: pos, end: pos + 1, line, column });
      contextStack.push('array');
      expectKey = false;
      pos++; column++;
      continue;
    }
    if (char === ']') {
      tokens.push({ type: 'bracket-close', value: char, start: pos, end: pos + 1, line, column });
      contextStack.pop();
      expectKey = contextStack[contextStack.length - 1] === 'object';
      pos++; column++;
      continue;
    }
    if (char === ':') {
      tokens.push({ type: 'colon', value: char, start: pos, end: pos + 1, line, column });
      expectKey = false;
      pos++; column++;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'comma', value: char, start: pos, end: pos + 1, line, column });
      expectKey = contextStack[contextStack.length - 1] === 'object';
      pos++; column++;
      continue;
    }

    // String
    if (char === '"') {
      const start = pos;
      const startLine = line;
      const startColumn = column;
      pos++; column++;

      while (pos < len) {
        const c = input[pos];
        if (c === '"') { pos++; column++; break; }
        if (c === '\\') { pos += 2; column += 2; continue; }
        if (c === '\n') break;
        pos++; column++;
      }

      const type = expectKey ? 'key' : 'string';
      if (expectKey) expectKey = false;
      tokens.push({ type, value: input.slice(start, pos), start, end: pos, line: startLine, column: startColumn });
      continue;
    }

    // Number
    if (char === '-' || (char >= '0' && char <= '9')) {
      const start = pos;
      const startLine = line;
      const startColumn = column;

      if (input[pos] === '-') { pos++; column++; }
      if (input[pos] === '0') { pos++; column++; }
      else {
        while (pos < len && input[pos]! >= '0' && input[pos]! <= '9') { pos++; column++; }
      }
      if (input[pos] === '.') {
        pos++; column++;
        while (pos < len && input[pos]! >= '0' && input[pos]! <= '9') { pos++; column++; }
      }
      if (input[pos] === 'e' || input[pos] === 'E') {
        pos++; column++;
        if (input[pos] === '+' || input[pos] === '-') { pos++; column++; }
        while (pos < len && input[pos]! >= '0' && input[pos]! <= '9') { pos++; column++; }
      }

      tokens.push({ type: 'number', value: input.slice(start, pos), start, end: pos, line: startLine, column: startColumn });
      expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }

    // Keywords
    if (char === 't' && input.slice(pos, pos + 4) === 'true') {
      tokens.push({ type: 'boolean', value: 'true', start: pos, end: pos + 4, line, column });
      pos += 4; column += 4;
      expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }
    if (char === 'f' && input.slice(pos, pos + 5) === 'false') {
      tokens.push({ type: 'boolean', value: 'false', start: pos, end: pos + 5, line, column });
      pos += 5; column += 5;
      expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }
    if (char === 'n' && input.slice(pos, pos + 4) === 'null') {
      tokens.push({ type: 'null', value: 'null', start: pos, end: pos + 4, line, column });
      pos += 4; column += 4;
      expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }

    // Error
    tokens.push({ type: 'error', value: char, start: pos, end: pos + 1, line, column });
    pos++; column++;
  }

  return tokens;
}

// Group tokens by line
function groupTokensByLine(tokens: Token[], lineCount: number): Token[][] {
  const grouped: Token[][] = Array(lineCount).fill(null).map(() => []);
  for (const token of tokens) {
    const lineIdx = token.line - 1;
    if (lineIdx >= 0 && lineIdx < grouped.length) {
      grouped[lineIdx]!.push(token);
    }
  }
  return grouped;
}

// Represents a foldable region in the document
interface FoldRegion {
  startLine: number;
  endLine: number;
  level: number;
}

function calculateFoldRegions(tokens: Token[]): FoldRegion[] {
  const regions: FoldRegion[] = [];
  const stack: { line: number; level: number }[] = [];
  let level = 0;

  for (const token of tokens) {
    if (token.type === 'brace-open' || token.type === 'bracket-open') {
      stack.push({ line: token.line, level });
      level++;
    } else if (token.type === 'brace-close' || token.type === 'bracket-close') {
      level = Math.max(0, level - 1);
      const start = stack.pop();
      if (start && token.line > start.line) {
        regions.push({ startLine: start.line, endLine: token.line, level: start.level });
      }
    }
  }

  return regions.sort((a, b) => a.startLine - b.startLine);
}

// ============================================
// Memoized Line Component
// ============================================

interface LineProps {
  lineIndex: number;
  lineText: string;
  lineTokens: Token[];
  lineStart: number;
  lineMatches: SearchMatch[];
  currentMatchIndex: number;
  searchMatches: SearchMatch[];
  isFolded: boolean;
  foldRegion: FoldRegion | undefined;
  hiddenLineCount: number;
  hasParseError: boolean;
  hasValidationError: boolean;
  isCurrentLine: boolean;
  isHighlighted: boolean;
  lineHeight: number;
  isVirtualized: boolean;
  isTokenized: boolean;
}

const HighlightedLine = memo(function HighlightedLine({
  lineIndex,
  lineText,
  lineTokens,
  lineStart,
  lineMatches,
  currentMatchIndex,
  searchMatches,
  isFolded,
  foldRegion,
  hiddenLineCount,
  hasParseError,
  hasValidationError,
  isCurrentLine,
  isHighlighted,
  lineHeight,
  isVirtualized,
  isTokenized,
}: LineProps) {
  // For folded regions, show summary
  if (isFolded && foldRegion) {
    const firstToken = lineTokens.find(t => t.type === 'brace-open' || t.type === 'bracket-open');
    const isArray = firstToken?.type === 'bracket-open';
    const closingChar = isArray ? ']' : '}';

    return (
      <div
        className={cn(
          'leading-6',
          hasParseError && 'bg-error/5',
          !hasParseError && hasValidationError && 'bg-warning/5',
          !hasParseError && !hasValidationError && isCurrentLine && 'bg-editor-line',
          isHighlighted && !hasParseError && !hasValidationError && 'animate-pulse bg-accent/20'
        )}
        style={isVirtualized ? { height: lineHeight } : undefined}
      >
        <span className="text-syntax-bracket">{lineText.trimEnd()}</span>
        <span className="text-text-muted mx-1">...{hiddenLineCount} lines...</span>
        <span className="text-syntax-bracket">{closingChar}</span>
      </div>
    );
  }

  // If not tokenized yet, show plain text (fast initial render)
  if (!isTokenized || lineTokens.length === 0) {
    return (
      <div
        className={cn(
          'leading-6',
          hasParseError && 'bg-error/5',
          !hasParseError && hasValidationError && 'bg-warning/5',
          !hasParseError && !hasValidationError && isCurrentLine && 'bg-editor-line',
          isHighlighted && !hasParseError && !hasValidationError && 'animate-pulse bg-accent/20'
        )}
        style={isVirtualized ? { height: lineHeight, contain: 'content' } : { contain: 'content' }}
      >
        <span>{lineText || '\n'}</span>
      </div>
    );
  }

  // Build spans from tokens
  const spans: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const token of lineTokens) {
    if (token.type === 'whitespace' && token.value.includes('\n')) {
      const parts = token.value.split('\n');
      const firstPart = parts[0];
      if (firstPart && token.line === lineIndex + 1) {
        spans.push(<span key={`ws-${token.start}`}>{firstPart}</span>);
      }
      continue;
    }

    const tokenClass = getTokenClass(token.type);
    const tokenStart = token.start - lineStart;
    const tokenEnd = token.end - lineStart;

    if (tokenStart > lastEnd && tokenStart <= lineText.length) {
      spans.push(<span key={`gap-${lastEnd}`}>{lineText.slice(lastEnd, tokenStart)}</span>);
    }

    if (tokenStart >= 0 && tokenEnd <= lineText.length) {
      spans.push(
        <span key={token.start} className={tokenClass}>
          {token.value}
        </span>
      );
      lastEnd = tokenEnd;
    }
  }

  if (lastEnd < lineText.length) {
    spans.push(<span key={`rest-${lastEnd}`}>{lineText.slice(lastEnd)}</span>);
  }

  let content: React.ReactNode = spans.length === 0 ? <span>{lineText || '\n'}</span> : <>{spans}</>;

  // Apply search highlights
  if (lineMatches.length > 0) {
    content = (
      <span className="relative">
        <span className="absolute inset-0">
          {lineMatches.map((match, idx) => {
            const matchStart = match.start - lineStart;
            const matchEnd = match.end - lineStart;
            const isCurrentMatch = searchMatches.indexOf(match) === currentMatchIndex;
            return (
              <span
                key={`match-${idx}`}
                className={cn('absolute h-full', isCurrentMatch ? 'bg-yellow-500/50' : 'bg-yellow-500/25')}
                style={{ left: `${matchStart}ch`, width: `${matchEnd - matchStart}ch` }}
              />
            );
          })}
        </span>
        <span className="relative">{content}</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        'leading-6',
        hasParseError && 'bg-error/5',
        !hasParseError && hasValidationError && 'bg-warning/5',
        !hasParseError && !hasValidationError && isCurrentLine && 'bg-editor-line',
        isHighlighted && !hasParseError && !hasValidationError && 'animate-pulse bg-accent/20'
      )}
      style={isVirtualized ? { height: lineHeight, contain: 'content' } : { contain: 'content' }}
    >
      {content}
    </div>
  );
});

// ============================================
// Memoized Line Number Component
// ============================================

interface LineNumberProps {
  lineIndex: number;
  isCurrentLine: boolean;
  hasError: boolean;
  hasWarning: boolean;
  isHighlighted: boolean;
  hasFold: boolean;
  isFolded: boolean;
  onToggleFold: (line: number) => void;
  onHoverStart: (line: number) => void;
  onHoverEnd: () => void;
  hoveredErrorLine: number | null;
  jsonError: ParseError | null;
  validationErrors: ValidationError[] | undefined;
  lineHeight: number;
  isVirtualized: boolean;
}

const LineNumber = memo(function LineNumber({
  lineIndex,
  isCurrentLine,
  hasError,
  hasWarning,
  isHighlighted,
  hasFold,
  isFolded,
  onToggleFold,
  onHoverStart,
  onHoverEnd,
  hoveredErrorLine,
  jsonError,
  validationErrors,
  lineHeight,
  isVirtualized,
}: LineNumberProps) {
  const lineNum = lineIndex + 1;

  return (
    <div
      className={cn(
        'flex items-center leading-6 relative',
        hasError && 'bg-error/10',
        hasWarning && 'bg-warning/10',
        !hasError && !hasWarning && isCurrentLine && 'bg-editor-line',
        isHighlighted && !hasError && !hasWarning && 'animate-pulse bg-accent/20'
      )}
      style={isVirtualized ? { height: lineHeight, contain: 'content' } : { contain: 'content' }}
      onMouseEnter={() => (hasError || hasWarning) && onHoverStart(lineNum)}
      onMouseLeave={onHoverEnd}
    >
      {hasError && <div className="absolute left-0 w-1 h-full bg-error" />}
      {hasWarning && <div className="absolute left-0 w-1 h-full bg-warning" />}

      <div className="w-4 flex items-center justify-center ml-1">
        {hasError ? (
          <XCircle className="w-3.5 h-3.5 text-error" weight="fill" />
        ) : hasWarning ? (
          <Warning className="w-3.5 h-3.5 text-warning" weight="fill" />
        ) : hasFold ? (
          <button
            onClick={() => onToggleFold(lineNum)}
            className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-secondary"
            title={isFolded ? 'Expand' : 'Collapse'}
          >
            {isFolded ? <CaretRight className="w-3 h-3" /> : <CaretDown className="w-3 h-3" />}
          </button>
        ) : null}
      </div>

      <div
        onClick={hasFold ? () => onToggleFold(lineNum) : undefined}
        className={cn(
          'px-2 text-right text-editor-gutter-text min-w-[2rem]',
          hasError && 'text-error font-medium',
          hasWarning && 'text-warning font-medium',
          !hasError && !hasWarning && isCurrentLine && 'text-text-secondary',
          hasFold && 'cursor-pointer hover:text-text-primary'
        )}
      >
        {lineNum}
      </div>

      {hasError && hoveredErrorLine === lineNum && jsonError && (
        <div className="absolute left-full ml-2 top-0 z-50 px-3 py-2 bg-bg-elevated border border-error/50 rounded-md shadow-lg max-w-md whitespace-normal">
          <div className="text-xs font-medium text-error mb-1">JSON Syntax Error</div>
          <div className="text-xs text-text-secondary">Line {jsonError.line}, Column {jsonError.column}</div>
          <div className="text-xs text-text-primary mt-1">{jsonError.message}</div>
        </div>
      )}

      {hasWarning && hoveredErrorLine === lineNum && validationErrors && (
        <div className="absolute left-full ml-2 top-0 z-50 px-3 py-2 bg-bg-elevated border border-warning/50 rounded-md shadow-lg max-w-md whitespace-normal">
          <div className="text-xs font-medium text-warning mb-1">
            Schema Validation {validationErrors.length === 1 ? 'Error' : `Errors (${validationErrors.length})`}
          </div>
          <div className="space-y-1.5">
            {validationErrors.map((err, idx) => (
              <div key={idx} className="text-xs">
                <div className="text-text-primary">{err.message}</div>
                <div className="text-text-muted font-mono">{err.path || '/'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================
// Main TextEditor Component
// ============================================

export function TextEditor() {
  const doc = useActiveDocument();
  const updateContent = useUpdateActiveContent();
  const editorSettings = useEditorSettings();
  const { state: editorState, clearEvent } = useEditor();
  const validationErrors = useValidationErrors();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [hoveredErrorLine, setHoveredErrorLine] = useState<number | null>(null);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [foldedLines, setFoldedLines] = useState<Set<number>>(new Set());

  // Search state
  const { state: searchState, closeSearch, setMatches } = useSearch();
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const content = doc?.content ?? '';
  const docId = doc?.id ?? '';
  const { lineWrapping } = editorSettings;

  // Refs for scroll sync
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const scrollRAFRef = useRef<number | null>(null);

  // ============================================
  // Progressive Tokenization State
  // ============================================
  const [tokens, setTokens] = useState<Token[]>([]);
  const [tokensByLine, setTokensByLine] = useState<Token[][]>([]);
  const [isTokenized, setIsTokenized] = useState(false);
  const tokenizationRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Split content into lines immediately (this is fast)
  const lines = useMemo(() => content.split('\n'), [content]);

  // Check cache first, then tokenize
  useEffect(() => {
    if (!content || !docId) {
      setTokens([]);
      setTokensByLine([]);
      setIsTokenized(true);
      return;
    }

    // Check cache first - instant if cached
    const cached = getCachedTokens(docId, content);
    if (cached) {
      setTokens(cached.tokens);
      setTokensByLine(cached.tokensByLine);
      setIsTokenized(true);
      return;
    }

    // Mark as not tokenized (will show plain text)
    setIsTokenized(false);
    tokenizationRef.current.cancelled = false;

    // For small files, tokenize synchronously on main thread
    if (content.length < WORKER_THRESHOLD) {
      const newTokens = tokenizeSync(content);
      const newTokensByLine = groupTokensByLine(newTokens, lines.length);
      setTokens(newTokens);
      setTokensByLine(newTokensByLine);
      setIsTokenized(true);
      setCachedTokens(docId, content, newTokens, newTokensByLine);
      return;
    }

    // For large files, use web worker
    tokenizeInWorker(content).then((newTokens) => {
      if (tokenizationRef.current.cancelled) return;
      
      startTransition(() => {
        const newTokensByLine = groupTokensByLine(newTokens, lines.length);
        setTokens(newTokens);
        setTokensByLine(newTokensByLine);
        setIsTokenized(true);
        setCachedTokens(docId, content, newTokens, newTokensByLine);
      });
    });

    return () => {
      tokenizationRef.current.cancelled = true;
    };
  }, [content, docId, lines.length]);

  // Parse JSON to detect errors
  const parseResult = useMemo(() => parseJson(content), [content]);
  const jsonError: ParseError | null = parseResult.error;

  // Map validation errors to line numbers
  const validationErrorsByLine = useMemo(() => {
    const errorMap = new Map<number, ValidationError[]>();
    for (const error of validationErrors) {
      const lineNum = findPathLine(content, error.path);
      if (lineNum !== null) {
        const existing = errorMap.get(lineNum) ?? [];
        existing.push(error);
        errorMap.set(lineNum, existing);
      }
    }
    return errorMap;
  }, [validationErrors, content]);

  // Calculate fold regions from tokens
  const foldRegions = useMemo(() => calculateFoldRegions(tokens), [tokens]);

  const foldRegionMap = useMemo(() => {
    const map = new Map<number, FoldRegion>();
    for (const region of foldRegions) {
      map.set(region.startLine, region);
    }
    return map;
  }, [foldRegions]);

  const isLineHidden = useCallback(
    (lineNum: number): boolean => {
      for (const foldedLine of foldedLines) {
        const region = foldRegionMap.get(foldedLine);
        if (region && lineNum > region.startLine && lineNum <= region.endLine) {
          return true;
        }
      }
      return false;
    },
    [foldedLines, foldRegionMap]
  );

  const toggleFold = useCallback((startLine: number) => {
    setFoldedLines((prev) => {
      const next = new Set(prev);
      if (next.has(startLine)) next.delete(startLine);
      else next.add(startLine);
      return next;
    });
  }, []);

  const foldAll = useCallback(() => {
    setFoldedLines(new Set(foldRegions.map((r) => r.startLine)));
  }, [foldRegions]);

  const unfoldAll = useCallback(() => {
    setFoldedLines(new Set());
  }, []);

  // Get line start positions
  const lineStartPositions = useMemo(() => {
    const positions: number[] = [0];
    let pos = 0;
    for (const line of lines) {
      pos += line.length + 1;
      positions.push(pos);
    }
    return positions;
  }, [lines]);

  // Navigate to a specific line
  const goToLine = useCallback(
    (line: number, column: number = 0) => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      const lineStart = lineStartPositions[line - 1] ?? 0;
      const position = lineStart + column;

      textarea.selectionStart = position;
      textarea.selectionEnd = position;
      textarea.focus();

      const targetScrollTop = Math.max(0, (line - 5) * LINE_HEIGHT);
      textarea.scrollTop = targetScrollTop;
      if (highlightRef.current) highlightRef.current.scrollTop = targetScrollTop;
      if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = targetScrollTop;

      setCursorLine(line);
      setCursorColumn(column);
      setHighlightedLine(line);
      setTimeout(() => setHighlightedLine(null), 1500);
    },
    [lineStartPositions]
  );

  // Handle editor events
  useEffect(() => {
    if (!editorState.pendingEvent) return;
    const event = editorState.pendingEvent;

    if (event.type === 'goToError' && jsonError) {
      goToLine(jsonError.line, jsonError.column);
      clearEvent();
    } else if (event.type === 'goToLine' && event.payload) {
      goToLine(event.payload.line, event.payload.column ?? 0);
      clearEvent();
    } else if (event.type === 'focusEditor') {
      textareaRef.current?.focus();
      clearEvent();
    }
  }, [editorState.pendingEvent, jsonError, goToLine, clearEvent]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateContent(e.target.value);
    },
    [updateContent]
  );

  const handleSelect = useCallback(() => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;

    // Binary search for line
    let low = 0;
    let high = lineStartPositions.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      if (lineStartPositions[mid]! <= pos) low = mid;
      else high = mid - 1;
    }

    setCursorLine(low + 1);
    setCursorColumn(pos - (lineStartPositions[low] ?? 0));
  }, [lineStartPositions]);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  const handleScroll = useCallback(() => {
    if (scrollRAFRef.current !== null) cancelAnimationFrame(scrollRAFRef.current);

    scrollRAFRef.current = requestAnimationFrame(() => {
      if (textareaRef.current) {
        const currentScrollTop = textareaRef.current.scrollTop;
        const currentScrollLeft = textareaRef.current.scrollLeft;
        setScrollTop(currentScrollTop);

        if (highlightRef.current) {
          highlightRef.current.scrollTop = currentScrollTop;
          highlightRef.current.scrollLeft = currentScrollLeft;
        }
        if (lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = currentScrollTop;
        }
      }
      scrollRAFRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollRAFRef.current !== null) cancelAnimationFrame(scrollRAFRef.current);
    };
  }, []);

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          const lineStart = value.lastIndexOf('\n', start - 1) + 1;
          const lineContent = value.slice(lineStart, start);
          const spacesToRemove = lineContent.match(/^( {1,2})/)?.[1]?.length ?? 0;
          if (spacesToRemove > 0) {
            const newValue = value.slice(0, lineStart) + value.slice(lineStart + spacesToRemove);
            updateContent(newValue);
            requestAnimationFrame(() => {
              textarea.selectionStart = textarea.selectionEnd = start - spacesToRemove;
            });
          }
        } else {
          const newValue = value.slice(0, start) + '  ' + value.slice(end);
          updateContent(newValue);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 2;
          });
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineContent = value.slice(lineStart, start);
        const currentIndent = lineContent.match(/^(\s*)/)?.[1] ?? '';
        const charBefore = value.slice(0, start).trimEnd().slice(-1);
        const charAfter = value.slice(end).trimStart().charAt(0);

        let newIndent = currentIndent;
        let extraText = '';

        if (charBefore === '{' || charBefore === '[') {
          newIndent = currentIndent + '  ';
          if ((charBefore === '{' && charAfter === '}') || (charBefore === '[' && charAfter === ']')) {
            extraText = '\n' + currentIndent;
          }
        }

        const newValue = value.slice(0, start) + '\n' + newIndent + extraText + value.slice(end);
        updateContent(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1 + newIndent.length;
        });
        return;
      }

      if (editorSettings.autoCloseBrackets) {
        const bracketPairs: Record<string, string> = { '{': '}', '[': ']', '"': '"' };
        if (bracketPairs[e.key]) {
          const charAfterCursor = value.charAt(end);
          if (charAfterCursor && !/[\s\}\]\,\:]/.test(charAfterCursor)) return;
          if (e.key === '"' && /[a-zA-Z0-9]/.test(value.charAt(start - 1))) return;

          e.preventDefault();
          const newValue = value.slice(0, start) + e.key + bracketPairs[e.key] + value.slice(end);
          updateContent(newValue);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 1;
          });
          return;
        }

        if (['}', ']', '"'].includes(e.key) && value.charAt(start) === e.key) {
          e.preventDefault();
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 1;
          });
          return;
        }
      }

      if (e.key === 'Backspace' && start === end && start > 0) {
        const charBefore = value.charAt(start - 1);
        const charAfter = value.charAt(start);
        const emptyPairs = [['(', ')'], ['{', '}'], ['[', ']'], ['"', '"']];
        for (const [open, close] of emptyPairs) {
          if (charBefore === open && charAfter === close) {
            e.preventDefault();
            const newValue = value.slice(0, start - 1) + value.slice(start + 1);
            updateContent(newValue);
            requestAnimationFrame(() => {
              textarea.selectionStart = textarea.selectionEnd = start - 1;
            });
            return;
          }
        }
      }
    },
    [updateContent, editorSettings.autoCloseBrackets]
  );

  const handleMatchesChange = useCallback(
    (matches: SearchMatch[], currentIndex: number) => {
      setSearchMatches(matches);
      setCurrentMatchIndex(currentIndex);
      setMatches(matches, currentIndex);

      // Only scroll to show the match, don't steal focus from search input
      if (matches.length > 0 && textareaRef.current) {
        const match = matches[currentIndex];
        if (match) {
          const scrollTopValue = (match.line - 5) * LINE_HEIGHT;
          textareaRef.current.scrollTop = Math.max(0, scrollTopValue);
          if (highlightRef.current) highlightRef.current.scrollTop = Math.max(0, scrollTopValue);
          if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = Math.max(0, scrollTopValue);
        }
      }
    },
    [setMatches]
  );

  const handleReplace = useCallback(
    (searchText: string, replaceText: string, replaceAll: boolean) => {
      if (!searchText) return;
      try {
        if (replaceAll) {
          const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, 'gi');
          updateContent(content.replace(regex, replaceText));
        } else {
          const matches = findMatches(content, searchText, false, false);
          if (matches.length > 0 && currentMatchIndex < matches.length) {
            const match = matches[currentMatchIndex];
            if (match) {
              updateContent(content.slice(0, match.start) + replaceText + content.slice(match.end));
            }
          }
        }
      } catch {
        // Invalid regex
      }
    },
    [content, currentMatchIndex, updateContent]
  );

  const matchesByLine = useMemo(() => {
    const map = new Map<number, SearchMatch[]>();
    for (const match of searchMatches) {
      const lineIdx = match.line - 1;
      if (!map.has(lineIdx)) map.set(lineIdx, []);
      map.get(lineIdx)!.push(match);
    }
    return map;
  }, [searchMatches]);

  const visibleLineIndices = useMemo(() => {
    const visible: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!isLineHidden(i + 1)) visible.push(i);
    }
    return visible;
  }, [lines.length, isLineHidden]);

  const { renderedLineIndices, startOffset, totalHeight, isVirtualized } = useMemo(() => {
    const total = visibleLineIndices.length;
    const totalHeight = total * LINE_HEIGHT;
    const shouldVirtualize = total > VIRTUALIZATION_THRESHOLD && containerHeight > 0;

    if (!shouldVirtualize) {
      return { renderedLineIndices: visibleLineIndices, startOffset: 0, totalHeight, isVirtualized: false };
    }

    const startLine = Math.floor(scrollTop / LINE_HEIGHT);
    const visibleCount = Math.ceil(containerHeight / LINE_HEIGHT);
    const renderStart = Math.max(0, startLine - OVERSCAN);
    const renderEnd = Math.min(total, startLine + visibleCount + OVERSCAN);

    return {
      renderedLineIndices: visibleLineIndices.slice(renderStart, renderEnd),
      startOffset: renderStart * LINE_HEIGHT,
      totalHeight,
      isVirtualized: true,
    };
  }, [visibleLineIndices, scrollTop, containerHeight]);

  useEffect(() => {
    const container = textareaRef.current?.parentElement;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerHeight(entry.contentRect.height);
    });
    observer.observe(container);
    setContainerHeight(container.clientHeight);

    return () => observer.disconnect();
  }, []);

  const handleHoverStart = useCallback((line: number) => setHoveredErrorLine(line), []);
  const handleHoverEnd = useCallback(() => setHoveredErrorLine(null), []);

  return (
    <div
      className="flex h-full bg-editor-bg relative"
      style={{
        fontFamily: 'var(--editor-font-family, "Geist Mono", monospace)',
        fontSize: 'var(--editor-font-size, 13px)',
        contain: 'strict',
      }}
    >
      <SearchBar
        content={content}
        isOpen={searchState.isOpen}
        showReplace={searchState.showReplace}
        onClose={closeSearch}
        onReplace={handleReplace}
        onMatchesChange={handleMatchesChange}
      />

      {foldRegions.length > 0 && (
        <div className="absolute top-0 right-4 z-10 flex gap-1 p-1 bg-bg-surface/80 backdrop-blur rounded-b border border-t-0 border-border-subtle">
          <Tooltip content="Collapse all foldable regions" position="bottom">
            <button onClick={foldAll} className="px-2 py-0.5 text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded">
              Fold All
            </button>
          </Tooltip>
          <Tooltip content="Expand all folded regions" position="bottom">
            <button onClick={unfoldAll} className="px-2 py-0.5 text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded">
              Unfold All
            </button>
          </Tooltip>
        </div>
      )}

      {/* Line Numbers */}
      <div
        ref={lineNumbersRef}
        className={cn('flex-shrink-0 bg-editor-gutter border-r border-border-subtle select-none', isVirtualized ? 'overflow-hidden' : 'overflow-auto')}
        style={{ contain: 'strict' }}
      >
        <div className={isVirtualized ? '' : 'py-2'} style={isVirtualized ? { height: totalHeight + 16, position: 'relative' } : undefined}>
          <div className={isVirtualized ? 'absolute left-0 right-0' : ''} style={isVirtualized ? { top: startOffset + 8, willChange: 'transform' } : undefined}>
            {renderedLineIndices.map((lineIndex) => {
              const lineNum = lineIndex + 1;
              const foldRegion = foldRegionMap.get(lineNum);
              const isFolded = foldedLines.has(lineNum);
              const hasFold = Boolean(foldRegion);
              const hasParseError = jsonError?.line === lineNum;
              const lineValidationErrors = validationErrorsByLine.get(lineNum);
              const hasValidationError = lineValidationErrors && lineValidationErrors.length > 0;

              return (
                <LineNumber
                  key={lineIndex}
                  lineIndex={lineIndex}
                  isCurrentLine={lineNum === cursorLine}
                  hasError={hasParseError}
                  hasWarning={hasValidationError ?? false}
                  isHighlighted={highlightedLine === lineNum}
                  hasFold={hasFold}
                  isFolded={isFolded}
                  onToggleFold={toggleFold}
                  onHoverStart={handleHoverStart}
                  onHoverEnd={handleHoverEnd}
                  hoveredErrorLine={hoveredErrorLine}
                  jsonError={jsonError}
                  validationErrors={lineValidationErrors}
                  lineHeight={LINE_HEIGHT}
                  isVirtualized={isVirtualized}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative overflow-hidden" style={{ contain: 'strict' }}>
        {/* Syntax Highlighted Overlay */}
        <div
          ref={highlightRef}
          className={cn('absolute inset-0 pointer-events-none', isVirtualized ? 'overflow-hidden' : 'overflow-auto', lineWrapping ? 'whitespace-pre-wrap break-words' : 'whitespace-pre')}
          aria-hidden="true"
          style={{ contain: 'strict' }}
        >
          <div className={isVirtualized ? '' : 'py-2 px-4'} style={isVirtualized ? { height: totalHeight + 16, position: 'relative' } : undefined}>
            <div className={isVirtualized ? 'absolute left-0 right-0 px-4' : ''} style={isVirtualized ? { top: startOffset + 8, willChange: 'transform' } : undefined}>
              {renderedLineIndices.map((lineIndex) => {
                const lineNum = lineIndex + 1;
                const hasParseError = jsonError?.line === lineNum;
                const hasValidationError = validationErrorsByLine.has(lineNum);
                const foldRegion = foldRegionMap.get(lineNum);
                const isFolded = foldedLines.has(lineNum);
                const hiddenLineCount = foldRegion ? foldRegion.endLine - foldRegion.startLine : 0;

                return (
                  <HighlightedLine
                    key={lineIndex}
                    lineIndex={lineIndex}
                    lineText={lines[lineIndex] ?? ''}
                    lineTokens={tokensByLine[lineIndex] ?? []}
                    lineStart={lineStartPositions[lineIndex] ?? 0}
                    lineMatches={matchesByLine.get(lineIndex) ?? []}
                    currentMatchIndex={currentMatchIndex}
                    searchMatches={searchMatches}
                    isFolded={isFolded}
                    foldRegion={foldRegion}
                    hiddenLineCount={hiddenLineCount}
                    hasParseError={hasParseError}
                    hasValidationError={hasValidationError}
                    isCurrentLine={lineNum === cursorLine}
                    isHighlighted={highlightedLine === lineNum}
                    lineHeight={LINE_HEIGHT}
                    isVirtualized={isVirtualized}
                    isTokenized={isTokenized}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Custom cursor */}
        {isFocused && !lineWrapping && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: `calc(1rem + ${cursorColumn}ch)`,
              top: `calc(0.5rem + ${(cursorLine - 1) * 1.5}rem - ${scrollTop}px)`,
              width: '2px',
              height: '1.5rem',
              backgroundColor: 'var(--accent, #3B82F6)',
              animation: 'cursor-blink 1s step-end infinite',
            }}
          />
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onScroll={handleScroll}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          onClick={handleSelect}
          onFocus={handleFocus}
          onBlur={handleBlur}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap={lineWrapping ? 'soft' : 'off'}
          className={cn(
            'absolute inset-0 w-full h-full py-2 px-4',
            'bg-transparent text-transparent',
            'resize-none outline-none leading-6',
            'selection:bg-accent/20 selection:text-transparent',
            lineWrapping ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
          )}
          style={{ caretColor: lineWrapping ? 'var(--accent, #3B82F6)' : 'transparent' }}
        />
      </div>
    </div>
  );
}
