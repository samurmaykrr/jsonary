import { useEffect, useState } from 'react';
import { X, CheckCircle, XCircle, Warning, Info } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useToast, type Toast, type ToastType } from '@/store/toastStore';

// ============================================
// Toast Icon
// ============================================

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle weight="fill" className="w-5 h-5 text-green-500" />,
  error: <XCircle weight="fill" className="w-5 h-5 text-red-500" />,
  warning: <Warning weight="fill" className="w-5 h-5 text-yellow-500" />,
  info: <Info weight="fill" className="w-5 h-5 text-blue-500" />,
};

const toastStyles: Record<ToastType, string> = {
  success: 'border-green-500/20 bg-green-500/5',
  error: 'border-red-500/20 bg-red-500/5',
  warning: 'border-yellow-500/20 bg-yellow-500/5',
  info: 'border-blue-500/20 bg-blue-500/5',
};

// ============================================
// Single Toast Component
// ============================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  // Animate progress bar
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;

    const startTime = Date.now();
    const endTime = startTime + toast.duration;

    const updateProgress = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const newProgress = (remaining / toast.duration!) * 100;
      setProgress(newProgress);

      if (newProgress > 0) {
        requestAnimationFrame(updateProgress);
      }
    };

    const rafId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(rafId);
  }, [toast.duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 150); // Match animation duration
  };

  return (
    <div
      role="alert"
      className={cn(
        'relative overflow-hidden rounded-lg border shadow-lg',
        'bg-bg-surface backdrop-blur-sm',
        'min-w-72 max-w-96',
        'animate-slide-in-right',
        toastStyles[toast.type],
        isExiting && 'animate-slide-out-right'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {toastIcons[toast.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">
            {toast.title}
          </p>
          {toast.message && (
            <p className="mt-1 text-sm text-text-secondary">
              {toast.message}
            </p>
          )}
        </div>

        {/* Dismiss button */}
        {toast.dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-bg-hover transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4 text-text-tertiary" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border-subtle">
          <div
            className={cn(
              'h-full transition-all duration-100 ease-linear',
              toast.type === 'success' && 'bg-green-500',
              toast.type === 'error' && 'bg-red-500',
              toast.type === 'warning' && 'bg-yellow-500',
              toast.type === 'info' && 'bg-blue-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// Toast Container
// ============================================

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={removeToast}
        />
      ))}
    </div>
  );
}
