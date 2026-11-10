import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ALLOW_ASCII = new Set([
  'SRD', 'XP', 'HP', 'API', 'MENU', 'JSON', 'Telegram', 'Fighter', 'Wizard', 'Rogue',
  'Paladin', 'Ranger', 'Champion', 'Lite', 'Normal', 'Doupě', 'Draka', 'Caldus', 'Nib',
  'Goblin', 'DEX', 'AC', 'DC', 'd20', 'k20', 'OZ', 'ST',
]);

const CS_VALUE_RE = /^\s*'(?:[^'\\]|\\.)*':\s*'((?:[^'\\]|\\.)*)',?\s*$/;

function extractCsValues(source: string): string[] {
  const start = source.indexOf('const cs: Record<string, string> = {');
  const end = source.indexOf('\n};', start);
  const block = source.slice(start, end);
  const values: string[] = [];
  for (const line of block.split('\n')) {
    const m = line.match(CS_VALUE_RE);
    if (m) values.push(m[1].replace(/\\'/g, "'"));
  }
  return values;
}

function looksLikeAsciiCzechProse(value: string): boolean {
  if (!value.trim()) return false;
  if (!/[a-zA-Z]/.test(value)) return false;
  if (/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(value)) return false;
  const stripped = value.replace(/\{[^}]+\}/g, ' ').replace(/https?:\/\/\S+/g, ' ');
  const tokens = stripped.split(/[^A-Za-zÀ-ž]+/).filter(Boolean);
  if (tokens.length < 2) return false;
  const asciiWords = tokens.filter(t => /^[A-Za-z]+$/.test(t));
  if (asciiWords.length === 0) return false;
  const allowed = asciiWords.every(w => ALLOW_ASCII.has(w) || /^[A-Z][a-z]+$/.test(w) === false && w.length <= 2);
  if (allowed) return false;
  const czechHints =
    /\b(neni|nema|tvuj|pribeh|otevri|pokracuj|dobrodruz|vyprav|kouzl|trida|uroven|zpet|prihlas|nepodarilo|zalozce|pratel|druzin|dispozici|jeste|otevren)\b/i;
  return czechHints.test(value);
}

describe('cs i18n catalog', () => {
  const file = fs.readFileSync(path.join(import.meta.dirname, '..', 'i18n.tsx'), 'utf8');

  it('critical UI strings use Czech diacritics in source map', () => {
    const mustHaveDiacritics = [
      'Co uděláš?',
      'Maximální životy',
      'Přepnout dobrodruha',
      'Tato třída',
      'Kredity vypravěče',
    ];
    for (const fragment of mustHaveDiacritics) {
      expect(file, `missing ${fragment}`).toContain(fragment);
    }
    expect(file).not.toMatch(/'Co udelas\?'/);
    expect(file).not.toMatch(/Maximalni zivoty/);
  });

  it('flags remaining ASCII-only Czech UI values', () => {
    const values = extractCsValues(file);
    const suspects = values.filter(looksLikeAsciiCzechProse);
    const sample = suspects.slice(0, 12);
    expect(
      suspects,
      `ASCII Czech UI still present (first ${sample.length}): ${sample.join(' | ')}`,
    ).toEqual([]);
  });

  it('preserves placeholders between EN keys and CS values', () => {
    const pairs: Array<{ en: string; cs: string }> = [];
    const keyRe = /^\s*'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)',?\s*$/;
    const start = file.indexOf('const cs: Record<string, string> = {');
    const end = file.indexOf('\n};', start);
    for (const line of file.slice(start, end).split('\n')) {
      const m = line.match(keyRe);
      if (!m) continue;
      pairs.push({ en: m[1], cs: m[2] });
    }
    for (const { en, cs } of pairs) {
      const enPlaceholders = en.match(/\{[^}]+\}/g) ?? [];
      const csPlaceholders = cs.match(/\{[^}]+\}/g) ?? [];
      expect(csPlaceholders.sort().join(','), en).toBe(enPlaceholders.sort().join(','));
    }
  });
});
