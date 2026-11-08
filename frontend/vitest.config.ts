import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    // jsdom defaults to about:blank, an opaque origin where localStorage is
    // unavailable; the app persists its token there, so tests need a real URL.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: './src/setupTests.ts',
    globals: true,
  },
});