import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import { generateId } from '@/lib/utils';

// ============================================
// Types
// ============================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
}

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (options: ToastOptions) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  // Convenience methods
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

// ============================================
// Context
// ============================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================
// Provider
// ============================================

const DEFAULT_DURATION = 5000; // 5 seconds
const MAX_TOASTS = 5;

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((options: ToastOptions): string => {
    const id = generateId();
    const toast: Toast = {
      id,
      type: options.type ?? 'info',
      title: options.title,
      message: options.message,
      duration: options.duration ?? DEFAULT_DURATION,
      dismissible: options.dismissible ?? true,
    };

    setToasts((prev) => {
      // Remove oldest if we're at max capacity
      const newToasts = prev.length >= MAX_TOASTS ? prev.slice(1) : prev;
      return [...newToasts, toast];
    });

    // Auto-dismiss after duration
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration);
    }

    return id;
  }, [removeToast]);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message?: string) => {
    return addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    return addToast({ type: 'error', title, message, duration: 8000 }); // Errors stay longer
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    return addToast({ type: 'warning', title, message });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    return addToast({ type: 'info', title, message });
  }, [addToast]);

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
