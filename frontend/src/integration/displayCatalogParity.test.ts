import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CREATURE_CS, LOCATION_CS } from '../i18n/gameDisplay';

describe('display catalog parity', () => {
  it('frontend gameDisplay matches shared JSON for locations and creatures', () => {
    const raw = fs.readFileSync(
      path.join(import.meta.dirname, '..', '..', '..', 'localization', 'chapter_one_display.json'),
      'utf8',
    );
    const catalog = JSON.parse(raw) as {
      locations: Record<string, string>;
      creatures: Record<string, string>;
    };
    for (const [en, cs] of Object.entries(catalog.locations)) {
      expect(LOCATION_CS[en], `location ${en}`).toBe(cs);
    }
    for (const [en, cs] of Object.entries(catalog.creatures)) {
      if (en === en.toLowerCase()) continue;
      expect(CREATURE_CS[en as keyof typeof CREATURE_CS] ?? CREATURE_CS[en], `creature ${en}`).toBe(cs);
    }
  });
});
