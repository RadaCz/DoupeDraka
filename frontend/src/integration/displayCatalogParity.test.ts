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
    type LocationEntry = string | { nom: string };
    const catalog = JSON.parse(raw) as {
      locations: Record<string, LocationEntry>;
      creatures: Record<string, string>;
    };
    for (const [en, entry] of Object.entries(catalog.locations)) {
      const expectedNom = typeof entry === 'string' ? entry : entry.nom;
      expect(LOCATION_CS[en], `location ${en} nom parity`).toBe(expectedNom);
    }
    for (const [en, cs] of Object.entries(catalog.creatures)) {
      if (en === en.toLowerCase()) continue;
      expect(CREATURE_CS[en as keyof typeof CREATURE_CS] ?? CREATURE_CS[en], `creature ${en}`).toBe(cs);
    }
  });
});
