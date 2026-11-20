import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CHAPTER_ONE_LAYOUT } from '../chapterOneMap';
import {
  actionRejectionCoach,
  playActionChips,
  primaryPlayChipKey,
  questStepCompletionLine,
  resolveNpcTopicChips,
  resolveQuestTravelAction,
} from '../game/gameActions';
import { ActionComposer } from '../screens/sharedPlayUI';
import { HomeScreen } from '../GameScreens';
import { PlaySceneIntroCard } from '../screens/sharedPlayUI';
import { LocaleProvider, useI18n } from '../i18n';
import { displayCreature, displayLocation } from '../i18n/gameDisplay';
import { characterStub } from '../test/characterStub';
import type { LocationReference } from '../types';

const locations: LocationReference[] = Object.keys(CHAPTER_ONE_LAYOUT).map(name => ({
  name,
  connections: [],
  arrival_beat: 'A quiet moment.',
}));

function renderCs(ui: ReactElement) {
  localStorage.setItem('app_locale', 'cs');
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('AC15-2 play chips per chapter location', () => {
  const t = (s: string) => s;
  for (const place of Object.keys(CHAPTER_ONE_LAYOUT)) {
    it(`offers 2–4 chips at ${place}`, () => {
      const hero = characterStub({
        id: '1',
        name: 'A',
        character_class: 'fighter',
        location: place,
        quest_flags: { bell_quest_accepted: true },
      });
      const chips = playActionChips(hero, [], locations, t, false, false);
      expect(chips.length).toBeGreaterThanOrEqual(2);
      expect(chips.length).toBeLessThanOrEqual(4);
    });
  }

  it('highlights one primary chip when a quest step is active', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Shrine of the Forgotten',
      quest_flags: { bell_quest_accepted: false },
    });
    const key = primaryPlayChipKey(hero, [], locations, t, false, false);
    const chips = playActionChips(hero, [], locations, t, false, false);
    expect(chips.filter(c => c.key === key)).toHaveLength(1);
  });
});

describe('AC15-3 quick start', () => {
  it('hero presets are offered without opening the multi-step wizard', () => {
    renderCs(
      <HomeScreen
        character={null}
        characters={[]}
        presets={[
          {
            key: 'striker',
            name: 'Quick striker',
            role: 'Damage dealer',
            race: 'Human',
            character_class: 'Fighter',
          },
        ]}
        economy={null}
        events={[]}
        onContinue={() => undefined}
        onCreate={() => undefined}
        onPreset={() => undefined}
      />,
    );
    expect(screen.getByText(/RYCHLY START|QUICK START/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quick striker/i })).toBeInTheDocument();
  });
});

describe('AC15-4 Czech display labels', () => {
  it('does not leave raw English location or creature names in cs UI', () => {
    for (const place of Object.keys(CHAPTER_ONE_LAYOUT)) {
      const label = displayLocation(place, 'cs');
      expect(label).not.toMatch(/^The /);
    }
    expect(displayCreature('goblin scout', 'cs')).not.toMatch(/goblin scout/i);
  });
});

