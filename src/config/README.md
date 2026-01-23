# Branding Configuration

This directory contains the centralized branding configuration for the application.

## Files

- **`branding.json`**: The main branding configuration file containing all app metadata, links, and asset paths
- **`branding.ts`**: TypeScript definitions and utility functions for accessing branding data
- **`index.ts`**: Central export file for easy imports

## Usage

### In React Components

```tsx
import { useBranding } from '@/config/branding';

function MyComponent() {
  const branding = useBranding();

  return (
    <div>
      <h1>{branding.app.displayName}</h1>
      <p>{branding.app.tagline}</p>
      <a href={branding.links.github}>GitHub</a>
    </div>
  );
}
```

### In Non-React Code

```ts
import { getBranding } from '@/config/branding';

const branding = getBranding();
console.log(branding.app.name);
```

## Configuration Structure

### App Information
- `app.name`: Internal app name (kebab-case)
- `app.displayName`: User-facing display name
- `app.tagline`: Short tagline for marketing
- `app.description`: Full description for SEO
- `app.version`: Semantic version number
- `app.author`: Author information

### Links
- `links.github`: GitHub repository URL
- `links.issues`: GitHub issues URL
- `links.discussions`: GitHub discussions URL
- `links.support`: Support/help URL
- `links.homepage`: Main homepage URL
- `links.docs`: Documentation URL

### Assets
- `assets.logo`: Path to main logo
- `assets.favicon`: Path to favicon
- `assets.appleTouchIcon`: Path to Apple touch icon
- `assets.ogImage`: Path to Open Graph image

### Theme
- `theme.primaryColor`: Primary brand color (hex)
- `theme.darkBackground`: Dark mode background color (hex)

### Support
- `support.email`: Support email (if available)
- `support.chat`: Chat support URL (if available)
- `support.helpText`: General help text

### Legal
- `legal.copyright`: Copyright notice
- `legal.license`: License type

### PWA
- `pwa.themeColor`: PWA theme color
- `pwa.appleMobileWebAppTitle`: iOS app title

## Updating Branding

1. Edit `branding.json` with your new values
2. Run `npm run update-meta` to sync changes to `index.html` (if script is configured)
3. Restart the dev server to see changes

## Best Practices

1. **Centralize**: Always use the branding config instead of hardcoding values
2. **Type Safety**: Use TypeScript types for autocomplete and validation
3. **Consistency**: Keep branding consistent across all components
4. **Assets**: Store all brand assets in the `/public` directory
5. **Updates**: When updating branding, search for hardcoded values that may need updating

## Examples of Components Using Branding

- `Header.tsx`: App name and logo
- `StatusBar.tsx`: Author attribution
- `SettingsModal.tsx`: Preview text
- `index.html`: Meta tags and titles
