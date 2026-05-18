// Frontend Vitest setup.
// - Silences noisy console output (waitLogger-style streams).
// - Mocks the things that aren't worth importing in tests (Privy SDKs, Next.js
//   internals), per-test if needed via vi.mock at the top of a spec.
// - Provides @testing-library/jest-dom matchers.

import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Silence verbose logging that other modules pump out during tests.
const noopLog = () => undefined;
console.log = noopLog;
console.warn = noopLog;
console.error = noopLog;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
