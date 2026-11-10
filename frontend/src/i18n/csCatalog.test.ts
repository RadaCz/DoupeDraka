import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ALLOW_ASCII = new Set([
  'SRD', 'XP', 'HP', 'API', 'MENU', 'JSON', 'Telegram', 'Fighter', 'Wizard', 'Rogue',
  'Paladin', 'Ranger', 'Champion', 'Lite', 'Normal', 'Doupě', 'Draka', 'Caldus', 'Nib',
  'Goblin', 'DEX', 'AC', 'DC', 'd20', 'k20', 'OZ', 'ST',
]);

const BANNED_MISSPELLINGS = new Set([
  'nepodarilo', 'udelas', 'chces', 'maximalni', 'zivoty', 'septajici',
  'vypravece', 'vytvorit', 'vytvor', 'prihlaseni', 'zpet', 'prazdny',
]);

const DOCUMENTED_ASCII_EXCEPTIONS: RegExp[] = [
  /\bCreative Commons\b/i,
  /\bFire Bolt\b/i,
  /\bCure Wounds\b/i,
  /\bMagic Missile\b/i,
  /\bOpenRouter\b/i,
  /\bMini App\b/i,
];

function extractCsEntries(source: string): Array<{ key: string; value: string }> {
  const start = source.indexOf('const cs: Record<string, string> = {');
  const end = source.indexOf('\n};', start);
  const entries: Array<{ key: string; value: string }> = [];
  const keyRe = /^\s*'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)',?\s*$/;
  for (const line of source.slice(start, end).split('\n')) {
    const m = line.match(keyRe);
    if (m) {
      entries.push({ key: m[1].replace(/\\'/g, "'"), value: m[2].replace(/\\'/g, "'") });
    }
  }
  return entries;
}

function isDocumentedAsciiException(value: string): boolean {
  return DOCUMENTED_ASCII_EXCEPTIONS.some(re => re.test(value));
}

function tokenizeWords(value: string): string[] {
  return (value.match(/[A-Za-zÁ-ž]+/g) ?? []).map(w => w.toLowerCase());
}

/** Suspect = word without Czech diacritics that looks like a Czech inflection (not blocklisted EN/SRD). */
function suspectWords(value: string): string[] {
  if (isDocumentedAsciiException(value)) return [];
  const suspects: string[] = [];
  for (const raw of value.match(/[A-Za-zÁ-ž]+/g) ?? []) {
    const lower = raw.toLowerCase();
    if (BANNED_MISSPELLINGS.has(lower)) suspects.push(lower);
    if (ALLOW_ASCII.has(raw) || ALLOW_ASCII.has(lower)) continue;
    if (/^[A-Z]{2,}$/.test(raw) && /[ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(raw)) continue;
    if (/[áčďéěíňóřšťúůýž]/.test(raw)) continue;
    if (/^[A-Z][a-z]+$/.test(raw)) continue; // likely EN proper noun / SRD
    if (lower.length >= 5 && /(eni|osti|ovat|itel|nych|sky|ska|uje|ujes|ovat)$/.test(lower)) {
      suspects.push(lower);
    }
  }
  return [...new Set(suspects)];
}

describe('cs i18n catalog', () => {
  const file = fs.readFileSync(path.join(import.meta.dirname, '..', 'i18n.tsx'), 'utf8');
  const entries = extractCsEntries(file);

  it('critical UI strings use Czech diacritics in source map', () => {
    const mustHaveDiacritics = [
      'Co uděláš?',
      'Maximální životy',
      'Přepnout dobrodruha',
      'Kredity vypravěče',
      'Nastavení',
      'ŽIVOTY',
    ];
    for (const fragment of mustHaveDiacritics) {
      expect(file, `missing ${fragment}`).toContain(fragment);
    }
  });

  it('reports catalog audit coverage', () => {
    const audited = entries.length;
    const withSuspects = entries.filter(e => suspectWords(e.value).length > 0);
    const exceptions = entries.filter(e => isDocumentedAsciiException(e.value));
    expect(audited).toBeGreaterThan(300);
    expect(withSuspects.length + exceptions.length).toBeLessThanOrEqual(audited);
    expect(withSuspects.length, `audited=${audited} soft-suspects=${withSuspects.length} exceptions=${exceptions.length}`).toBeLessThanOrEqual(200);
  });

  it('flags banned ASCII misspelling tokens', () => {
    const misses = entries
      .map(e => ({ value: e.value, hits: tokenizeWords(e.value).filter(w => BANNED_MISSPELLINGS.has(w)) }))
      .filter(row => row.hits.length > 0);
    expect(misses, misses.slice(0, 5).map(m => m.value).join(' | ')).toEqual([]);
  });

  it('preserves placeholders between EN keys and CS values', () => {
    for (const { key: en, value: cs } of entries) {
      const enPlaceholders = en.match(/\{[^}]+\}/g) ?? [];
      const csPlaceholders = cs.match(/\{[^}]+\}/g) ?? [];
      expect(csPlaceholders.sort().join(','), en).toBe(enPlaceholders.sort().join(','));
    }
  });
});
