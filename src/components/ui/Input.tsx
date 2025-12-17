import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

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
            'w-full h-8 px-3 text-sm bg-bg-surface border rounded-md',
            'text-text-primary placeholder:text-text-muted',
            'transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-bg-base focus:border-accent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
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
