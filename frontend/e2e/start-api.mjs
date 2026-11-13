/**
 * Legacy helper / manual API boot.
 * The Playwright suite now launches Uvicorn directly via playwright.config.ts
 * so Windows process ownership is not split across a nested Node wrapper.
 *
 * Keep this file for ad-hoc debugging: `E2E_DATABASE_DIRECTORY=... node frontend/e2e/start-api.mjs`
 */
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logPythonSelection, resolveProjectPython } from './resolve-python.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const resolved = resolveProjectPython();
logPythonSelection(resolved);

const E2E_BOT_TOKEN = '123456:e2e-test-token';
const databaseDirectory = process.env.E2E_DATABASE_DIRECTORY;
if (!databaseDirectory) {
  throw new Error('E2E_DATABASE_DIRECTORY must be set.');
}
const databasePath = join(databaseDirectory, 'e2e.db').replace(/\\/g, '/');

try {
  const probe = await fetch('http://127.0.0.1:8001/health', { signal: AbortSignal.timeout(800) });
  if (probe.ok) {
    console.error('E2E API port 8001 is already in use. Refusing to start.');
    process.exit(1);
  }
} catch {
  /* free */
}

const child = spawn(
  resolved.path,
  ['-m', 'uvicorn', 'app.api:app', '--host', '127.0.0.1', '--port', '8001'],
  {
    cwd: root,
    env: {
      ...process.env,
      BOT_TOKEN: E2E_BOT_TOKEN,
      DATABASE_URL: `sqlite+aiosqlite:///${databasePath}`,
      LLM_PROVIDER: 'fallback',
      AUTH_RATE_LIMIT: '240/minute',
      ACTION_RATE_LIMIT: '2000/minute',
      E2E_RNG_SEED: '27',
    },
    stdio: 'inherit',
    windowsHide: true,
  },
);

function shutdown(code = 0) {
  if (child.pid) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8' });
    } else {
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch {
        /* gone */
      }
    }
  }
  process.exitCode = code;
}

child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
child.once('error', error => {
  console.error('Could not start the E2E API server:', error);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(1));
}
process.on('exit', () => {
  if (child.pid && !child.killed && process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8' });
  }
});
