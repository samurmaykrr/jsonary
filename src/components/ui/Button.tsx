import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Button component following Emil's Design Engineering principles:
 * - Fast transitions (150ms ease)
 * - Touch-first design with 44px minimum tap targets on mobile
 * - Specific property transitions (not transition: all)
 * - Proper focus states for keyboard navigation
 * - Disabled state styling
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium',
          // Specific property transitions - NEVER use 'transition: all'
          'transition-colors duration-150 ease-out',
          // Focus states for keyboard navigation (accessibility)
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
          // Disabled state
          'disabled:pointer-events-none disabled:opacity-50',
          // Variants - hover states only apply on devices with hover capability
          variant === 'primary' && [
            'bg-accent text-white',
            'hover:bg-accent-hover',
          ],
          variant === 'secondary' && [
            'border border-border-default bg-transparent text-text-primary',
            'hover:bg-bg-hover hover:border-border-strong',
          ],
          variant === 'ghost' && [
            'text-text-secondary',
            'hover:text-text-primary hover:bg-bg-hover',
          ],
          variant === 'danger' && [
            'bg-error/10 text-error border border-error/20',
            'hover:bg-error/20 hover:border-error/30',
          ],
          // Sizes - 'sm' is 44px on mobile for touch targets
          size === 'sm' && 'h-7 sm:h-7 min-h-[44px] sm:min-h-0 px-2.5 text-xs rounded',
          size === 'md' && 'h-8 sm:h-8 min-h-[44px] sm:min-h-0 px-3 text-sm rounded-md',
          size === 'lg' && 'h-10 px-4 text-sm rounded-md', // Already 40px, close to 44px
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
