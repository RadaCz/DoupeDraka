import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { displayInventoryLabel } from './gameDisplay';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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

describe('text batch 1 — Czech UI copy', () => {
  const i18nSource = readFileSync(path.join(ROOT, 'i18n.tsx'), 'utf8');
  const csValues = extractCsValues(i18nSource);
  const csBlob = csValues.join('\n');

  it('forbids stale English or ASCII tokens in cs UI strings', () => {
    const forbidden: Array<[RegExp, string]> = [
      [/\bv engine\b/i, 'v engine'],
      [/Cerstvé stopy vedou z tohoto mista/i, 'Cerstve travel lines'],
      [/Neco pobliz nese stopy/i, 'Neco pobliz discovery line'],
      [/\bpobliz\b/i, 'pobliz'],
      [/\bHospitality na venkově\b/, 'Hospitality na venkově'],
      [/\+1 AC\b/, '+1 AC'],
      [/\bAcrobatics\b/, 'Acrobatics'],
      [/\bAnimal Handling\b/, 'Animal Handling'],
      [/\bAthletics\b/, 'Athletics'],
      [/\bSurvival\b/, 'Survival'],
      [/\b\d+ gp\b/, 'gp unit in cs copy'],
      [/\bminimálně 1 gp\b/, 'minimum 1 gp'],
    ];
    const hits: string[] = [];
    for (const [pattern, label] of forbidden) {
      if (pattern.test(csBlob)) hits.push(label);
    }
    expect(hits, hits.join(', ')).toEqual([]);
  });

  it('requires updated Czech copy for batch 1', () => {
    expect(csBlob).toContain('v enginu');
    expect(csBlob).toContain('Venkovská pohostinnost');
    expect(csBlob).toContain('Obrana (+1 k OČ ve zbroji)');
    expect(csBlob).toContain('Čerstvé stopy vedou z tohoto místa dál.');
    expect(csBlob).toContain('Něco poblíž nese stopy, které stojí za prozkoumání.');
    expect(i18nSource).toMatch(/gp:\s*'zl'/);
  });

  it('maps folk-hero starter inventory labels in Czech', () => {
    const items = [
      "artisan's tools",
      'common clothes',
      'iron pot',
      'shovel',
      'pouch with 10 gp',
    ];
    for (const key of items) {
      const label = displayInventoryLabel(key, 'cs');
      expect(label).not.toBe(key);
    }
    expect(displayInventoryLabel("artisan's tools", 'cs')).toBe('řemeslnické nářadí');
    expect(displayInventoryLabel('common clothes', 'cs')).toBe('obyčejné oblečení');
    expect(displayInventoryLabel('iron pot', 'cs')).toBe('železný hrnec');
    expect(displayInventoryLabel('shovel', 'cs')).toBe('lopata');
    expect(displayInventoryLabel('pouch with 10 gp', 'cs')).toBe('měšec s 10 zl');
  });
});