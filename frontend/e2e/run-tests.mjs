import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const databaseDirectory = join(tmpdir(), `doupedraka-e2e-${process.pid}`);
const playwrightCli = join(frontendRoot, 'node_modules', '@playwright', 'test', 'cli.js');
mkdirSync(databaseDirectory, { recursive: false });

const argv = process.argv.slice(2);
const visualMode = argv.includes('--visual') || process.env.E2E_SUITE === 'visual';
const forwardedArgs = argv.filter(arg => arg !== '--visual');

const playwrightArgs = [playwrightCli, 'test', '--config=e2e/playwright.config.ts', ...forwardedArgs];

const child = spawn(process.execPath, playwrightArgs, {
  cwd: frontendRoot,
  env: {
    ...process.env,
    E2E_DATABASE_DIRECTORY: databaseDirectory,
    ...(visualMode ? { E2E_SUITE: 'visual' } : {}),
  },
  stdio: 'inherit',
});

let spawnFailed = false;
child.once('error', error => {
  spawnFailed = true;
  console.error('Could not start Playwright:', error);
});

child.once('close', (code, signal) => {
  process.exitCode = spawnFailed ? 1 : (code ?? (signal ? 1 : 0));

  const resolved = resolve(databaseDirectory);
  if (
    dirname(resolved) !== resolve(tmpdir()) ||
    !basename(resolved).startsWith('doupedraka-e2e-')
  ) {
    console.error(`Refusing to remove unexpected E2E database directory: ${resolved}`);
    process.exitCode = 1;
    return;
  }

  try {
    rmSync(resolved, { recursive: true, force: true });
  } catch (error) {
    console.error(`Could not remove the E2E database directory ${resolved}:`, error);
    process.exitCode = 1;
  }
});
