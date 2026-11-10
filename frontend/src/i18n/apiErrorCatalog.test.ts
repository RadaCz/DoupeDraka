import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PLAYER_FACING_API_ERRORS } from './playerFacingErrors';

function extractCsKeys(source: string): Set<string> {
  const start = source.indexOf('const cs: Record<string, string> = {');
  const end = source.indexOf('\n};', start);
  const keys = new Set<string>();
  const keyRe = /^\s*'((?:[^'\\]|\\.)*)':/;
  const bareRe = /^\s*([A-Za-z][A-Za-z0-9]*):/;
  for (const line of source.slice(start, end).split('\n')) {
    const quoted = line.match(keyRe);
    if (quoted) {
      keys.add(quoted[1].replace(/\\'/g, "'"));
      continue;
    }
    const bare = line.match(bareRe);
    if (bare) keys.add(bare[1]);
  }
  return keys;
}

describe('API error catalog parity', () => {
  const i18nSource = fs.readFileSync(path.join(import.meta.dirname, '..', 'i18n.tsx'), 'utf8');
  const csKeys = extractCsKeys(i18nSource);

  it('every mapped player-facing API error has a Czech catalog entry', () => {
    const missing: string[] = [];
    for (const key of Object.keys(PLAYER_FACING_API_ERRORS)) {
      if (!csKeys.has(key)) missing.push(key);
    }
    expect(missing, missing.join(', ')).toEqual([]);
  });
});
