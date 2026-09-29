/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,
      },
      workbox: {
        // Precache the built app shell only — API responses are not cached here.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'Oenoteq – Wine Cellar Tracker',
        short_name: 'Oenoteq',
        description: 'Track your wine cellar, consumption, and meal pairings.',
        theme_color: '#6e1f2e',
        background_color: '#dcd3bd',
        display: 'standalone',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
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
    setupFiles: ['./src/test/dialogPolyfill.ts', './src/test/fakeIndexedDb.ts', './src/test/resetLocalDb.ts'],
    pool: 'vmThreads',
  },
})
