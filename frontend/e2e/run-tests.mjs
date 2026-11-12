import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCli = join(frontendRoot, 'node_modules', '@playwright', 'test', 'cli.js');

const argv = process.argv.slice(2);
const visualMode = argv.includes('--visual') || process.env.E2E_SUITE === 'visual';
const forwardedArgs = argv.filter(arg => arg !== '--visual');

const isScopedRun = forwardedArgs.some(
  arg => arg.includes('.spec.') || arg.startsWith('--grep') || arg === '--project=chapter-journey'
    || arg === '--project=combat-saves' || arg === '--project=e2e-smoke' || arg.startsWith('--project='),
);

/** Each combat-saves spec gets its own API process so global E2E_RNG_SEED=27 rewinds (Sprint 30). */
const COMBAT_SAVES_SPECS = [
  'e2e/combat-reactions.spec.ts',
  'e2e/ghoul-paralysis-combat.spec.ts',
  'e2e/saving-throw-combat.spec.ts',
  'e2e/spell-save-combat.spec.ts',
];

function expandCombatSavesPhases(phases) {
  const out = [];
  for (const phase of phases) {
    const isWholeCombatSaves =
      phase.includes('--project=combat-saves')
      && !phase.some(arg => arg.includes('.spec.'));
    if (isWholeCombatSaves) {
      for (const spec of COMBAT_SAVES_SPECS) {
        out.push(['--project=combat-saves', spec]);
      }
    } else {
      out.push(phase);
    }
  }
  return out;
}

/** Full matrix: one Playwright process per project so each gets a fresh API DB and E2E_RNG_SEED stream. */
const FULL_SUITE_PHASES = expandCombatSavesPhases(
  visualMode
    ? [['--project=visual']]
    : [
      // Each chapter spec needs its own API DB + E2E_RNG_SEED stream (see playwright.config.ts).
      ['--project=chapter-journey', 'e2e/chapter-one-quest.spec.ts'],
      ['--project=chapter-journey', 'e2e/bell-warden-ui.spec.ts'],
      ['--project=combat-saves'],
      ['--project=e2e-smoke'],
    ],
);

function rmDatabaseDir(dir) {
  const resolved = resolve(dir);
  if (
    dirname(resolved) !== resolve(tmpdir()) ||
    !basename(resolved).startsWith('doupedraka-e2e-')
  ) {
    throw new Error(`Refusing to remove unexpected E2E database directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
}

function runPlaywright(extraArgs, databaseDirectory) {
  return new Promise((resolvePromise, reject) => {
    const playwrightArgs = [playwrightCli, 'test', '--config=e2e/playwright.config.ts', ...extraArgs];
    const child = spawn(process.execPath, playwrightArgs, {
      cwd: frontendRoot,
      env: {
        ...process.env,
        E2E_DATABASE_DIRECTORY: databaseDirectory,
        ...(visualMode ? { E2E_SUITE: 'visual' } : {}),
      },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolvePromise(code ?? (signal ? 1 : 0));
    });
  });
}

async function main() {
  const rawPhases = isScopedRun
    ? [forwardedArgs]
    : FULL_SUITE_PHASES.map(phase => [...phase, ...forwardedArgs.filter(a => !a.startsWith('--project='))]);
  const phases = expandCombatSavesPhases(rawPhases);

  let exitCode = 0;
  for (let index = 0; index < phases.length; index += 1) {
    const databaseDirectory = join(tmpdir(), `doupedraka-e2e-${process.pid}-${index}`);
    mkdirSync(databaseDirectory, { recursive: false });
    const phaseLabel = phases[index].join(' ');
    console.info(`[e2e] Phase ${index + 1}/${phases.length}: ${phaseLabel}`);
    try {
      const code = await runPlaywright(phases[index], databaseDirectory);
      if (code !== 0) {
        exitCode = code;
        break;
      }
    } finally {
      try {
        rmDatabaseDir(databaseDirectory);
      } catch (error) {
        console.error(error.message);
        exitCode = 1;
      }
    }
  }
  process.exitCode = exitCode;
}

main().catch(error => {
  console.error('Could not run Playwright:', error);
  process.exitCode = 1;
});
