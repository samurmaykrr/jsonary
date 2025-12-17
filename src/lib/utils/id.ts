/**
 * Generates a unique ID using crypto.randomUUID()
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generates a short ID (8 characters)
 */
export function generateShortId(): string {
  return crypto.randomUUID().slice(0, 8);
}
