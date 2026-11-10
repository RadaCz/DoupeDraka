import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('cs i18n catalog', () => {
  it('critical UI strings use Czech diacritics in source map', () => {
    const file = fs.readFileSync(path.join(import.meta.dirname, '..', 'i18n.tsx'), 'utf8');
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
});
