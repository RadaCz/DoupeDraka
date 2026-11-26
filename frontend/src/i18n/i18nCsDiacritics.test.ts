import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCzechDiacritics } from './csDiacritics';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Legacy ASCII-only Czech tokens that must not appear in raw `cs` values (Úkol 23). */
const FORBIDDEN_ASCII_CS = [
  'kazdy',
  'pruzkum',
  'dobrodruzne',
  'historicka',
  'pripravovano',
  'dalsi',
  'nepritel',
  'aktualni',
  'planovaci',
  'nahodny',
  'bezpecny',
  'odmitnute',
  'hazi',
  'ceka',
  'mlcky',
  'sesilacich',
  'oddelene',
  'dobrodruznou',
  'zkusis',
  'odpocinek',
  'utok',
  'utek',
  'misto',
  'mape',
  'zastavka',
  'nastroje',
  'obtiznost',
  'goblini',
  'Rasove',
  'Navyseni',
  'Tulak',
  'Carodej',
  'Temnobys',
  'Odlozeno',
  'Bojovnik',
  'clovek',
  'vycvik',
  'okoli',
  'potopene',
  'zapomenutych',
  'Jmeno',
  'Vybaveni',
  'Ozvena',
];

function extractCsValues(i18nSource: string): string[] {
  const start = i18nSource.indexOf('const cs: Record<string, string> = {');
  const end = i18nSource.indexOf('\n};', start);
  const values: string[] = [];
  for (const line of i18nSource.slice(start, end).split('\n')) {
    const inline = line.match(/:\s*'((?:\\.|[^'\\])*)'\s*,?\s*$/);
    if (inline) {
      values.push(inline[1].replace(/\\'/g, "'"));
      continue;
    }
    const cont = line.match(/^\s+'((?:\\.|[^'\\])*)'\s*,?\s*$/);
    if (cont && !line.includes(':')) values.push(cont[1].replace(/\\'/g, "'"));
  }
  return values;
}

describe('i18n.tsx Czech source strings (Úkol 23)', () => {
  const values = extractCsValues(fs.readFileSync(path.join(ROOT, 'i18n.tsx'), 'utf8'));

  it('has Czech values to scan', () => {
    expect(values.length).toBeGreaterThan(200);
  });

  it('does not contain legacy no-diacritic Czech tokens', () => {
    const pattern = new RegExp(`\\b(${FORBIDDEN_ASCII_CS.join('|')})\\b`, 'i');
    const hits: string[] = [];
    for (const value of values) {
      const match = value.match(pattern);
      if (match) hits.push(`${match[1]} in „${value.slice(0, 72)}…“`);
    }
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('does not rely on runtime csDiacritics patching for cs record values', () => {
    const patched: string[] = [];
    for (const value of values) {
      if (applyCzechDiacritics(value) !== value) patched.push(value.slice(0, 80));
    }
    expect(patched, patched.join('\n')).toEqual([]);
  });
});