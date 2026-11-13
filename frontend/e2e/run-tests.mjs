import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { logPythonSelection, resolveProjectPython } from './resolve-python.mjs';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(frontendRoot, '..');
const playwrightCli = join(frontendRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const reportsDir = join(repoRoot, 'reports');

const argv = process.argv.slice(2);
const visualMode = argv.includes('--visual') || process.env.E2E_SUITE === 'visual';
const continueOnError = argv.includes('--continue-on-error') || process.env.E2E_CONTINUE_ON_ERROR === '1';
const forwardedArgs = argv.filter(arg => arg !== '--visual' && arg !== '--continue-on-error');

const isScopedRun = forwardedArgs.some(
  arg => arg.includes('.spec.') || arg.startsWith('--grep') || arg.startsWith('--project='),
);

/** Dedicated specs — each runs in its own runner phase; must never also run in e2e-smoke. */
const DEDICATED_SPECS = {
  firstSession: 'e2e/first-session.spec.ts',
  chapterOne: 'e2e/chapter-one-quest.spec.ts',
  bellWarden: 'e2e/bell-warden-ui.spec.ts',
  defeatRecovery: 'e2e/fallen.spec.ts',
  combatReactions: 'e2e/combat-reactions.spec.ts',
  ghoul: 'e2e/ghoul-paralysis-combat.spec.ts',
  savingThrow: 'e2e/saving-throw-combat.spec.ts',
  spellSave: 'e2e/spell-save-combat.spec.ts',
};

const PHASE_TIMEOUT_MS = {
  [DEDICATED_SPECS.firstSession]: 120_000,
  [DEDICATED_SPECS.chapterOne]: 180_000,
  [DEDICATED_SPECS.bellWarden]: 240_000,
  [DEDICATED_SPECS.defeatRecovery]: 90_000,
  [DEDICATED_SPECS.combatReactions]: 120_000,
  [DEDICATED_SPECS.ghoul]: 120_000,
  [DEDICATED_SPECS.savingThrow]: 120_000,
  [DEDICATED_SPECS.spellSave]: 120_000,
  'e2e-smoke': 480_000,
  visual: 180_000,
};

const SUITE_HARD_LIMIT_MS = 25 * 60 * 1000;
const E2E_PORTS = [8001, 5174];

function expandCombatSavesPhases(phases) {
  const out = [];
  for (const phase of phases) {
    const isWholeCombatSaves =
      phase.includes('--project=combat-saves')
      && !phase.some(arg => arg.includes('.spec.'));
    if (isWholeCombatSaves) {
      out.push(
        ['--project=combat-saves', DEDICATED_SPECS.combatReactions],
        ['--project=combat-saves', DEDICATED_SPECS.ghoul],
        ['--project=combat-saves', DEDICATED_SPECS.savingThrow],
        ['--project=combat-saves', DEDICATED_SPECS.spellSave],
      );
    } else {
      out.push(phase);
    }
  }
  return out;
}

const FULL_SUITE_PHASES = expandCombatSavesPhases(
  visualMode
    ? [['--project=visual']]
    : [
      ['--project=chapter-journey', DEDICATED_SPECS.firstSession],
      ['--project=chapter-journey', DEDICATED_SPECS.chapterOne],
      ['--project=chapter-journey', DEDICATED_SPECS.defeatRecovery],
      ['--project=chapter-journey', DEDICATED_SPECS.bellWarden],
      ['--project=combat-saves'],
      ['--project=e2e-smoke'],
    ],
);

function phaseTimeoutMs(phaseArgs) {
  const spec = phaseArgs.find(arg => arg.includes('.spec.'));
  if (spec && PHASE_TIMEOUT_MS[spec]) return PHASE_TIMEOUT_MS[spec];
  if (phaseArgs.includes('--project=e2e-smoke')) return PHASE_TIMEOUT_MS['e2e-smoke'];
  if (phaseArgs.includes('--project=visual')) return PHASE_TIMEOUT_MS.visual;
  return 180_000;
}

function phaseSpecLabel(phaseArgs) {
  const spec = phaseArgs.find(arg => arg.includes('.spec.'));
  if (spec) return [spec.replace(/^e2e\//, '')];
  if (phaseArgs.includes('--project=e2e-smoke')) return listSmokeSpecs();
  if (phaseArgs.includes('--project=visual')) return ['visual-baseline.spec.ts'];
  return phaseArgs;
}

function listSmokeSpecs() {
  const dedicatedBasenames = new Set([
    ...Object.values(DEDICATED_SPECS).map(s => basename(s)),
    'visual-baseline.spec.ts',
  ]);
  return readdirSync(join(frontendRoot, 'e2e'))
    .filter(name => name.endsWith('.spec.ts') && !dedicatedBasenames.has(name))
    .sort();
}

function assertNoDedicatedInSmoke(smokeSpecs) {
  const dedicatedBasenames = Object.values(DEDICATED_SPECS).map(s => basename(s));
  const overlap = smokeSpecs.filter(name => dedicatedBasenames.includes(name));
  if (overlap.length > 0) {
    throw new Error(`e2e-smoke incorrectly includes dedicated specs: ${overlap.join(', ')}`);
  }
}

function listenersOnPort(port) {
  if (process.platform !== 'win32') {
    const out = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
    return (out.stdout || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => /^\d+$/.test(line))
      .map(Number);
  }
  const listed = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue |`
        + ' Where-Object { $_.State -eq \'Listen\' } |'
        + ' Select-Object -ExpandProperty OwningProcess -Unique',
    ],
    { encoding: 'utf8' },
  );
  return (listed.stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^\d+$/.test(line))
    .map(Number);
}

function describePid(pid) {
  if (process.platform !== 'win32') return `pid=${pid}`;
  const probe = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction SilentlyContinue;`
        + ' if ($p) { $p.CommandLine } else { "missing" }',
    ],
    { encoding: 'utf8' },
  );
  return `pid=${pid} cmd=${(probe.stdout || '').trim() || 'unknown'}`;
}

function assertPortsFree(when) {
  for (const port of E2E_PORTS) {
    const pids = listenersOnPort(port);
    if (pids.length > 0) {
      const detail = pids.map(describePid).join(' | ');
      throw new Error(
        `[e2e] Port ${port} busy ${when}. Refusing to kill foreign processes. ${detail}`,
      );
    }
  }
  console.info(`[e2e] Ports ${E2E_PORTS.join('/')} free ${when}`);
}

function killOwnedTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8' });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
  }
}

