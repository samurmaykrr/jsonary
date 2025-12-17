import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names using clsx and tailwind-merge
 * This ensures Tailwind classes are properly deduplicated
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
