/**
 * Script to update index.html with branding information
 * This can be run during build or manually
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const brandingPath = join(process.cwd(), 'src/config/branding.json');
const htmlPath = join(process.cwd(), 'index.html');

const branding = JSON.parse(readFileSync(brandingPath, 'utf-8'));
let html = readFileSync(htmlPath, 'utf-8');

// Update meta tags
html = html.replace(/<title>.*?<\/title>/, `<title>${branding.app.displayName}</title>`);
html = html.replace(/<meta name="description" content=".*?"/, `<meta name="description" content="${branding.app.description}"`);
html = html.replace(/<meta name="keywords" content=".*?"/, `<meta name="keywords" content="${branding.features.keywords.join(', ')}"`);
html = html.replace(/<meta name="author" content=".*?"/, `<meta name="author" content="${branding.app.author.name}"`);
html = html.replace(/<meta name="theme-color" content=".*?"/, `<meta name="theme-color" content="${branding.pwa.themeColor}"`);
html = html.replace(/<meta name="apple-mobile-web-app-title" content=".*?"/, `<meta name="apple-mobile-web-app-title" content="${branding.pwa.appleMobileWebAppTitle}"`);

// Update Open Graph tags
html = html.replace(/<meta property="og:title" content=".*?"/, `<meta property="og:title" content="${branding.app.displayName}"`);
html = html.replace(/<meta property="og:description" content=".*?"/, `<meta property="og:description" content="${branding.app.description}"`);

// Update Twitter tags
html = html.replace(/<meta name="twitter:title" content=".*?"/, `<meta name="twitter:title" content="${branding.app.displayName}"`);
html = html.replace(/<meta name="twitter:description" content=".*?"/, `<meta name="twitter:description" content="${branding.app.description}"`);

writeFileSync(htmlPath, html, 'utf-8');
console.log('✓ Updated index.html with branding information');
