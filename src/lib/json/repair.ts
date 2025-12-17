import { jsonrepair } from 'jsonrepair';

/**
 * Repair result
 */
export interface RepairResult {
  output: string;
  wasRepaired: boolean;
  error: string | null;
}

/**
 * Attempt to repair malformed JSON
 * 
 * Handles:
 * - Unquoted keys
 * - Single quotes instead of double quotes
 * - Trailing commas
 * - Comments (// and /*)
 * - MongoDB extended JSON (ObjectId, ISODate, etc.)
 * - Python literals (True, False, None)
 * - NDJSON (newline-delimited JSON)
 */
export function repairJson(input: string): RepairResult {
  // First check if it's already valid
  try {
    JSON.parse(input);
    return {
      output: input,
      wasRepaired: false,
      error: null,
    };
  } catch {
    // Not valid, try to repair
  }
  
  try {
    const output = jsonrepair(input);
    return {
      output,
      wasRepaired: output !== input,
      error: null,
    };
  } catch (e) {
    return {
      output: input,
      wasRepaired: false,
      error: e instanceof Error ? e.message : 'Unknown repair error',
    };
  }
}

/**
 * Check if JSON can be repaired
 */
export function canRepairJson(input: string): boolean {
  try {
    JSON.parse(input);
    return false; // Already valid
  } catch {
    try {
      jsonrepair(input);
      return true;
    } catch {
      return false;
    }
  }
}
