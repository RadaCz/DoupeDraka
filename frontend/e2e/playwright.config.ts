import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
if (!process.env.E2E_DATABASE_DIRECTORY) {
  throw new Error('Run the E2E suite with npm run test:e2e to manage its temporary database.');
}

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'line',
  outputDir: '../.playwright-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node frontend/e2e/start-api.mjs',
      cwd: repositoryRoot,
      url: 'http://127.0.0.1:8001/health',
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
      cwd: frontendRoot,
      url: 'http://127.0.0.1:5174',
      timeout: 60_000,
      reuseExistingServer: false,
      env: { VITE_API_PROXY_TARGET: 'http://127.0.0.1:8001' },
    },
  ],
});
