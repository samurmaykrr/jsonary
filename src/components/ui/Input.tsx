import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

/**
 * Input component following Emil's Design Engineering principles:
 * - 16px minimum font size on mobile to prevent iOS zoom on focus
 * - Fast, specific property transitions (150ms ease)
 * - Proper focus states for keyboard navigation
 * - Touch-friendly tap targets (44px minimum on mobile)
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, type = 'text', ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full h-8 sm:h-8 min-h-[44px] sm:min-h-0 px-3 bg-bg-surface border rounded-md',
            // Font size: 16px on mobile to prevent iOS zoom, 14px on desktop
            'text-base sm:text-sm',
            'text-text-primary placeholder:text-text-muted',
            // Specific property transitions - NEVER use 'transition: all'
            'transition-colors duration-150 ease-out',
            // Focus states (accessibility + visual feedback)
            'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-bg-base focus:border-accent',
            // Disabled state
            'disabled:opacity-50 disabled:cursor-not-allowed',
            // Error/default border states with hover on hover-capable devices
            error
              ? 'border-error focus:ring-error focus:border-error'
              : 'border-border-default hover:border-border-strong',
            icon && 'pl-8',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