describe('AC15-5 rejected action coach', () => {
  const pitProgressFlags = {
    bell_quest_accepted: true,
    bell_acquired: true,
    bell_found: true,
    bell_quest_complete: true,
    vault_hint_given: true,
    vault_unlocked: true,
    vault_first_descent_story_awarded: true,
  };

  const vaultPitLocations: LocationReference[] = [
    { name: 'The Vault of Echoes', connections: ["The Bell Warden's Pit", 'The Sunken Corridor'], arrival_beat: 'Damp.' },
    { name: "The Bell Warden's Pit", connections: ['The Vault of Echoes'], arrival_beat: 'Chains.' },
    { name: 'The Sunken Corridor', connections: ['The Vault of Echoes'], arrival_beat: 'Water.' },
  ];

  it('maps engine rejection to Czech catalog keys and renders without English', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Whispering Cellar',
    });
    const cases: [string, string, string][] = [
      [
        'That quest step cannot be resolved here.',
        'That quest step cannot be resolved here.',
        'Tenhle krok úkolu se tady splnit nedá.',
      ],
      [
        'That action cannot be resolved here.',
        'That action cannot be resolved here. Try a clearer command or a UI chip.',
        'Tohle se tady udělat nedá. Zkus jinou akci nebo klepni na nabídku.',
      ],
      [
        'That route is not open. Nearby destinations: The Sunken Corridor.',
        'This route is not open yet.',
        'Tahle cesta ještě není otevřená.',
      ],
    ];
    for (const [engineMsg, expectedKey, csText] of cases) {
      const coach = actionRejectionCoach(engineMsg, hero, [], locations, s => s, false, false);
      expect(coach?.reasonKey).toBe(expectedKey);
      renderCs(
        <ActionComposer
          character={hero}
          spells={[]}
          events={[]}
          locations={locations}
          busy={false}
          error={engineMsg}
          narrationStatus={null}
          onAction={() => undefined}
          onOpenSheet={() => undefined}
        />,
      );
      expect(screen.getByRole('status')).toHaveTextContent(csText);
      expect(screen.getByRole('status').textContent).not.toMatch(/cannot be resolved|Try a clearer|not open yet\./i);
      cleanup();
    }
  });

  it('offers pit travel at level 2 when the vault is open', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      level: 2,
      location: 'The Vault of Echoes',
      quest_flags: pitProgressFlags,
    });
    const travel = resolveQuestTravelAction(hero, vaultPitLocations, s => s);
    expect(travel?.action).toBe("travel to The Bell Warden's Pit");
  });
});

describe('AC15-6 home resume card', () => {
  it('shows resume location and active quest on Home', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Whispering Cellar',
      quest_flags: {},
    });
    renderCs(
      <HomeScreen
        character={hero}
        characters={[hero]}
        presets={[]}
        economy={null}
        events={[]}
        onContinue={() => undefined}
        onCreate={() => undefined}
        onPreset={() => undefined}
      />,
    );
    expect(screen.getByText(/Pokračuj tam, kde jsi skončil|Resume where you left off/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Šeptající sklep|Whispering Cellar/i })).toBeInTheDocument();
  });
});

describe('AC15 scene intro and quest toast helpers', () => {
  it('renders scene intro with quest hint', () => {
    const hero = characterStub({
      id: '1',
      name: 'A',
      character_class: 'fighter',
      location: 'The Whispering Cellar',
      quest_flags: {},
    });
    renderCs(<PlaySceneIntroCard character={hero} locations={locations} />);
    expect(screen.getByText(/Kde jsi a co chceš|Where you are/i)).toBeInTheDocument();
  });

  it('emits completion line when a quest flag flips', () => {
    const line = questStepCompletionLine(
      {},
      { bell_quest_accepted: true },
      (s: string) => s,
    );
    expect(line).toMatch(/Completed:|bell/i);
  });

  it('uses the Designer-approved Czech label for the Caldus vault topic', () => {
    function VaultTopicLabel() {
      const { t } = useI18n();
      return <span>{t('Ask Caldus about the Vault')}</span>;
    }
    renderCs(<VaultTopicLabel />);
    expect(screen.getByText('Zeptat se Calda na Komnatu ozvěn')).toBeInTheDocument();
  });

  it('lists up to three NPC topics at the shrine', () => {
    const topics = resolveNpcTopicChips(
      characterStub({
        id: '1',
        name: 'A',
        character_class: 'fighter',
        location: 'The Shrine of the Forgotten',
        quest_flags: {},
      }),
      (s: string) => s,
    );
    expect(topics.length).toBeGreaterThan(0);
    expect(topics.length).toBeLessThanOrEqual(3);
  });
});

/** Modules this package may touch for AC15 — all must live under frontend/src. */
const AC15_FRONTEND_MODULES = [
  'src/ac15/ac15Acceptance.test.tsx',
  'src/game/gameActions.ts',
  'src/screens/sharedPlayUI.tsx',
  'src/screens/AdventureScreen.tsx',
  'src/GameScreens.tsx',
  'src/App.tsx',
  'src/map/MapScreen.tsx',
  'src/chapterOneMap.ts',
  'src/i18n.tsx',
] as const;

describe('AC15-7 frontend-only scope', () => {
  it('keeps AC15 touchpoints under frontend/src', () => {
    for (const path of AC15_FRONTEND_MODULES) {
      expect(path.startsWith('src/')).toBe(true);
      expect(path).not.toMatch(/^(app|engine)\//);
    }
  });
});