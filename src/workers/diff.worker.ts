/**
 * Diff Worker
 * Offloads JSON diff computation to a separate thread for large documents
 */

import type { JsonValue, JsonObject, JsonArray } from '../types';

// Types for diff results
export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffEntry {
  path: string;
  type: DiffType;
  oldValue?: JsonValue;
  newValue?: JsonValue;
}

export interface LineDiff {
  lineNumber: number;
  type: DiffType;
  content: string;
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
  total: number;
}

// Message types
interface JsonDiffMessage {
  type: 'json-diff';
  id: string;
  oldValue: JsonValue;
  newValue: JsonValue;
}

interface LineDiffMessage {
  type: 'line-diff';
  id: string;
  oldText: string;
  newText: string;
}

interface DiffSummaryMessage {
  type: 'diff-summary';
  id: string;
  diffs: DiffEntry[];
}

interface JsonDiffResponse {
  type: 'json-diff-result';
  id: string;
  diffs: DiffEntry[];
  summary: DiffSummary;
  error: string | null;
}

interface LineDiffResponse {
  type: 'line-diff-result';
  id: string;
  diffs: LineDiff[];
  error: string | null;
}

interface DiffSummaryResponse {
  type: 'diff-summary-result';
  id: string;
  summary: DiffSummary;
}

type WorkerMessage = JsonDiffMessage | LineDiffMessage | DiffSummaryMessage;

/**
 * Get the type of a JSON value
 */
function getType(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Deep compare two JSON values and return differences
 */
function diffJson(
  oldValue: JsonValue,
  newValue: JsonValue,
  path: string = ''
): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  
  // Same value
  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
    return diffs;
  }
  
  // Different types
  const oldType = getType(oldValue);
  const newType = getType(newValue);
  
  if (oldType !== newType) {
    diffs.push({
      path: path || '/',
      type: 'changed',
      oldValue,
      newValue,
    });
    return diffs;
  }
  
  // Both objects
  if (oldType === 'object' && newType === 'object') {
    const oldObj = oldValue as JsonObject;
    const newObj = newValue as JsonObject;
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    
    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;
      
      if (!(key in oldObj)) {
        // Key added
        diffs.push({
          path: keyPath,
          type: 'added',
          newValue: newObj[key],
        });
      } else if (!(key in newObj)) {
        // Key removed
        diffs.push({
          path: keyPath,
          type: 'removed',
          oldValue: oldObj[key],
        });
      } else {
        // Compare values
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        if (oldVal !== undefined && newVal !== undefined) {
          diffs.push(...diffJson(oldVal, newVal, keyPath));
        }
      }
    }
    
    return diffs;
  }
  
  // Both arrays
  if (oldType === 'array' && newType === 'array') {
    const oldArr = oldValue as JsonArray;
    const newArr = newValue as JsonArray;
    const maxLen = Math.max(oldArr.length, newArr.length);
    
    for (let i = 0; i < maxLen; i++) {
      const indexPath = `${path}[${i}]`;
      
      if (i >= oldArr.length) {
        // Item added
        diffs.push({
          path: indexPath,
          type: 'added',
          newValue: newArr[i],
        });
      } else if (i >= newArr.length) {
        // Item removed
        diffs.push({
          path: indexPath,
          type: 'removed',
          oldValue: oldArr[i],
        });
      } else {
        // Compare items
        const oldItem = oldArr[i];
        const newItem = newArr[i];
        if (oldItem !== undefined && newItem !== undefined) {
          diffs.push(...diffJson(oldItem, newItem, indexPath));
        }
      }
    }
    
    return diffs;
  }
  
  // Primitives that differ
  diffs.push({
    path: path || '/',
    type: 'changed',
    oldValue,
    newValue,
  });
  
  return diffs;
}

/**
 * Find longest common subsequence indices
 */
