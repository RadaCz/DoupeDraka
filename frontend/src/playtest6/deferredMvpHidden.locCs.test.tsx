import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocaleProvider } from '../i18n';
import { CharacterScreen } from '../screens/CharacterScreen';
import { ToolsScreen } from '../screens/ToolsScreen';
import { LevelUpModal } from '../components/TurnMoments';
import type { Character, ReferenceCatalog, Spell } from '../types';
import catalogJson from '../test/referenceCatalogMvp.json';

const catalog = catalogJson as ReferenceCatalog;
const spells: Spell[] = [];

const FORBIDDEN = [/\bDeferred\b/i, /odloženo/i, /odlozeno/i, /\bnot in MVP\b/i];

function assertHidden(text: string) {
  for (const re of FORBIDDEN) {
    expect(text, `player UI leaked ${re}`).not.toMatch(re);
  }
}

function elfRaceFeatures() {
  const elf = catalog.races.find(r => r.key === 'elf');
  return {
    race: 'elf',
    darkvision_ft: 60,
    traits: (elf?.traits ?? []).map(trait => ({
      id: trait.trait_id ?? trait.name,
      name: trait.name,
      modeled: Boolean(trait.modeled),
      deferred: Boolean(trait.deferred),
    })),
  };
}

function baseHero(character_class: Character['character_class']): Character {
  return {
    id: '1',
    name: 'Hrdina',
    race: 'elf',
    character_class,
    level: 2,
    abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 14, charisma: 10 },
    hp: 14,
    max_hp: 14,
    armor_class: 16,
    mana: 0,
    max_mana: 0,
    xp: 100,
    gold: 10,
    inventory: [],
    item_instances: [
      { instance_id: 'w1', definition_id: 'shortsword', name: 'shortsword', equipped: true, attack_bonus: 0 },
      { instance_id: 'a1', definition_id: 'chain mail', name: 'chain mail', equipped: true, attack_bonus: 0 },
    ],
    location: 'The Whispering Cellar',
    in_combat: false,
    spell_slots: { 1: 2 },
    max_spell_slots: { 1: 2 },
    known_spells: ['Guidance', 'Cure Wounds'],
    prepared_spells: ['Cure Wounds', 'Bless'],
    spellcasting_ability: 'wisdom',
    difficulty: 'normal',
    tone: 'balanced',
    humor: 'rare',
    verbose: false,
    race_features: elfRaceFeatures(),
    speed: 30,
    divine_domain: 'life',
    channel_divinity_available: true,
    fighting_style: 'defense',
    second_wind_available: true,
    expertise_skills: ['stealth', 'perception'],
  };
}

describe('playtest-6 — Odloženo / Deferred hidden (cs)', () => {
  beforeEach(() => {
    localStorage.setItem('app_locale', 'cs');
  });

  for (const klass of ['fighter', 'rogue', 'cleric', 'wizard'] as const) {
    it(`character sheet (${klass}) has no Deferred / Odloženo labels`, () => {
      const hero = {
        ...baseHero(klass === 'fighter' ? 'fighter' : klass === 'rogue' ? 'rogue' : klass === 'cleric' ? 'cleric' : 'wizard'),
        character_class: klass,
        known_spells: klass === 'wizard' ? ['Mage Hand', 'Fire Bolt'] : klass === 'cleric' ? ['Guidance'] : [],
        prepared_spells: klass === 'cleric' ? ['Cure Wounds'] : [],
      };
      const { container } = render(
        <LocaleProvider>
          <CharacterScreen
            character={hero}
            characters={[hero]}
            spells={spells}
            onSelect={() => {}}
            onCreate={() => {}}
          />
        </LocaleProvider>,
      );
      assertHidden(container.textContent ?? '');
      const section = screen.getByRole('heading', { name: /rasové vlastnosti/i }).closest('section');
      expect(section?.textContent ?? '').not.toMatch(/trans/i);
      expect(section?.textContent ?? '').toMatch(/jen v příběhu/i);
    });
  }

  it('tools rules tab has no Deferred / Odloženo', () => {
    const hero = baseHero('wizard');
    const { container } = render(
      <LocaleProvider>
        <ToolsScreen
          character={hero}
          catalog={catalog}
          spells={spells}
          calculating={false}
          calculation={null}
          error={null}
          onCalculate={() => {}}
        />
      </LocaleProvider>,
    );
    assertHidden(container.textContent ?? '');
  });

  it('level-up modal does not show deferred MVP footnote', () => {
    const hero = baseHero('wizard');
    render(
      <LocaleProvider>
        <LevelUpModal
          notice={{ level: 2, hpGained: 5, classFeatures: ['Arcane Recovery'], classFeaturesDeferred: ['Arcane Tradition'] }}
          character={hero}
          onDismiss={() => {}}
        />
      </LocaleProvider>,
    );
    assertHidden(document.body.textContent ?? '');
    expect(screen.queryByText(/připravuje se/i)).not.toBeInTheDocument();
  });
});