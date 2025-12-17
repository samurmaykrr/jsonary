/**
 * JSON Tokenizer for syntax highlighting
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

/**
 * Tokenize a JSON string
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const state: TokenizerState = {
    pos: 0,
    line: 1,
    column: 1,
    expectKey: false,
  };
  
  // Track context for key detection
  const contextStack: ('object' | 'array')[] = [];
  
  while (state.pos < input.length) {
    const char = input[state.pos];
    
    if (char === undefined) break;
    
    // Whitespace
    if (/\s/.test(char)) {
      const start = state.pos;
      const startLine = state.line;
      const startColumn = state.column;
      
      while (state.pos < input.length && /\s/.test(input[state.pos] ?? '')) {
        if (input[state.pos] === '\n') {
          state.line++;
          state.column = 1;
        } else {
          state.column++;
        }
        state.pos++;
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
      tokens.push(createToken('brace-open', char, state));
      contextStack.push('object');
      state.expectKey = true;
      state.pos++;
      state.column++;
      continue;
    }
    
    // Closing brace
    if (char === '}') {
      tokens.push(createToken('brace-close', char, state));
      contextStack.pop();
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      state.pos++;
      state.column++;
      continue;
    }
    
    // Opening bracket
    if (char === '[') {
      tokens.push(createToken('bracket-open', char, state));
      contextStack.push('array');
      state.expectKey = false;
      state.pos++;
      state.column++;
      continue;
    }
    
    // Closing bracket
    if (char === ']') {
      tokens.push(createToken('bracket-close', char, state));
      contextStack.pop();
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      state.pos++;
      state.column++;
      continue;
    }
    
    // Colon
    if (char === ':') {
      tokens.push(createToken('colon', char, state));
      state.expectKey = false;
      state.pos++;
      state.column++;
      continue;
    }
    
    // Comma
    if (char === ',') {
      tokens.push(createToken('comma', char, state));
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      state.pos++;
      state.column++;
      continue;
    }
    
    // String (or key)
    if (char === '"') {
      const stringToken = tokenizeString(input, state);
      // Determine if this is a key or value
      if (state.expectKey) {
        stringToken.type = 'key';
        state.expectKey = false;
      }
      tokens.push(stringToken);
      continue;
    }
    
    // Number
    if (char === '-' || (char >= '0' && char <= '9')) {
      tokens.push(tokenizeNumber(input, state));
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }
    
    // Boolean true
    if (char === 't' && input.slice(state.pos, state.pos + 4) === 'true') {
      tokens.push(createToken('boolean', 'true', state, 4));
      state.pos += 4;
      state.column += 4;
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }
    
    // Boolean false
    if (char === 'f' && input.slice(state.pos, state.pos + 5) === 'false') {
      tokens.push(createToken('boolean', 'false', state, 5));
      state.pos += 5;
      state.column += 5;
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }
    
    // Null
    if (char === 'n' && input.slice(state.pos, state.pos + 4) === 'null') {
      tokens.push(createToken('null', 'null', state, 4));
      state.pos += 4;
      state.column += 4;
      state.expectKey = contextStack[contextStack.length - 1] === 'object';
      continue;
    }
    
    // Unknown character - error token
    tokens.push(createToken('error', char, state));
    state.pos++;
    state.column++;
  }
  
  return tokens;
}

function createToken(
  type: TokenType,
  value: string,
  state: TokenizerState,
  length?: number
): Token {
  return {
    type,
    value,
    start: state.pos,
    end: state.pos + (length ?? value.length),
    line: state.line,
    column: state.column,
  };
}

function tokenizeString(input: string, state: TokenizerState): Token {
  const start = state.pos;
  const startLine = state.line;
  const startColumn = state.column;
  
  // Skip opening quote
  state.pos++;
  state.column++;
  
  while (state.pos < input.length) {
    const char = input[state.pos];
    
    if (char === '"') {
      // End of string
      state.pos++;
      state.column++;
      break;
    }
    
    if (char === '\\') {
      // Escape sequence
      state.pos += 2;
      state.column += 2;
      continue;
    }
    
    if (char === '\n') {
      // Unterminated string at newline
      break;
    }
    
    state.pos++;
    state.column++;
  }
  
  return {
    type: 'string',
    value: input.slice(start, state.pos),
    start,
    end: state.pos,
    line: startLine,
    column: startColumn,
  };
}

function tokenizeNumber(input: string, state: TokenizerState): Token {
  const start = state.pos;
  const startLine = state.line;
  const startColumn = state.column;
  
  // Optional negative sign
  if (input[state.pos] === '-') {
    state.pos++;
    state.column++;
  }
  
  // Integer part
  if (input[state.pos] === '0') {
    state.pos++;
    state.column++;
  } else {
    while (state.pos < input.length && /[0-9]/.test(input[state.pos] ?? '')) {
      state.pos++;
      state.column++;
    }
  }
  
  // Decimal part
  if (input[state.pos] === '.') {
    state.pos++;
    state.column++;
    while (state.pos < input.length && /[0-9]/.test(input[state.pos] ?? '')) {
      state.pos++;
      state.column++;
    }
  }
  
  // Exponent part
  if (input[state.pos] === 'e' || input[state.pos] === 'E') {
    state.pos++;
    state.column++;
    if (input[state.pos] === '+' || input[state.pos] === '-') {
      state.pos++;
      state.column++;
    }
    while (state.pos < input.length && /[0-9]/.test(input[state.pos] ?? '')) {
      state.pos++;
      state.column++;
    }
  }
  
  return {
    type: 'number',
    value: input.slice(start, state.pos),
    start,
    end: state.pos,
    line: startLine,
    column: startColumn,
  };
}

/**
 * Get the CSS class for a token type
 */
export function getTokenClass(type: TokenType): string {
  switch (type) {
    case 'key':
      return 'text-syntax-key';
    case 'string':
      return 'text-syntax-string';
    case 'number':
      return 'text-syntax-number';
    case 'boolean':
      return 'text-syntax-boolean';
    case 'null':
      return 'text-syntax-null';
    case 'brace-open':
    case 'brace-close':
    case 'bracket-open':
    case 'bracket-close':
      return 'text-syntax-bracket';
    case 'colon':
    case 'comma':
      return 'text-syntax-punctuation';
    case 'error':
      return 'text-syntax-error';
    case 'whitespace':
    default:
      return '';
  }
}
