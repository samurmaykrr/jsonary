import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import million from 'million/compiler'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Keep production bundles below warning thresholds by splitting third-party
 * dependencies into stable per-package chunks.
 *
 * Why this approach:
 * - This project is a single-page app with many editor-focused dependencies.
 * - Without explicit chunking, Rollup tends to produce one very large vendor
 *   chunk that triggers Vite's 500 kB warning and slows initial parse time.
 * - Per-package chunking keeps cacheability high and reduces first-load work.
 */
function getVendorChunkName(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined

  const normalizedId = id.replace(/\\/g, '/')
  const packagePath = normalizedId.split('/node_modules/').at(-1)
  if (!packagePath) return 'vendor-misc'

  const [first, second] = packagePath.split('/')
  if (!first) return 'vendor-misc'

  const packageName = first.startsWith('@') && second
    ? `${first}/${second}`
    : first

  if (packageName) {
    return `vendor-${packageName.replace('/', '-')}`
  }

  return 'vendor-misc'
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: getVendorChunkName,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts', 'src/components/**/*.{ts,tsx}'],
    },
  },
  plugins: [
    million.vite({ auto: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Jsonary',
        short_name: 'Jsonary',
        description: 'A powerful JSON editor with text, tree, and table views',
        theme_color: '#0f0f11',
        background_color: '#0f0f11',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['developer tools', 'productivity', 'utilities'],
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'New Document',
            short_name: 'New',
            description: 'Create a new JSON document',
            url: '/?new=true',
            icons: [{ src: 'icon.svg', sizes: 'any' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // Enable for testing in dev mode
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'next/navigation.js': path.resolve(__dirname, './src/shims/next-navigation.ts'),
    },
  },
})
