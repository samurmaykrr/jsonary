/**
 * Tokenizer Worker
 * Offloads JSON tokenization to a separate thread for large documents
 * Supports progressive/chunked tokenization for immediate UI responsiveness
 */

export type TokenType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'key'
  | 'brace-open'
  | 'brace-close'
  | 'bracket-open'
  | 'bracket-close'
  | 'colon'
  | 'comma'
  | 'whitespace'
  | 'error';

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

interface TokenizerState {
  pos: number;
  line: number;
  column: number;
  expectKey: boolean;
}

// Message types
interface TokenizeMessage {
  type: 'tokenize';
  id: string;
  input: string;
  startLine?: number; // For chunked tokenization
  endLine?: number;
}

interface TokenizeChunkMessage {
  type: 'tokenize-chunk';
  id: string;
  input: string;
  chunkIndex: number;
  chunkSize: number;
}

interface TokenizeResponse {
  type: 'tokenize-result';
  id: string;
  tokens: Token[];
  totalLines: number;
}

interface TokenizeChunkResponse {
  type: 'tokenize-chunk-result';
  id: string;
  tokens: Token[];
  chunkIndex: number;
  hasMore: boolean;
  progress: number; // 0-1
}

type WorkerMessage = TokenizeMessage | TokenizeChunkMessage;

/**
 * Fast tokenizer optimized for large files
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const state: TokenizerState = {
    pos: 0,
    line: 1,
    column: 1,
    expectKey: false,
  };
  
  const contextStack: ('object' | 'array')[] = [];
  const len = input.length;
  
  while (state.pos < len) {
    const char = input[state.pos]!;
    
    // Whitespace - optimized to batch
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      const start = state.pos;
      const startLine = state.line;
      const startColumn = state.column;
      
      while (state.pos < len) {
        const c = input[state.pos];
        if (c === ' ' || c === '\t') {
          state.column++;
          state.pos++;
        } else if (c === '\n') {
          state.line++;
          state.column = 1;
          state.pos++;
        } else if (c === '\r') {
          state.pos++;
        } else {
          break;
        }
      }
      
      tokens.push({
        type: 'whitespace',
        value: input.slice(start, state.pos),
        start,
        end: state.pos,
        line: startLine,
        column: startColumn,
      });
      continue;
    }
    
    // Opening brace
    if (char === '{') {
      tokens.push({
        type: 'brace-open',
        value: char,
        start: state.pos,
        end: state.pos + 1,
        line: state.line,
        column: state.column,
      });
      contextStack.push('object');
      state.expectKey = true;
      state.pos++;
      state.column++;
      continue;
    }
    
    // Closing brace
    if (char === '}') {
      tokens.push({
        type: 'brace-close',
        value: char,
        start: state.pos,
        end: state.pos + 1,
        line: state.line,
        column: state.column,
      });
      contextStack.pop();
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      state.pos++;
      state.column++;
      continue;
    }
    
    // Opening bracket
    if (char === '[') {
      tokens.push({
        type: 'bracket-open',
        value: char,
        start: state.pos,
        end: state.pos + 1,
        line: state.line,
        column: state.column,
      });
      contextStack.push('array');
      state.expectKey = false;
      state.pos++;
      state.column++;
      continue;
    }
    
    // Closing bracket
    if (char === ']') {
      tokens.push({
        type: 'bracket-close',
        value: char,
        start: state.pos,
        end: state.pos + 1,
        line: state.line,
        column: state.column,
      });
      contextStack.pop();
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      state.pos++;
      state.column++;
      continue;
    }
    
    // Colon
    if (char === ':') {
      tokens.push({
        type: 'colon',
        value: char,
        start: state.pos,
        end: state.pos + 1,
        line: state.line,
        column: state.column,
      });
      state.expectKey = false;
      state.pos++;
      state.column++;
      continue;
    }
    
    // Comma
    if (char === ',') {
      tokens.push({
        type: 'comma',
        value: char,
        start: state.pos,
        end: state.pos + 1,
        line: state.line,
        column: state.column,
      });
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      state.pos++;
      state.column++;
      continue;
    }
    
    // String
    if (char === '"') {
      const start = state.pos;
      const startLine = state.line;
      const startColumn = state.column;
      
      state.pos++;
      state.column++;
      
      while (state.pos < len) {
        const c = input[state.pos];
        if (c === '"') {
          state.pos++;
          state.column++;
          break;
        }
        if (c === '\\') {
          state.pos += 2;
          state.column += 2;
          continue;
        }
        if (c === '\n') break;
        state.pos++;
        state.column++;
      }
      
      const type = state.expectKey ? 'key' : 'string';
      if (state.expectKey) state.expectKey = false;
      
      tokens.push({
        type,
        value: input.slice(start, state.pos),
        start,
        end: state.pos,
        line: startLine,
        column: startColumn,
      });
      continue;
    }
    
    // Number
    if (char === '-' || (char >= '0' && char <= '9')) {
      const start = state.pos;
      const startLine = state.line;
      const startColumn = state.column;
      
      if (input[state.pos] === '-') {
        state.pos++;
        state.column++;
      }
      
      // Integer part
      if (input[state.pos] === '0') {
        state.pos++;
        state.column++;
      } else {
        while (state.pos < len && input[state.pos]! >= '0' && input[state.pos]! <= '9') {
          state.pos++;
          state.column++;
        }
      }
      
      // Decimal
      if (input[state.pos] === '.') {
        state.pos++;
        state.column++;
        while (state.pos < len && input[state.pos]! >= '0' && input[state.pos]! <= '9') {
          state.pos++;
          state.column++;
        }
      }
      
      // Exponent
      if (input[state.pos] === 'e' || input[state.pos] === 'E') {
        state.pos++;
        state.column++;
        if (input[state.pos] === '+' || input[state.pos] === '-') {
          state.pos++;
          state.column++;
        }
        while (state.pos < len && input[state.pos]! >= '0' && input[state.pos]! <= '9') {
          state.pos++;
          state.column++;
        }
      }
      
      tokens.push({
        type: 'number',
        value: input.slice(start, state.pos),
        start,
        end: state.pos,
        line: startLine,
        column: startColumn,
      });
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }
    
    // true
    if (char === 't' && input.slice(state.pos, state.pos + 4) === 'true') {
      tokens.push({
        type: 'boolean',
        value: 'true',
        start: state.pos,
        end: state.pos + 4,
        line: state.line,
        column: state.column,
      });
      state.pos += 4;
      state.column += 4;
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }
    
    // false
    if (char === 'f' && input.slice(state.pos, state.pos + 5) === 'false') {
      tokens.push({
        type: 'boolean',
        value: 'false',
        start: state.pos,
        end: state.pos + 5,
        line: state.line,
        column: state.column,
      });
      state.pos += 5;
      state.column += 5;
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }
    
    // null
    if (char === 'n' && input.slice(state.pos, state.pos + 4) === 'null') {
      tokens.push({
        type: 'null',
        value: 'null',
        start: state.pos,
        end: state.pos + 4,
        line: state.line,
        column: state.column,
      });
      state.pos += 4;
      state.column += 4;
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }
    
    // Error token
    tokens.push({
      type: 'error',
      value: char,
      start: state.pos,
      end: state.pos + 1,
      line: state.line,
      column: state.column,
    });
    state.pos++;
    state.column++;
  }
  
  return tokens;
}

/**
 * Tokenize a specific range of lines (for chunked processing)
 */
