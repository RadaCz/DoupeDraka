import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const T_CALL = /\bt\(\s*['"]([^'"]+)['"]\s*\)/g;

/** UI surfaces covered by Sprint 41 polish — full Czech required here. */
const SPRINT41_REL_PATHS = [
  'screens/sharedPlayUI.tsx',
  'GameScreens.tsx',
  'map/MapScreen.tsx',
  'character/CharacterInventoryPanel.tsx',
];

/** Auth / settings strings touched in Sprint 41 UX pass */
const SPRINT41_EXTRA_KEYS = [
  'Sign in to continue',
  'Link Telegram',
  'Connect this browser account to your Telegram identity so both entry points share the same heroes.',
  'Linking…',
  'Link Telegram now',
  'Close help',
  'Pick a spell',
  'Lite storyteller',
  'Story turns use the free offline narrator. Credits apply only if you enable paid narration in Settings.',
];

function extractCsKeys(i18nSource: string): Set<string> {
  const start = i18nSource.indexOf('const cs: Record<string, string> = {');
  const end = i18nSource.indexOf('\n};', start);
  const keys = new Set<string>();
  const quotedRe = /^\s*'((?:[^'\\]|\\.)*)':/;
  const bareRe = /^\s*([A-Za-z][\w]*):/;
  for (const line of i18nSource.slice(start, end).split('\n')) {
    const quoted = line.match(quotedRe);
    if (quoted) {
      keys.add(quoted[1].replace(/\\'/g, "'"));
      continue;
    }
    const bare = line.match(bareRe);
    if (bare) keys.add(bare[1]);
  }
  return keys;
}

function keysFromFile(relative: string): Set<string> {
  const text = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const keys = new Set<string>();
  for (const match of text.matchAll(T_CALL)) keys.add(match[1]);
  return keys;
}

describe('Czech UI translation coverage (Sprint 41 surfaces)', () => {
  it('maps every t() key in play, home, settings, auth, map, inventory overlays', () => {
    const csKeys = extractCsKeys(fs.readFileSync(path.join(ROOT, 'i18n.tsx'), 'utf8'));
    const used = new Set<string>();
    for (const rel of SPRINT41_REL_PATHS) {
      for (const key of keysFromFile(rel)) used.add(key);
    }
    for (const key of SPRINT41_EXTRA_KEYS) used.add(key);
    const missing = [...used].filter(key => !csKeys.has(key));
    expect(missing, `Missing cs entries: ${missing.join(' | ')}`).toEqual([]);
  });
});