/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Keeps the browser's address (no changeOrigin) and sends X-Forwarded-*, so the
      // API builds its links, Google's callback included, on localhost:5173.
      '/api': { target: 'http://localhost:8080', xfwd: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