function tokenizeLineRange(input: string, startLine: number, endLine: number): Token[] {
  // Find line boundaries
  let lineStart = 0;
  let currentLine = 1;
  
  // Find start position
  while (currentLine < startLine && lineStart < input.length) {
    if (input[lineStart] === '\n') {
      currentLine++;
    }
    lineStart++;
  }
  
  // Find end position
  let lineEnd = lineStart;
  while (currentLine <= endLine && lineEnd < input.length) {
    if (input[lineEnd] === '\n') {
      currentLine++;
    }
    lineEnd++;
  }
  
  // Tokenize the chunk
  const chunk = input.slice(lineStart, lineEnd);
  const tokens = tokenize(chunk);
  
  // Adjust token positions
  for (const token of tokens) {
    token.start += lineStart;
    token.end += lineStart;
    token.line += startLine - 1;
  }
  
  return tokens;
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  
  switch (message.type) {
    case 'tokenize': {
      const tokens = tokenize(message.input);
      const totalLines = message.input.split('\n').length;
      
      const response: TokenizeResponse = {
        type: 'tokenize-result',
        id: message.id,
        tokens,
        totalLines,
      };
      self.postMessage(response);
      break;
    }
    
    case 'tokenize-chunk': {
      const { input, chunkIndex, chunkSize, id } = message;
      const lines = input.split('\n');
      const totalLines = lines.length;
      const startLine = chunkIndex * chunkSize + 1;
      const endLine = Math.min(startLine + chunkSize - 1, totalLines);
      
      const tokens = tokenizeLineRange(input, startLine, endLine);
      const hasMore = endLine < totalLines;
      const progress = endLine / totalLines;
      
      const response: TokenizeChunkResponse = {
        type: 'tokenize-chunk-result',
        id,
        tokens,
        chunkIndex,
        hasMore,
        progress,
      };
      self.postMessage(response);
      break;
    }
  }
};

export {};
