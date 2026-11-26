import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CharacterWizard } from './CharacterWizard';
import { LocaleProvider } from './i18n';
import type { ReferenceCatalog } from './types';
import catalogJson from './test/referenceCatalogMvp.json';

const catalog = catalogJson as ReferenceCatalog;

const RACE_LABEL_CS: Record<string, string> = {
  human: 'Člověk',
  elf: 'Elf',
  dwarf: 'Trpaslík',
  halfling: 'Hobit',
};

const CLASS_LABEL_CS: Record<string, string> = {
  fighter: 'Bojovník',
  rogue: 'Tulák',
  cleric: 'Klerik',
  wizard: 'Čaroděj',
};

/** English source keys from LOC_TVORBA_POSTAVY_cs.md — must not appear in cs wizard UI. */
const EN_DOC_KEYS = [
  'Insight',
  'Religion',
  'Keen Senses',
  'Fey Ancestry',
  'Lucky',
  'Brave',
  'Acrobatics',
  'Animal Handling',
  'Arcana',
  'Athletics',
  'Deception',
  'History',
  'Intimidation',
  'Investigation',
  'Medicine',
  'Nature',
  'Perception',
  'Performance',
  'Persuasion',
  'Sleight of Hand',
  'Stealth',
  'Survival',
  'Versatile',
  'Dwarven Resilience',
  'Dwarven Combat Training',
  'Stonecunning',
  'Halfling Nimbleness',
  'Trance',
  'Active in engine',
  'Reference only',
  'Deferred in MVP',
  'One extra language of your choice.',
  'You can see in dim light within 60 ft. as if it were bright light.',
  'You have proficiency in the Perception skill.',
  'You have advantage on saves against being charmed, and magic cannot put you to sleep.',
  'Elves do not sleep; you meditate for 4 hours to gain a long rest.',
  'Advantage on saves against poison, plus resistance to poison damage.',
  'Proficiency with battleaxe, handaxe, light hammer and warhammer.',
  'Double proficiency bonus on History checks about stonework.',
  'When you roll a 1 on an attack, ability check or save, you can reroll it once.',
  'You have advantage on saves against being frightened.',
  'You can move through the space of any creature larger than you.',
];

const DEFERRED_HIDDEN = ['Trans', 'Trpasličí bojový výcvik', 'Hobití mrštnost', 'Odloženo', 'Odlozeno'];

function renderWizard() {
  return render(
    <LocaleProvider>
      <CharacterWizard
        catalog={catalog}
        presets={[]}
        spells={[]}
        busy={false}
        error={null}
        onCreate={() => {}}
        onPreset={() => {}}
        onCancel={() => {}}
      />
    </LocaleProvider>,
  );
}

function startStepByStep() {
  fireEvent.click(screen.getByRole('button', { name: /průvodce krok za krokem|step-by-step wizard/i }));
}

function continueWizard() {
  fireEvent.click(screen.getByRole('button', { name: /pokračovat|^continue$/i }));
}

function assertNoEnglishDocKeys(text: string) {
  for (const key of EN_DOC_KEYS) {
    expect(text, `unexpected English key „${key}“`).not.toContain(key);
  }
}

function assertDeferredHidden(text: string) {
  for (const token of DEFERRED_HIDDEN) {
    expect(text, `deferred UI leaked „${token}“`).not.toContain(token);
  }
}

describe('CharacterWizard cs localization (LOC tvorba postavy)', () => {
  beforeEach(() => {
    localStorage.setItem('app_locale', 'cs');
    renderWizard();
  });

  for (const raceKey of ['human', 'elf', 'dwarf', 'halfling'] as const) {
    it(`step 1 (${raceKey}) has no English doc keys in trait panel`, () => {
      startStepByStep();
      fireEvent.click(screen.getByRole('button', { name: new RegExp(RACE_LABEL_CS[raceKey], 'i') }));
      const panel = screen.getByRole('heading', { name: /rasové vlastnosti/i }).closest('section');
      expect(panel).toBeTruthy();
      const text = (panel as HTMLElement).textContent ?? '';
      assertNoEnglishDocKeys(text);
      assertDeferredHidden(text);
    });
  }

  it('step 1 race grid uses Czech metres and ability abbreviations', () => {
    startStepByStep();
    const grid = screen.getByRole('button', { name: /elf/i }).closest('.race-grid');
    expect(grid).toBeTruthy();
    const text = (grid as HTMLElement).textContent ?? '';
    expect(text).toMatch(/9 m/);
    expect(text).toMatch(/7,5 m/);
    expect(text).not.toMatch(/\bft\./i);
    expect(text).not.toMatch(/\bSTR\b|\bDEX\b|\bCON\b|\bWIS\b/);
    expect(text).toMatch(/OBR \+2/);
  });

  it('darkvision trait is labeled Jen v příběhu in wizard', () => {
    startStepByStep();
    fireEvent.click(screen.getByRole('button', { name: /elf/i }));
    const row = screen.getByText(/vidění ve tmě/i).closest('.char-v2-spell-row');
    expect(row).toBeTruthy();
    expect((row as HTMLElement).textContent ?? '').toMatch(/jen v příběhu/i);
    expect((row as HTMLElement).textContent ?? '').not.toMatch(/platí ve hře/i);
  });

  for (const raceKey of ['human', 'elf', 'dwarf', 'halfling'] as const) {
    for (const classKey of ['fighter', 'rogue', 'cleric', 'wizard'] as const) {
      it(`skills step ${raceKey} × ${classKey} translates class skill options`, () => {
        startStepByStep();
        fireEvent.click(screen.getByRole('button', { name: new RegExp(RACE_LABEL_CS[raceKey], 'i') }));
        continueWizard();
        fireEvent.click(screen.getByRole('button', { name: new RegExp(CLASS_LABEL_CS[classKey], 'i') }));
        continueWizard();
        fireEvent.click(screen.getByRole('button', { name: /lidový hrdina/i }));
        continueWizard();
        continueWizard();
        const section = screen.getByRole('heading', { name: /dovednosti povolání/i }).closest('.wizard-content');
        expect(section).toBeTruthy();
        const text = (section as HTMLElement).textContent ?? '';
        assertNoEnglishDocKeys(text);
        assertDeferredHidden(text);
        if (classKey === 'rogue') {
          const expertise = within(section as HTMLElement).getByRole('group', { name: /odbornost/i });
          expect(expertise.textContent).toMatch(/vhled|vnímání|akrobacie/i);
        }
      });
    }
  }
});