function longestCommonSubsequence(
  arr1: string[],
  arr2: string[]
): Array<[number, number]> {
  const m = arr1.length;
  const n = arr2.length;
  
  // DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0) as number[]);
  
  // Fill the table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const prevRow = dp[i - 1];
      const currRow = dp[i];
      if (!prevRow || !currRow) continue;
      
      if (arr1[i - 1] === arr2[j - 1]) {
        currRow[j] = (prevRow[j - 1] ?? 0) + 1;
      } else {
        currRow[j] = Math.max(prevRow[j] ?? 0, currRow[j - 1] ?? 0);
      }
    }
  }
  
  // Backtrack to find indices
  const result: Array<[number, number]> = [];
  let i = m;
  let j = n;
  
  while (i > 0 && j > 0) {
    const prevRow = dp[i - 1];
    const currRow = dp[i];
    if (!prevRow || !currRow) break;
    
    if (arr1[i - 1] === arr2[j - 1]) {
      result.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if ((prevRow[j] ?? 0) > (currRow[j - 1] ?? 0)) {
      i--;
    } else {
      j--;
    }
  }
  
  return result;
}

/**
 * Simple line-by-line diff for text
 */
function diffLines(oldText: string, newText: string): LineDiff[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: LineDiff[] = [];
  
  // Simple LCS-based diff
  const lcs = longestCommonSubsequence(oldLines, newLines);
  
  let oldIdx = 0;
  let newIdx = 0;
  let lineNum = 1;
  
  for (const match of lcs) {
    const [oldLcsIdx, newLcsIdx] = match;
    
    // Add removed lines
    while (oldIdx < oldLcsIdx) {
      const line = oldLines[oldIdx];
      if (line !== undefined) {
        result.push({
          lineNumber: lineNum++,
          type: 'removed',
          content: line,
        });
      }
      oldIdx++;
    }
    
    // Add added lines
    while (newIdx < newLcsIdx) {
      const line = newLines[newIdx];
      if (line !== undefined) {
        result.push({
          lineNumber: lineNum++,
          type: 'added',
          content: line,
        });
      }
      newIdx++;
    }
    
    // Add unchanged line
    const unchangedLine = newLines[newIdx];
    if (unchangedLine !== undefined) {
      result.push({
        lineNumber: lineNum++,
        type: 'unchanged',
        content: unchangedLine,
      });
    }
    oldIdx++;
    newIdx++;
  }
  
  // Add remaining removed lines
  while (oldIdx < oldLines.length) {
    const line = oldLines[oldIdx];
    if (line !== undefined) {
      result.push({
        lineNumber: lineNum++,
        type: 'removed',
        content: line,
      });
    }
    oldIdx++;
  }
  
  // Add remaining added lines
  while (newIdx < newLines.length) {
    const line = newLines[newIdx];
    if (line !== undefined) {
      result.push({
        lineNumber: lineNum++,
        type: 'added',
        content: line,
      });
    }
    newIdx++;
  }
  
  return result;
}

/**
 * Get summary of diff
 */
function getDiffSummary(diffs: DiffEntry[]): DiffSummary {
  return {
    added: diffs.filter(d => d.type === 'added').length,
    removed: diffs.filter(d => d.type === 'removed').length,
    changed: diffs.filter(d => d.type === 'changed').length,
    total: diffs.length,
  };
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  
  switch (message.type) {
    case 'json-diff': {
      try {
        const diffs = diffJson(message.oldValue, message.newValue);
        const summary = getDiffSummary(diffs);
        const response: JsonDiffResponse = {
          type: 'json-diff-result',
          id: message.id,
          diffs,
          summary,
          error: null,
        };
        self.postMessage(response);
      } catch (e) {
        const response: JsonDiffResponse = {
          type: 'json-diff-result',
          id: message.id,
          diffs: [],
          summary: { added: 0, removed: 0, changed: 0, total: 0 },
          error: e instanceof Error ? e.message : 'Diff failed',
        };
        self.postMessage(response);
      }
      break;
    }
    
    case 'line-diff': {
      try {
        const diffs = diffLines(message.oldText, message.newText);
        const response: LineDiffResponse = {
          type: 'line-diff-result',
          id: message.id,
          diffs,
          error: null,
        };
        self.postMessage(response);
      } catch (e) {
        const response: LineDiffResponse = {
          type: 'line-diff-result',
          id: message.id,
          diffs: [],
          error: e instanceof Error ? e.message : 'Line diff failed',
        };
        self.postMessage(response);
      }
      break;
    }
    
    case 'diff-summary': {
      const summary = getDiffSummary(message.diffs);
      const response: DiffSummaryResponse = {
        type: 'diff-summary-result',
        id: message.id,
        summary,
      };
      self.postMessage(response);
      break;
    }
  }
};

export {};
