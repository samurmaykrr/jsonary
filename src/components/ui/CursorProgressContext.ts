import { createContext } from 'react';

export interface CursorProgressState {
  isVisible: boolean;
  message: string;
  x: number;
  y: number;
}

export interface CursorProgressContextValue {
  // show may be called with an optional mouse event or coord object so
  // the indicator can appear exactly where the user clicked.
  show: (
    message: string,
    ev?: MouseEvent | PointerEvent | { clientX: number; clientY: number }
  ) => void;
  hide: () => void;
  isVisible: boolean;
}

export const CursorProgressContext = createContext<CursorProgressContextValue | null>(null);