/** Ports 8001/5174 are reserved for this runner — reap leftover uvicorn/vite after owned-tree kill. */
function reapReservedE2eListeners(when) {
  for (const port of E2E_PORTS) {
    for (const pid of listenersOnPort(port)) {
      const detail = describePid(pid);
      const owned =
        /uvicorn\s+app\.api:app/.test(detail)
        || /vite/.test(detail)
        || /--port\s+8001|--port\s+5174/.test(detail);
      if (!owned) {
        console.error(`[e2e] Leaving foreign listener on ${port} ${when}: ${detail}`);
        continue;
      }
      console.info(`[e2e] Reaping reserved listener on ${port} ${when}: ${detail}`);
      killOwnedTree(pid);
    }
  }
}

function rmDatabaseDir(dir) {
  const resolved = resolve(dir);
  if (
    dirname(resolved) !== resolve(tmpdir())
    || !basename(resolved).startsWith('doupedraka-e2e-')
  ) {
    throw new Error(`Refusing to remove unexpected E2E database directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
}

function runPlaywright(extraArgs, databaseDirectory, e2ePython, timeoutMs) {
  return new Promise(resolvePromise => {
    const playwrightArgs = [playwrightCli, 'test', '--config=e2e/playwright.config.ts', ...extraArgs];
    const child = spawn(process.execPath, playwrightArgs, {
      cwd: frontendRoot,
      env: {
        ...process.env,
        E2E_PYTHON: e2ePython,
        E2E_DATABASE_DIRECTORY: databaseDirectory,
        ...(visualMode ? { E2E_SUITE: 'visual' } : {}),
      },
      stdio: 'inherit',
      ...(process.platform === 'win32' ? {} : { detached: true }),
    });

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(result);
    };

    const timer = setTimeout(() => {
      console.error(`[e2e] Phase TIMEOUT after ${timeoutMs}ms — killing owned Playwright tree pid=${child.pid}`);
      killOwnedTree(child.pid);
      finish({ code: 1, status: 'TIMEOUT', ownedPid: child.pid });
    }, timeoutMs);

    child.once('error', (error) => {
      console.error('[e2e] Playwright spawn failed:', error);
      killOwnedTree(child.pid);
      finish({ code: 1, status: 'FAIL', ownedPid: child.pid });
    });
    child.once('close', (code, signal) => {
      finish({
        code: code ?? (signal ? 1 : 0),
        status: (code ?? 1) === 0 ? 'PASS' : 'FAIL',
        ownedPid: child.pid,
      });
    });
  });
}

function writeMachineReport(payload) {
  mkdirSync(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(reportsDir, `e2e-matrix-${stamp}.json`);
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.info(`[e2e] Wrote ${path}`);
  return path;
}

async function main() {
  const startedAt = Date.now();
  const python = resolveProjectPython();
  logPythonSelection(python);

  const importProbe = spawnSync(
    python.path,
    ['-c', 'import fastapi, uvicorn; import app.api; print("ok")'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (importProbe.status !== 0) {
    throw new Error(`E2E Python cannot import app stack:\n${importProbe.stderr || importProbe.stdout}`);
  }
  console.info('[e2e] Preflight imports: ok');

  const rawPhases = isScopedRun
    ? [forwardedArgs]
    : FULL_SUITE_PHASES.map(phase => [...phase, ...forwardedArgs.filter(a => !a.startsWith('--project='))]);
  const phases = expandCombatSavesPhases(rawPhases);

  console.info(`[e2e] continue-on-error=${continueOnError ? 'yes' : 'no'} phases=${phases.length}`);
  for (let i = 0; i < phases.length; i += 1) {
    const specs = phaseSpecLabel(phases[i]);
    if (phases[i].includes('--project=e2e-smoke')) assertNoDedicatedInSmoke(specs);
    console.info(`[e2e] Phase plan ${i + 1}/${phases.length}: ${phases[i].join(' ')}`);
    console.info(`[e2e]   specs: ${specs.join(', ')}`);
    console.info(`[e2e]   timeout: ${phaseTimeoutMs(phases[i])}ms`);
  }

  let exitCode = 0;
  const phaseResults = [];

  for (let index = 0; index < phases.length; index += 1) {
    if (Date.now() - startedAt > SUITE_HARD_LIMIT_MS) {
      console.error('[e2e] Suite hard limit 25m reached — stopping');
      for (let skipped = index; skipped < phases.length; skipped += 1) {
        phaseResults.push({
          index: skipped + 1,
          label: phases[skipped].join(' '),
          specs: phaseSpecLabel(phases[skipped]),
          status: 'NOT RUN',
          reason: 'suite_hard_limit',
          durationMs: 0,
        });
      }
      exitCode = 1;
      break;
    }

    const databaseDirectory = join(
      tmpdir(),
      `doupedraka-e2e-${process.pid}-${index}-${Date.now().toString(36)}`,
    );
    mkdirSync(databaseDirectory, { recursive: true });
    const phaseArgs = phases[index];
    const phaseLabel = phaseArgs.join(' ');
    const timeoutMs = phaseTimeoutMs(phaseArgs);
    const specs = phaseSpecLabel(phaseArgs);
    console.info(`[e2e] Phase ${index + 1}/${phases.length}: ${phaseLabel}`);

    try {
      assertPortsFree('before phase');
    } catch (error) {
      console.error(String(error.message || error));
      phaseResults.push({
        index: index + 1,
        label: phaseLabel,
        specs,
        status: 'FAIL',
        reason: 'ports_busy_before',
        durationMs: 0,
      });
      exitCode = 1;
      for (let skipped = index + 1; skipped < phases.length; skipped += 1) {
        phaseResults.push({
          index: skipped + 1,
          label: phases[skipped].join(' '),
          specs: phaseSpecLabel(phases[skipped]),
          status: 'NOT RUN',
          reason: 'stopped_after_port_conflict',
          durationMs: 0,
        });
      }
      break;
    }

    const phaseStarted = Date.now();
    let result = { code: 1, status: 'FAIL', ownedPid: null };
    try {
      result = await runPlaywright(phaseArgs, databaseDirectory, python.path, timeoutMs);
    } finally {
      if (result.ownedPid) killOwnedTree(result.ownedPid);
      // Playwright webServer can outlive the killed Node tree on Linux (detached).
      reapReservedE2eListeners(`after phase ${index + 1} cleanup`);
      try {
        rmDatabaseDir(databaseDirectory);
      } catch (error) {
        console.error(error.message);
        exitCode = 1;
      }
    }

    const durationMs = Date.now() - phaseStarted;
    let status = result.status;
    let reason;

    try {
      assertPortsFree('after phase');
    } catch (error) {
      console.error(String(error.message || error));
      status = 'FAIL';
      reason = 'ports_busy_after_owned_cleanup';
      exitCode = 1;
      phaseResults.push({
        index: index + 1,
        label: phaseLabel,
        specs,
        status,
        reason,
        durationMs,
      });
      for (let skipped = index + 1; skipped < phases.length; skipped += 1) {
        phaseResults.push({
          index: skipped + 1,
          label: phases[skipped].join(' '),
          specs: phaseSpecLabel(phases[skipped]),
          status: 'NOT RUN',
          reason: 'stopped_after_unclean_ports',
          durationMs: 0,
        });
      }
      break;
    }

    if (status !== 'PASS') {
      exitCode = 1;
      phaseResults.push({ index: index + 1, label: phaseLabel, specs, status, reason, durationMs });
      if (!continueOnError) {
        for (let skipped = index + 1; skipped < phases.length; skipped += 1) {
          phaseResults.push({
            index: skipped + 1,
            label: phases[skipped].join(' '),
            specs: phaseSpecLabel(phases[skipped]),
            status: 'NOT RUN',
            durationMs: 0,
          });
        }
        break;
      }
      // continue-on-error: FAIL/TIMEOUT may continue only after ports verified free above.
    } else {
      phaseResults.push({ index: index + 1, label: phaseLabel, specs, status: 'PASS', durationMs });
    }
  }

  const totalMs = Date.now() - startedAt;
  console.info('[e2e] Phase summary:');
  for (const row of phaseResults) {
    console.info(
      `  ${row.index}/${phases.length} ${row.status}: ${row.label}`
        + ` (${Math.round((row.durationMs || 0) / 1000)}s)`
        + (row.reason ? ` [${row.reason}]` : ''),
    );
  }

  const anyFail = phaseResults.some(row => row.status === 'FAIL' || row.status === 'TIMEOUT');
  const anyNotRun = phaseResults.some(row => row.status === 'NOT RUN');
  let suiteResult = 'ALL PHASES PASS';
  if (anyFail || anyNotRun) {
    suiteResult = 'NOT GREEN (fail/timeout/skip — do not treat as full-suite pass)';
  }
  console.info(`[e2e] Suite result: ${suiteResult}`);
  console.info(`[e2e] Total duration: ${Math.round(totalMs / 1000)}s exit=${exitCode}`);

  writeMachineReport({
    headHint: 'local-working-tree',
    continueOnError,
    python: {
      path: python.path,
      version: python.version,
      prefix: python.prefix,
      basePrefix: python.basePrefix,
    },
    suiteResult,
    exitCode,
    totalMs,
    phases: phaseResults,
  });

  process.exitCode = exitCode;
}

main().catch(error => {
  console.error('Could not run Playwright:', error);
  process.exitCode = 1;
});
