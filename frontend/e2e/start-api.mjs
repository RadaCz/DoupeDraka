import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const python = join(root, '.venv', 'Scripts', 'python.exe');
const E2E_BOT_TOKEN = '123456:e2e-test-token';
if (!existsSync(python)) {
  throw new Error(`Project Python environment was not found at ${python}. Install requirements.txt first.`);
}

const databaseDirectory = process.env.E2E_DATABASE_DIRECTORY;
if (!databaseDirectory) {
  throw new Error('E2E_DATABASE_DIRECTORY must be set by the Playwright configuration.');
}
const databasePath = join(databaseDirectory, 'e2e.db').replace(/\\/g, '/');
const child = spawn(
  python,
  ['-m', 'uvicorn', 'app.api:app', '--host', '127.0.0.1', '--port', '8001'],
  {
    cwd: root,
    env: {
      ...process.env,
      BOT_TOKEN: E2E_BOT_TOKEN,
      DATABASE_URL: `sqlite+aiosqlite:///${databasePath}`,
      LLM_PROVIDER: 'fallback',
      AUTH_RATE_LIMIT: '240/minute',
      ACTION_RATE_LIMIT: '240/minute',
    },
    stdio: 'inherit',
  },
);

child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
child.once('error', error => {
  console.error('Could not start the E2E API server:', error);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
