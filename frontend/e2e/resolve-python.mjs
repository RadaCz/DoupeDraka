import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function venvPath(name) {
  return process.platform === 'win32'
    ? join(repoRoot, name, 'Scripts', 'python.exe')
    : join(repoRoot, name, 'bin', 'python');
}

function isFilesystemPath(candidate) {
  return candidate.includes('/') || candidate.includes('\\') || /^[A-Za-z]:/.test(candidate);
}

function probe(pythonPath) {
  if (isFilesystemPath(pythonPath) && !existsSync(pythonPath)) return null;
  const version = spawnSync(pythonPath, ['--version'], { encoding: 'utf8' });
  if (version.status !== 0) return null;
  const meta = spawnSync(
    pythonPath,
    ['-c', 'import sys; print(sys.executable); print(sys.prefix); print(sys.base_prefix)'],
    { encoding: 'utf8' },
  );
  if (meta.status !== 0) return null;
  const [executable, prefix, basePrefix] = (meta.stdout || '').trim().split(/\r?\n/);
  return {
    path: pythonPath,
    version: (version.stdout || version.stderr || '').trim(),
    executable,
    prefix,
    basePrefix,
  };
}

/**
 * Prefer E2E_PYTHON, then .venv-e2e, then project .venv.
 * CI (setup-python) has no repo venv — allow `python`/`python3` only when base_prefix is clean.
 * Never accept a voice-pro base interpreter.
 */
export function resolveProjectPython() {
  const ordered = [];
  if (process.env.E2E_PYTHON?.trim()) ordered.push(process.env.E2E_PYTHON.trim());
  ordered.push(venvPath('.venv-e2e'), venvPath('.venv'));
  if (process.platform === 'win32') {
    ordered.push('python', 'py');
  } else {
    ordered.push('python3', 'python');
  }

  const errors = [];
  for (const candidate of ordered) {
    const resolved = probe(candidate);
    if (!resolved) {
      errors.push(`${candidate}: missing or not executable`);
      continue;
    }
    if (/voice-pro/i.test(resolved.basePrefix || '') || /voice-pro/i.test(resolved.executable || '')) {
      errors.push(`${candidate}: base_prefix/executable is voice-pro (${resolved.basePrefix})`);
      continue;
    }
    // Bare PATH fallback is last-resort for CI; prefer reporting the resolved executable path.
    return {
      ...resolved,
      path: resolved.executable || resolved.path,
    };
  }
  throw new Error(
    'No safe E2E Python found. Set E2E_PYTHON, create .venv-e2e, or use a clean CPython. '
      + `Tried:\n- ${errors.join('\n- ')}`,
  );
}

export function logPythonSelection(resolved) {
  console.info('[e2e] Python path:', resolved.path);
  console.info('[e2e] Python version:', resolved.version);
  console.info('[e2e] sys.prefix:', resolved.prefix);
  console.info('[e2e] sys.base_prefix:', resolved.basePrefix);
}
