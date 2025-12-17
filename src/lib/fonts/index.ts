/**
 * Font management utilities for on-demand Google Fonts loading
 */

export interface FontOption {
  name: string;
  family: string;
  googleFontUrl?: string; // If undefined, it's a system font
  isSystem?: boolean;
}

// Popular monospace fonts available on Google Fonts
export const MONOSPACE_FONTS: FontOption[] = [
  // System/bundled fonts (already loaded)
  {
    name: 'Geist Mono',
    family: 'Geist Mono',
    isSystem: true,
  },
  // Google Fonts - will be loaded on demand
  {
    name: 'JetBrains Mono',
    family: 'JetBrains Mono',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  },
  {
    name: 'Fira Code',
    family: 'Fira Code',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap',
  },
  {
    name: 'Source Code Pro',
    family: 'Source Code Pro',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600;700&display=swap',
  },
  {
    name: 'IBM Plex Mono',
    family: 'IBM Plex Mono',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap',
  },
  {
    name: 'Roboto Mono',
    family: 'Roboto Mono',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&display=swap',
  },
  {
    name: 'Ubuntu Mono',
    family: 'Ubuntu Mono',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Ubuntu+Mono:wght@400;700&display=swap',
  },
  {
    name: 'Inconsolata',
    family: 'Inconsolata',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;500;600;700&display=swap',
  },
  {
    name: 'Space Mono',
    family: 'Space Mono',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap',
  },
  // System fallback
  {
    name: 'System Monospace',
    family: 'monospace',
    isSystem: true,
  },
];

// Track which fonts have been loaded
const loadedFonts = new Set<string>();

/**
 * Load a Google Font by injecting a link tag
 */
export function loadGoogleFont(fontFamily: string): Promise<void> {
  // Check if already loaded
  if (loadedFonts.has(fontFamily)) {
    return Promise.resolve();
  }

  const fontOption = MONOSPACE_FONTS.find(f => f.family === fontFamily);
  
  // System fonts don't need loading
  if (!fontOption || fontOption.isSystem || !fontOption.googleFontUrl) {
    loadedFonts.add(fontFamily);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Check if link already exists
    const existingLink = document.querySelector(`link[href="${fontOption.googleFontUrl}"]`);
    if (existingLink) {
      loadedFonts.add(fontFamily);
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontOption.googleFontUrl!;
    
    link.onload = () => {
      loadedFonts.add(fontFamily);
      resolve();
    };
    
    link.onerror = () => {
      reject(new Error(`Failed to load font: ${fontFamily}`));
    };

    document.head.appendChild(link);
  });
}

/**
 * Check if a font is loaded/available
 */
export function isFontLoaded(fontFamily: string): boolean {
  return loadedFonts.has(fontFamily);
}

/**
 * Get all available font options
 */
export function getFontOptions(): FontOption[] {
  return MONOSPACE_FONTS;
}

/**
 * Preload multiple fonts
 */
export async function preloadFonts(fontFamilies: string[]): Promise<void> {
  await Promise.all(fontFamilies.map(loadGoogleFont));
}
