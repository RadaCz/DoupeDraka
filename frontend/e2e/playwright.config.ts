import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const visualOnly = process.env.E2E_SUITE === 'visual';

if (!process.env.E2E_DATABASE_DIRECTORY) {
  throw new Error('Run the E2E suite with npm run test:e2e to manage its temporary database.');
}
if (!process.env.E2E_PYTHON) {
  throw new Error('E2E_PYTHON must be set by frontend/e2e/run-tests.mjs (pinned interpreter).');
}

const databasePath = join(process.env.E2E_DATABASE_DIRECTORY, 'e2e.db').replace(/\\/g, '/');
const e2ePython = process.env.E2E_PYTHON;
// Playwright owns this process directly — no nested Node wrapper that orphans Uvicorn on Windows.
const apiCommand = process.platform === 'win32'
  ? `"${e2ePython}" -m uvicorn app.api:app --host 127.0.0.1 --port 8001`
  : `${e2ePython} -m uvicorn app.api:app --host 127.0.0.1 --port 8001`;

/** Specs with their own runner phase — must not also execute under e2e-smoke. */
const DEDICATED_SMOKE_IGNORE = [
  '**/chapter-one-quest.spec.ts',
  '**/bell-warden-ui.spec.ts',
  '**/combat-reactions.spec.ts',
  '**/ghoul-paralysis-combat.spec.ts',
  '**/saving-throw-combat.spec.ts',
  '**/spell-save-combat.spec.ts',
  '**/visual-baseline.spec.ts',
];

export default defineConfig({
  testDir: '.',
  testMatch: visualOnly ? ['**/visual-baseline.spec.ts'] : undefined,
  testIgnore: visualOnly ? [] : ['**/visual-baseline.spec.ts'],
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['line']],
  outputDir: '../.playwright-results',
  projects: visualOnly
    ? [{ name: 'visual', testMatch: ['**/visual-baseline.spec.ts'] }]
    : [
        {
          name: 'chapter-journey',
          testMatch: ['**/chapter-one-quest.spec.ts', '**/bell-warden-ui.spec.ts'],
          // Per-spec budgets are enforced by run-tests.mjs; keep project ceiling at chapter max.
          timeout: 300_000,
        },
        {
          name: 'combat-saves',
          testMatch: [
            '**/ghoul-paralysis-combat.spec.ts',
            '**/spell-save-combat.spec.ts',
            '**/saving-throw-combat.spec.ts',
            '**/combat-reactions.spec.ts',
          ],
          timeout: 120_000,
        },
        {
          name: 'e2e-smoke',
          testIgnore: DEDICATED_SMOKE_IGNORE,
          timeout: 120_000,
        },
      ],
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: apiCommand,
      cwd: repositoryRoot,
      url: 'http://127.0.0.1:8001/health',
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        BOT_TOKEN: '123456:e2e-test-token',
        DATABASE_URL: `sqlite+aiosqlite:///${databasePath}`,
        LLM_PROVIDER: 'fallback',
        AUTH_RATE_LIMIT: '240/minute',
        ACTION_RATE_LIMIT: '2000/minute',
        E2E_RNG_SEED: '27',
        E2E_DATABASE_DIRECTORY: process.env.E2E_DATABASE_DIRECTORY,
      },
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
