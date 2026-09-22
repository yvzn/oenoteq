/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: Object.fromEntries(
      ['/wines', '/appellations', '/meals', '/search', '/health'].map((path) => [
        path,
        'http://localhost:8080',
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
