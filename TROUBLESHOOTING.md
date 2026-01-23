# Troubleshooting Blank Page Issue

If you're seeing a blank page when opening the application, follow these steps to diagnose the issue:

## Step 1: Check the Development Server

The development server should be running on `http://localhost:5173` (or 5174 if 5173 is busy):

```bash
pnpm dev
```

You should see output like:
```
VITE v7.3.0  ready in 204 ms
➜  Local:   http://localhost:5173/
```

## Step 2: Open Browser Developer Tools

1. Open your browser (Chrome, Firefox, Edge, Safari)
2. Navigate to `http://localhost:5173` (or the port shown in terminal)
3. Open Developer Tools:
   - **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Firefox**: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Safari**: Enable Developer menu first (Safari > Preferences > Advanced > Show Develop menu), then `Cmd+Option+I`

## Step 3: Check the Console Tab

Look for any **red error messages** in the Console tab. Common issues include:

### A. Module Not Found Errors
```
Failed to resolve module specifier "..."
```
**Solution**: Run `pnpm install` to reinstall dependencies

### B. Syntax Errors
```
Unexpected token ...
```
**Solution**: There may be a TypeScript compilation error. Check the terminal running `pnpm dev`

### C. Network Errors
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
```
**Solution**: Make sure the dev server is running

## Step 4: Check the Network Tab

1. Open the **Network** tab in Developer Tools
2. Refresh the page (`Ctrl+R` or `Cmd+R`)
3. Look for:
   - `index.html` - Should be **200 OK** (green)
   - `main.tsx` - Should be **200 OK**
   - `index.css` - Should be **200 OK**
   - Any **red** (failed) requests

## Step 5: Check the Elements Tab

1. Open the **Elements** tab
2. Look for `<div id="root"></div>`
3. Expand it - it should contain React components
4. If it's empty, React is not mounting

## Common Issues and Solutions

### Issue 1: "Cannot find module" errors

**Symptom**: Console shows module resolution errors

**Solution**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Issue 2: Port already in use

**Symptom**: Terminal shows "Port 5173 is in use"

**Solution**:
```bash
# Kill the process using the port (macOS/Linux)
lsof -ti:5173 | xargs kill -9

# Or just use the new port Vite suggests
```

### Issue 3: White screen with no errors

**Symptom**: Blank page, no console errors, network requests successful

**Solution**: This is likely a CSS issue
1. Check if `dist/assets/index-*.css` exists after build
2. Try hard refresh: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
3. Clear browser cache

### Issue 4: Service Worker caching issues

**Symptom**: Old version loads after updates

**Solution**:
```bash
# Clear browser cache and hard refresh
# Or unregister service worker in Developer Tools:
# Application tab > Service Workers > Unregister
```

### Issue 5: Browser compatibility

**Symptom**: Works in one browser but not another

**Solution**: Make sure you're using a modern browser:
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

## Step 6: Test with Production Build

Sometimes issues only appear in production:

```bash
# Build for production
pnpm build

# Preview the production build
pnpm preview
```

Navigate to `http://localhost:4173` and check if the issue persists.

## Step 7: Check File Permissions

On macOS/Linux, ensure files are readable:

```bash
# Make sure files in src/ are readable
chmod -R 755 src/
```

## Step 8: Environment Variables

Check if there are any missing environment variables:

```bash
# List all environment variables in use
grep -r "import.meta.env" src/
```

## Getting More Help

If none of these solutions work, please:

1. **Take a screenshot** of the browser console (with errors visible)
2. **Copy the error messages** from the console
3. **Check the terminal** running `pnpm dev` for errors
4. **Note your environment**:
   - Operating System
   - Browser and version
   - Node.js version (`node --version`)
   - pnpm version (`pnpm --version`)

## Quick Diagnostic Commands

Run these commands and share the output:

```bash
# Check Node version
node --version

# Check pnpm version
pnpm --version

# Check if build works
pnpm build

# Check if dependencies are installed
ls node_modules | wc -l

# Check TypeScript compilation
pnpm exec tsc --noEmit
```

## Current Expected Behavior

When the app loads correctly, you should see:

1. **Header** with "Jsonary" logo and menus (File, Tools, View, Help)
2. **Tab Bar** with one tab "Untitled"
3. **Editor Toolbar** with view mode buttons (Text, Tree, Table)
4. **Editor Area** with a text editor showing empty content or placeholder
5. **Status Bar** at the bottom showing "No errors" and line/column info

## Still Having Issues?

If you're still seeing a blank page after trying all these steps, the issue might be:

1. **Corrupted build cache**: Try `rm -rf dist node_modules .vite && pnpm install && pnpm dev`
2. **Browser extensions**: Try opening in Incognito/Private mode
3. **Firewall/Antivirus**: Check if it's blocking localhost connections
4. **System resources**: Make sure you have enough RAM (at least 4GB free)

---

**Last Updated**: 2025-12-31
**App Version**: 0.1.0
