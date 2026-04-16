/**
 * Minimal Next.js navigation shim for Vite-based apps.
 *
 * Why this exists:
 * - `@vercel/analytics/next` imports `next/navigation.js` at runtime.
 * - This project is not a Next.js app, so that module does not exist.
 * - We provide the small subset of hooks analytics needs so the package can
 *   run in this environment without pulling in Next.js.
 */

/**
 * Non-Next apps do not expose dynamic route params in Next's shape.
 * Returning null tells Vercel Analytics to skip route template derivation.
 */
export function useParams(): null {
  return null;
}

/**
 * Derive the current pathname from the browser location.
 */
export function usePathname(): string {
  if (typeof window === 'undefined') {
    return '/';
  }
  return window.location.pathname || '/';
}

/**
 * Provide URL search params compatible with what analytics consumes.
 */
export function useSearchParams(): URLSearchParams {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return new URLSearchParams(search);
}
