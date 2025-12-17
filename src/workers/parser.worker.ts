/**
 * Parser Worker
 * Offloads JSON parsing to a separate thread for large documents
 */

import type { JsonValue } from '../types';

// Types for messages
interface ParseMessage {
  type: 'parse';
  id: string;
  input: string;
}

interface ParseResponse {
  type: 'parse-result';
  id: string;
  value: JsonValue | null;
  error: ParseError | null;
}

interface ParseError {
  message: string;
  line: number;
  column: number;
  offset: number;
}

type WorkerMessage = ParseMessage;
type WorkerResponse = ParseResponse;

/**
 * Extract line and column from JSON parse error
 */
function getErrorLocation(input: string, error: SyntaxError): { line: number; column: number; offset: number } {
  const match = error.message.match(/position\s+(\d+)/i) 
    ?? error.message.match(/at\s+(\d+)/i)
    ?? error.message.match(/column\s+(\d+)/i);
  
  let offset = 0;
  if (match?.[1]) {
    offset = parseInt(match[1], 10);
  }
  
  let line = 1;
  let column = 1;
  
  for (let i = 0; i < offset && i < input.length; i++) {
    if (input[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  
  return { line, column, offset };
}

/**
 * Parse JSON string with detailed error information
 */
function parseJson(input: string): { value: JsonValue | null; error: ParseError | null } {
  try {
    const value = JSON.parse(input) as JsonValue;
    return { value, error: null };
  } catch (e) {
    const error = e as SyntaxError;
    const { line, column, offset } = getErrorLocation(input, error);
    
    return {
      value: null,
      error: {
        message: error.message,
        line,
        column,
        offset,
      },
    };
  }
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  
  switch (message.type) {
    case 'parse': {
      const result = parseJson(message.input);
      const response: WorkerResponse = {
        type: 'parse-result',
        id: message.id,
        value: result.value,
        error: result.error,
      };
      self.postMessage(response);
      break;
    }
  }
};

export {};
