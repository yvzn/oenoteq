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
      registerType: 'prompt',
      devOptions: {
        enabled: false,
      },
      workbox: {
        // Precache the built app shell only — API responses are not cached here.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Fold the Workbox runtime into sw.js: the separate workbox-<hash>.js is behind Easy Auth (401 without a session), so an update check with an expired session would fail.
        inlineWorkboxRuntime: true,
        // Auth routes are served by Easy Auth, not the SPA, so navigations to them must bypass the index.html fallback.
        navigateFallbackDenylist: [/^\/\.auth\//],
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
    setupFiles: ['./src/test/dialogPolyfill.ts', './src/test/autoUnmount.ts', './src/test/i18n.ts', './src/test/consent.ts', './src/test/fakeIndexedDb.ts', './src/test/resetLocalDb.ts'],
    pool: 'vmThreads',
    // One worker per core starves the machine (memory pressure), stalling single IndexedDB
    // round trips for seconds and timing out liveQuery tests; half the cores is no slower.
    maxWorkers: '50%',
    // The first test of a view suite pays the cold import of the component graph; with every
    // worker busy that can pass the 5s default.
    testTimeout: 15000,
    projects: [
      // Everything, as a user who granted storage (Offline Mode).
      { extends: true, test: { name: 'offline-mode', env: { TEST_CONSENT: 'granted' } } },
      // The view and composable suites again, as a user who refused (direct adapter). Suites about
      // the sync page and its queue only exist with Offline Mode; tests tied to the local store
      // inside shared suites use itOfflineOnly.
      {
        extends: true,
        test: {
          name: 'online-only',
          env: { TEST_CONSENT: 'refused' },
          include: ['src/views/**/*.test.ts', 'src/composables/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/SyncStatusView.test.ts', '**/useSyncStatus.test.ts'],
        },
      },
    ],
  },
})
