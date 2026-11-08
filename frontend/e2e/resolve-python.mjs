import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function candidates() {
  const env = process.env.E2E_PYTHON || process.env.PYTHON || '';
  if (env.trim()) return [env.trim()];
  const isWin = process.platform === 'win32';
  const venv = isWin
    ? join(repoRoot, '.venv', 'Scripts', 'python.exe')
    : join(repoRoot, '.venv', 'bin', 'python');
  const fallbacks = isWin ? ['python', 'py', 'python3'] : ['python3', 'python'];
  return [venv, ...fallbacks];
}

export function resolveProjectPython() {
  for (const candidate of candidates()) {
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (!existsSync(candidate)) continue;
    }
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) {
      return { path: candidate, version: (probe.stdout || probe.stderr || '').trim() };
    }
  }
  throw new Error(
    'No Python interpreter found for E2E. Set E2E_PYTHON or PYTHON, or create a project .venv with dependencies installed.',
  );
}
