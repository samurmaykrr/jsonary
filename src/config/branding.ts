import brandingData from './branding.json';

export interface BrandingConfig {
  app: {
    name: string;
    displayName: string;
    tagline: string;
    description: string;
    version: string;
    author: {
      name: string;
      url: string;
      displayName: string;
    };
  };
  links: {
    github: string;
    issues: string;
    discussions: string;
    support: string;
    homepage: string;
    docs: string;
  };
  social: {
    twitter: {
      handle: string;
      url: string;
    };
  };
  assets: {
    logo: string;
    favicon: string;
    appleTouchIcon: string;
    ogImage: string;
  };
  theme: {
    primaryColor: string;
    darkBackground: string;
  };
  features: {
    keywords: string[];
  };
  support: {
    email: string | null;
    chat: string | null;
    helpText: string;
  };
  legal: {
    copyright: string;
    license: string;
  };
  pwa: {
    themeColor: string;
    appleMobileWebAppTitle: string;
  };
}

export const branding: BrandingConfig = brandingData as BrandingConfig;

/**
 * Hook to access branding configuration
 */
export function useBranding(): BrandingConfig {
  return branding;
}

/**
 * Get branding value (for non-hook contexts)
 */
export function getBranding(): BrandingConfig {
  return branding;
}
