import { defineConfig, devices } from '@playwright/test';

const ADMIN_API_KEY = 'e2e-admin-key-e2e-admin-key-e2e';

// Boots the real stack: the built API on in-process Postgres (PGlite) and the
// prerendered web app. No Docker, no shared state between runs.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    // Set CHROME_PATH to reuse an installed Chrome instead of downloading one.
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  metadata: { adminKey: ADMIN_API_KEY },
  webServer: [
    {
      command: 'pnpm --filter @atlas/api build && pnpm --filter @atlas/api start',
      url: 'http://localhost:3001/api/health',
      env: { PORT: '3001', DATABASE_URL: 'pglite://memory', ADMIN_API_KEY },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm build && pnpm preview',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
