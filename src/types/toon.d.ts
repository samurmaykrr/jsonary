declare module 'toon' {
  /**
   * Encode a value to TOON format
   */
  export function encode(value: unknown): string;

  /**
   * Decode a TOON string to a value
   */
  export function decode(toonString: string): unknown;
}
