import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Frontend Vitest config. We use jsdom for the React hook / RTL tests, plus
// path aliases that mirror tsconfig.json.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './config'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30_000,
  },
});
