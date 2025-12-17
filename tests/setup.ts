import '@testing-library/jest-dom/vitest'

// Mock IndexedDB for persistence tests
const indexedDB = {
  open: () => ({
    onsuccess: null,
    onerror: null,
  }),
}

Object.defineProperty(globalThis, 'indexedDB', {
  value: indexedDB,
  writable: true,
})

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
