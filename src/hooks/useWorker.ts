import { useCallback, useEffect, useRef, useState } from 'react';
import { generateId } from '@/lib/utils';

/**
 * Hook for using Web Workers with automatic fallback to main thread
 * 
 * @template TMessage - Message type sent to worker
 * @template TResponse - Response type received from worker
 */
export function useWorker<TMessage, TResponse>(
  workerFactory: () => Worker,
  options: {
    /** Whether to use the worker (if false, all tasks run on main thread) */
    enabled?: boolean;
    /** Timeout in ms for worker tasks (default: 30000) */
    timeout?: number;
  } = {}
) {
  const { enabled = true, timeout = 30000 } = options;
  
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, {
    resolve: (value: TResponse) => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  }>>(new Map());
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Initialize worker
  useEffect(() => {
    if (!enabled) {
      setIsReady(true);
      return;
    }
    
    try {
      const worker = workerFactory();
      workerRef.current = worker;
      
      worker.onmessage = (event: MessageEvent<TResponse & { id: string }>) => {
        const { id } = event.data;
        const pending = pendingRef.current.get(id);
        
        if (pending) {
          clearTimeout(pending.timeoutId);
          pendingRef.current.delete(id);
          pending.resolve(event.data);
        }
      };
      
      worker.onerror = (event) => {
        setError(new Error(event.message || 'Worker error'));
        
        // Reject all pending tasks
        for (const [id, pending] of pendingRef.current) {
          clearTimeout(pending.timeoutId);
          pending.reject(new Error('Worker error'));
          pendingRef.current.delete(id);
        }
      };
      
      setIsReady(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to create worker'));
      setIsReady(true); // Still ready, will fall back to main thread
    }
    
    return () => {
      // Clean up worker
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      
      // Reject pending tasks
      for (const [id, pending] of pendingRef.current) {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Worker terminated'));
        pendingRef.current.delete(id);
      }
    };
  }, [enabled, workerFactory]);
  
  /**
   * Post a message to the worker and wait for response
   */
  const postMessage = useCallback((message: TMessage): Promise<TResponse> => {
    return new Promise((resolve, reject) => {
      const id = generateId();
      const messageWithId = { ...message, id };
      
      if (!enabled || !workerRef.current) {
        // No worker, reject immediately (caller should handle fallback)
        reject(new Error('Worker not available'));
        return;
      }
      
      const timeoutId = setTimeout(() => {
        pendingRef.current.delete(id);
        reject(new Error('Worker timeout'));
      }, timeout);
      
      pendingRef.current.set(id, { resolve, reject, timeoutId });
      
      try {
        workerRef.current.postMessage(messageWithId);
      } catch (e) {
        clearTimeout(timeoutId);
        pendingRef.current.delete(id);
        reject(e instanceof Error ? e : new Error('Failed to post message'));
      }
    });
  }, [enabled, timeout]);
  
  /**
   * Check if worker is available
   */
  const isAvailable = enabled && workerRef.current !== null && error === null;
  
  return {
    postMessage,
    isReady,
    isAvailable,
    error,
  };
}

/**
 * Factory functions for creating workers
 * These are wrapped in functions to allow lazy initialization
 */
export const createParserWorker = () => 
  new Worker(new URL('../workers/parser.worker.ts', import.meta.url), { type: 'module' });

export const createFormatterWorker = () =>
  new Worker(new URL('../workers/formatter.worker.ts', import.meta.url), { type: 'module' });

export const createDiffWorker = () =>
  new Worker(new URL('../workers/diff.worker.ts', import.meta.url), { type: 'module' });

export const createValidateWorker = () =>
  new Worker(new URL('../workers/validate.worker.ts', import.meta.url), { type: 'module' });

/**
 * Type definitions for worker messages
 */
export interface ParseMessage {
  type: 'parse';
  input: string;
}

export interface ParseResponse {
  type: 'parse-result';
  id: string;
  value: unknown;
  error: { message: string; line: number; column: number; offset: number } | null;
}

export interface FormatMessage {
  type: 'format' | 'compact' | 'smart-format' | 'sort-keys';
  input: string;
  options?: {
    indent?: number | 'tab';
    maxLineLength?: number;
  };
}

export interface FormatResponse {
  type: 'format-result' | 'compact-result' | 'smart-format-result' | 'sort-keys-result';
  id: string;
  output: string;
  error: string | null;
}

export interface DiffMessage {
  type: 'json-diff' | 'line-diff';
  oldValue?: unknown;
  newValue?: unknown;
  oldText?: string;
  newText?: string;
}

export interface DiffResponse {
  type: 'json-diff-result' | 'line-diff-result';
  id: string;
  diffs: unknown[];
  summary?: { added: number; removed: number; changed: number; total: number };
  error: string | null;
}

export interface ValidateMessage {
  type: 'validate-syntax' | 'validate-basic-schema';
  input?: string;
  data?: unknown;
  schema?: unknown;
}

export interface ValidateResponse {
  type: 'validate-syntax-result' | 'validate-basic-schema-result';
  id: string;
  valid: boolean;
  error?: { message: string; line: number; column: number; offset: number } | null;
  errors?: unknown[];
}

/**
 * High-level hooks for specific workers
 */

/**
 * Hook for JSON parsing in a worker
 */
export function useParserWorker(enabled = true) {
  const worker = useWorker<ParseMessage, ParseResponse>(createParserWorker, { enabled });
  
  const parse = useCallback(async (input: string) => {
    if (!worker.isAvailable) {
      // Fallback to main thread
      try {
        const value = JSON.parse(input);
        return { value, error: null };
      } catch (e) {
        const error = e as SyntaxError;
        return {
          value: null,
          error: { message: error.message, line: 1, column: 1, offset: 0 },
        };
      }
    }
    
    try {
      const response = await worker.postMessage({ type: 'parse', input });
      return { value: response.value, error: response.error };
    } catch {
      // Fallback to main thread on worker failure
      try {
        const value = JSON.parse(input);
        return { value, error: null };
      } catch (e) {
        const error = e as SyntaxError;
        return {
          value: null,
          error: { message: error.message, line: 1, column: 1, offset: 0 },
        };
      }
    }
  }, [worker]);
  
  return { parse, isReady: worker.isReady };
}

/**
 * Hook for JSON formatting in a worker
 */
export function useFormatterWorker(enabled = true) {
  const worker = useWorker<FormatMessage, FormatResponse>(createFormatterWorker, { enabled });
  
  const format = useCallback(async (
    input: string,
    options: { indent?: number | 'tab'; maxLineLength?: number } = {}
  ) => {
    if (!worker.isAvailable) {
      // Fallback to main thread
      try {
        const { indent = 2 } = options;
        const parsed = JSON.parse(input);
        const indentStr = indent === 'tab' ? '\t' : ' '.repeat(indent);
        return { output: JSON.stringify(parsed, null, indentStr), error: null };
      } catch (e) {
        return { output: input, error: e instanceof Error ? e.message : 'Format failed' };
      }
    }
    
    try {
      const response = await worker.postMessage({ type: 'format', input, options });
      return { output: response.output, error: response.error };
    } catch {
      // Fallback
      try {
        const parsed = JSON.parse(input);
        return { output: JSON.stringify(parsed, null, 2), error: null };
      } catch (e) {
        return { output: input, error: e instanceof Error ? e.message : 'Format failed' };
      }
    }
  }, [worker]);
  
  const compact = useCallback(async (input: string) => {
    if (!worker.isAvailable) {
      try {
        const parsed = JSON.parse(input);
        return { output: JSON.stringify(parsed), error: null };
      } catch (e) {
        return { output: input, error: e instanceof Error ? e.message : 'Compact failed' };
      }
    }
    
    try {
      const response = await worker.postMessage({ type: 'compact', input });
      return { output: response.output, error: response.error };
    } catch {
      try {
        const parsed = JSON.parse(input);
        return { output: JSON.stringify(parsed), error: null };
      } catch (e) {
        return { output: input, error: e instanceof Error ? e.message : 'Compact failed' };
      }
    }
  }, [worker]);
  
  return { format, compact, isReady: worker.isReady };
}

/**
 * Hook for syntax validation in a worker
 */
export function useValidateWorker(enabled = true) {
  const worker = useWorker<ValidateMessage, ValidateResponse>(createValidateWorker, { enabled });
  
  const validateSyntax = useCallback(async (input: string) => {
    if (!worker.isAvailable) {
      // Fallback to main thread
      try {
        JSON.parse(input);
        return { valid: true, error: null };
      } catch (e) {
        const error = e as SyntaxError;
        return {
          valid: false,
          error: { message: error.message, line: 1, column: 1, offset: 0 },
        };
      }
    }
    
    try {
      const response = await worker.postMessage({ type: 'validate-syntax', input });
      return { valid: response.valid, error: response.error };
    } catch {
      // Fallback
      try {
        JSON.parse(input);
        return { valid: true, error: null };
      } catch (e) {
        const error = e as SyntaxError;
        return {
          valid: false,
          error: { message: error.message, line: 1, column: 1, offset: 0 },
        };
      }
    }
  }, [worker]);
  
  return { validateSyntax, isReady: worker.isReady };
}
