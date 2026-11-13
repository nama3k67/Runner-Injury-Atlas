import { defineConfig } from 'vitest/config';

// Unit tests only. Browser tests live in e2e/ and run with `pnpm e2e`.
export default defineConfig({ test: { include: ['src/**/*.test.{ts,tsx}'] } });
