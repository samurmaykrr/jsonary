import { useContext } from 'react';
import { CursorProgressContext, type CursorProgressContextValue } from './CursorProgressContext';

export function useCursorProgress(): CursorProgressContextValue {
  const context = useContext(CursorProgressContext);
  if (!context) {
    throw new Error('useCursorProgress must be used within CursorProgressProvider');
  }
  return context;
}
