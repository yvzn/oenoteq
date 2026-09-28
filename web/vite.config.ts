/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    // Skip the proxy for HTML navigations (e.g. /wines/new) so they fall
    // through to the SPA's index.html instead of hitting the backend.
    proxy: Object.fromEntries(
      ['/wines', '/appellations', '/producers', '/meals', '/consumptions', '/meal-pairings', '/search', '/health'].map((path) => [
        path,
        {
          target: 'http://localhost:8080',
          bypass(req: import('http').IncomingMessage) {
            if (req.headers.accept?.includes('text/html')) return '/index.html'
          },
        },
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/dialogPolyfill.ts'],
    pool: 'vmThreads',
  },
})
