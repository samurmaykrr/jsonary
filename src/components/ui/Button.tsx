import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
          'disabled:pointer-events-none disabled:opacity-50',
          // Variants
          variant === 'primary' && 'bg-accent text-white hover:bg-accent-hover',
          variant === 'secondary' && 'border border-border-default bg-transparent text-text-primary hover:bg-bg-hover hover:border-border-strong',
          variant === 'ghost' && 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
          variant === 'danger' && 'bg-error/10 text-error border border-error/20 hover:bg-error/20 hover:border-error/30',
          // Sizes
          size === 'sm' && 'h-7 px-2.5 text-xs rounded',
          size === 'md' && 'h-8 px-3 text-sm rounded-md',
          size === 'lg' && 'h-10 px-4 text-sm rounded-md',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
