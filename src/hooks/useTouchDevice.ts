import { useState, useEffect } from 'react';

/**
 * Hook to detect if the device supports touch
 * Returns true if the device has touch capabilities
 * 
 * Use this to disable hover effects on touch devices since they don't have
 * a true hover state and hover effects can feel broken on touch devices.
 * 
 * @example
 * const isTouchDevice = useTouchDevice();
 * const hoverClass = isTouchDevice ? '' : 'hover:bg-bg-hover';
 */
export function useTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    // Check if device supports touch
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error - legacy property
      navigator.msMaxTouchPoints > 0
    );
  });

  useEffect(() => {
    // Some hybrid devices might switch between touch and mouse
    // We use matchMedia to detect hover capability which is more accurate
    const hoverQuery = window.matchMedia('(hover: hover)');
    
    const handleChange = () => {
      // If device supports proper hover, it's not primarily a touch device
      setIsTouchDevice(!hoverQuery.matches);
    };

    hoverQuery.addEventListener('change', handleChange);
    // Set initial value based on hover capability
    handleChange();

    return () => {
      hoverQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isTouchDevice;
}

/**
 * Hook that returns true if the device supports hover interactions
 * This is the inverse of useTouchDevice but uses the more accurate (hover: hover) media query
 * 
 * @example
 * const canHover = useHoverCapability();
 * return <div className={canHover ? 'hover:bg-hover' : ''}>...</div>
 */
export function useHoverCapability(): boolean {
  const [canHover, setCanHover] = useState(() => {
    if (typeof window === 'undefined') return true;
    const hoverQuery = window.matchMedia('(hover: hover)');
    return hoverQuery.matches;
  });

  useEffect(() => {
    const hoverQuery = window.matchMedia('(hover: hover)');
    
    const handleChange = (event: MediaQueryListEvent) => {
      setCanHover(event.matches);
    };

    hoverQuery.addEventListener('change', handleChange);

    return () => {
      hoverQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return canHover;
}
